from __future__ import annotations

import argparse
import ctypes
import json
import os
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any


STATE_DIR = Path.home() / ".emolitter"
PID_FILE = STATE_DIR / "listener.pid"
STOP_FILE = STATE_DIR / "stop.signal"
SESSION_FILE = STATE_DIR / "session.json"
EVENTS_FILE = STATE_DIR / "events.jsonl"
RESULT_FILE = STATE_DIR / "result.json"

WINDOW_POLL_SECONDS = 0.8
STOP_WAIT_SECONDS = 15


@dataclass
class Session:
    recipient: str
    started_at: str


def ensure_state_dir() -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)


def read_text(path: Path) -> str | None:
    if not path.exists():
        return None
    return path.read_text(encoding="utf-8").strip()


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def read_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def is_process_running(pid: int | None) -> bool:
    if not pid or pid <= 0:
        return False
    if os.name == "nt":
        process_query_limited_information = 0x1000
        handle = ctypes.windll.kernel32.OpenProcess(
            process_query_limited_information,
            False,
            pid,
        )
        if not handle:
            return False
        exit_code = ctypes.c_ulong()
        success = ctypes.windll.kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code))
        ctypes.windll.kernel32.CloseHandle(handle)
        return bool(success) and exit_code.value == 259
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def read_pid() -> int | None:
    raw = read_text(PID_FILE)
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


def cleanup_runtime_files() -> None:
    for path in [PID_FILE, STOP_FILE, SESSION_FILE, EVENTS_FILE]:
        if path.exists():
            path.unlink()


def desktop_dir() -> Path:
    desktop = Path.home() / "Desktop"
    return desktop if desktop.exists() else Path.home()


def sanitize_filename(value: str, fallback: str) -> str:
    cleaned = re.sub(r'[<>:"/\\|?*\r\n]+', "", value).strip()
    cleaned = re.sub(r"\s+", "_", cleaned)
    return cleaned[:24] or fallback


def load_session() -> Session | None:
    payload = read_json(SESSION_FILE)
    if not payload:
        return None
    return Session(
        recipient=str(payload.get("recipient", "未署名的人")),
        started_at=str(payload.get("started_at", datetime.now().isoformat())),
    )


def append_event(message: str, timestamp: datetime | None = None) -> None:
    ensure_state_dir()
    stamp = (timestamp or datetime.now()).isoformat()
    entry = {"timestamp": stamp, "message": message}
    with EVENTS_FILE.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(entry, ensure_ascii=False) + "\n")


def load_events() -> list[dict[str, str]]:
    if not EVENTS_FILE.exists():
        return []
    items: list[dict[str, str]] = []
    for line in EVENTS_FILE.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            continue
        items.append(
            {
                "timestamp": str(payload.get("timestamp", datetime.now().isoformat())),
                "message": str(payload.get("message", "")),
            }
        )
    return items


def summarize_events(events: list[dict[str, str]]) -> str:
    if not events:
        return "静默片段"
    last_message = events[-1]["message"]
    summary = re.sub(r"[，。、「」“”‘’：:!！?？\[\]（）()]", "", last_message)
    summary = summary.replace("你", "").strip()
    return sanitize_filename(summary[:10], "心事片段")


def build_letter_content(session: Session, events: list[dict[str, str]]) -> str:
    body_lines = [f"致亲爱的{session.recipient}：", ""]
    if events:
        for entry in events:
            try:
                event_time = datetime.fromisoformat(entry["timestamp"]).strftime("%H:%M:%S")
            except ValueError:
                event_time = "--:--:--"
            body_lines.append(f"[{event_time}] {entry['message']}")
    else:
        body_lines.append("今天的电脑没有留下太多动静，只剩下一点温柔的空白。")

    body_lines.extend(
        [
            "",
            "此致",
            "敬礼",
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        ]
    )
    return "\n".join(body_lines) + "\n"


def finalize_letter() -> Path | None:
    session = load_session()
    if not session:
        return None

    events = load_events()
    letter_text = build_letter_content(session, events)
    try:
        started = datetime.fromisoformat(session.started_at)
    except ValueError:
        started = datetime.now()
    date_fragment = started.strftime("%Y%m%d")
    summary = summarize_events(events)
    filename = f"致{sanitize_filename(session.recipient, '未署名的人')}_{date_fragment}_{summary}.txt"
    output_path = desktop_dir() / filename
    output_path.write_text(letter_text, encoding="utf-8")
    write_json(
        RESULT_FILE,
        {
            "output_path": str(output_path),
            "generated_at": datetime.now().isoformat(),
            "recipient": session.recipient,
        },
    )
    cleanup_runtime_files()
    return output_path


def describe_key(key: Any) -> str:
    key_name = str(key)
    special_names = {
        "Key.space": "空格",
        "Key.enter": "回车",
        "Key.backspace": "退格",
        "Key.tab": "Tab",
        "Key.esc": "Esc",
        "Key.delete": "Delete",
        "Key.shift": "Shift",
        "Key.shift_r": "右 Shift",
        "Key.ctrl": "Ctrl",
        "Key.ctrl_l": "左 Ctrl",
        "Key.ctrl_r": "右 Ctrl",
        "Key.alt": "Alt",
        "Key.alt_l": "左 Alt",
        "Key.alt_r": "右 Alt",
        "Key.cmd": "Command",
        "Key.cmd_r": "右 Command",
        "Key.up": "上方向键",
        "Key.down": "下方向键",
        "Key.left": "左方向键",
        "Key.right": "右方向键",
        "Key.home": "Home",
        "Key.end": "End",
        "Key.page_up": "Page Up",
        "Key.page_down": "Page Down",
        "Key.caps_lock": "Caps Lock",
    }

    if hasattr(key, "char") and key.char is not None:
        char = key.char
        if char == "\n":
            return "你按下了回车，好像替一句话落了款。"
        if char == " ":
            return "你留下一枚空格，让呼吸在句子中间轻轻停靠。"
        return f"你轻轻敲下「{char}」，仿佛在替沉默添一笔旁白。"

    label = special_names.get(key_name)
    if label:
        return f"你碰了碰「{label}」，像是在给思绪调一个更舒服的姿势。"

    cleaned = key_name.replace("Key.", "")
    return f"你按下了「{cleaned}」，像把一小段情绪交给了键盘保管。"


def current_window_title() -> str | None:
    system = sys.platform
    if system.startswith("win"):
        try:
            import pygetwindow as gw

            window = gw.getActiveWindow()
            if window and window.title:
                return window.title.strip()
        except Exception:
            return None
        return None

    if system == "darwin":
        script = (
            'tell application "System Events"\n'
            'set frontApp to first application process whose frontmost is true\n'
            'set appName to name of frontApp\n'
            'try\n'
            'set windowName to name of first window of frontApp\n'
            'return appName & " - " & windowName\n'
            'on error\n'
            'return appName\n'
            'end try\n'
            'end tell'
        )
        try:
            result = subprocess.run(
                ["osascript", "-e", script],
                capture_output=True,
                text=True,
                check=False,
                timeout=3,
            )
        except Exception:
            return None
        title = result.stdout.strip()
        return title or None

    commands = [
        ["xdotool", "getactivewindow", "getwindowname"],
        [
            "sh",
            "-lc",
            "xprop -root _NET_ACTIVE_WINDOW | awk '{print $5}' | xargs -I{} xprop -id {} WM_NAME",
        ],
    ]
    for command in commands:
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=False,
                timeout=3,
            )
        except Exception:
            continue
        output = result.stdout.strip()
        if not output:
            continue
        if "WM_NAME" in output:
            match = re.search(r'"(.+)"', output)
            if match:
                return match.group(1).strip()
        return output
    return None


def spawn_listener(recipient: str) -> None:
    ensure_state_dir()
    STOP_FILE.unlink(missing_ok=True)
    EVENTS_FILE.unlink(missing_ok=True)
    RESULT_FILE.unlink(missing_ok=True)

    command = [sys.executable, "-m", "emolitter.cli", "_listen", "--recipient", recipient]
    popen_kwargs: dict[str, Any] = {
        "stdin": subprocess.DEVNULL,
        "stdout": subprocess.DEVNULL,
        "stderr": subprocess.DEVNULL,
        "cwd": str(Path.cwd()),
    }
    if os.name == "nt":
        detached = getattr(subprocess, "DETACHED_PROCESS", 0)
        new_group = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        no_window = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        popen_kwargs["creationflags"] = detached | new_group | no_window
    else:
        popen_kwargs["start_new_session"] = True

    subprocess.Popen(command, **popen_kwargs)


def open_command(recipient: str | None) -> int:
    ensure_state_dir()
    pid = read_pid()
    if is_process_running(pid):
        print("监听已经在运行中，请先执行 emo close。")
        return 1

    cleanup_runtime_files()
    if not recipient:
        recipient = input("你想给什么人写信？ ").strip()
    recipient = recipient or "未署名的人"
    spawn_listener(recipient)
    print(f"已经开始在后台替你写给「{recipient}」的信。")
    return 0


def stop_listener_gracefully(pid: int) -> bool:
    STOP_FILE.write_text(datetime.now().isoformat(), encoding="utf-8")
    deadline = time.time() + STOP_WAIT_SECONDS
    while time.time() < deadline:
        if RESULT_FILE.exists() and not SESSION_FILE.exists():
            return True
        if not PID_FILE.exists() and not is_process_running(pid):
            return True
        if not is_process_running(pid):
            return True
        time.sleep(0.5)
    return RESULT_FILE.exists() or not is_process_running(pid)


def close_command() -> int:
    ensure_state_dir()
    pid = read_pid()

    if pid and is_process_running(pid):
        finished = stop_listener_gracefully(pid)
        if not finished:
            print("监听进程还没有优雅收尾，请稍后再试一次。")
            return 1
    elif SESSION_FILE.exists():
        output = finalize_letter()
        if output:
            print(f"监听已恢复收尾，信件已放到桌面：{output}")
            return 0
    else:
        print("当前没有正在进行的记录。")
        return 1

    result = read_json(RESULT_FILE)
    if result and result.get("output_path"):
        print(f"信已经替你写好，安静地放在桌面上：{result['output_path']}")
        return 0

    output = finalize_letter()
    if output:
        print(f"信已经替你写好，安静地放在桌面上：{output}")
        return 0

    print("监听已经结束，但没有找到可生成的书信内容。")
    return 1


def listener_process(recipient: str) -> int:
    ensure_state_dir()
    PID_FILE.write_text(str(os.getpid()), encoding="utf-8")
    write_json(
        SESSION_FILE,
        {
            "recipient": recipient,
            "started_at": datetime.now().isoformat(),
        },
    )
    append_event(f"你铺开了一张看不见的信纸，决定把今天写给「{recipient}」。")

    try:
        from pynput import keyboard
    except ImportError as exc:
        append_event(f"键盘监听没能启动：{exc}。这封信先留下一个遗憾的空行。")
        finalize_letter()
        raise SystemExit(1) from exc

    def on_press(key: Any) -> None:
        append_event(describe_key(key))

    listener = keyboard.Listener(on_press=on_press)
    listener.daemon = True
    listener.start()

    last_window: str | None = None
    try:
        while not STOP_FILE.exists():
            title = current_window_title()
            if title and title != last_window:
                last_window = title
                append_event(f"你踏入了「{title}」的领地，像给情绪换了一盏台灯。")
            time.sleep(WINDOW_POLL_SECONDS)
    finally:
        listener.stop()
        time.sleep(0.2)
        finalize_letter()

    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="emo",
        description="把你的电脑操作写成一封带点文艺幽默的信。",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    open_parser = subparsers.add_parser("open", help="启动后台监听")
    open_parser.add_argument("--to", dest="recipient", help="直接指定收信人")

    subparsers.add_parser("close", help="停止监听并生成书信")

    listen_parser = subparsers.add_parser("_listen")
    listen_parser.add_argument("--recipient", required=True)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "open":
        return open_command(args.recipient)
    if args.command == "close":
        return close_command()
    if args.command == "_listen":
        return listener_process(args.recipient)

    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
