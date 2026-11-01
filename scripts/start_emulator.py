#!/usr/bin/env python3
"""Start an explicitly selected local AVD using the native Android SDK."""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import time


def sdk_directory(explicit=None):
    configured = explicit or os.environ.get('ANDROID_SDK_ROOT') or os.environ.get('ANDROID_HOME')
    if configured:
        return Path(configured)
    adb = shutil.which('adb')
    if adb:
        return Path(adb).resolve().parent.parent
    raise ValueError('Supply --sdk or configure ANDROID_HOME / adb on PATH')


def emulator_command(sdk, avd, port, windows=None):
    if not re.fullmatch(r'[A-Za-z0-9_.-]+', avd) or not 5554 <= port <= 5682 or port % 2:
        raise ValueError('Use an AVD name and an even emulator port from 5554 to 5682')
    windows = os.name == 'nt' if windows is None else windows
    executable = Path(sdk) / 'emulator' / ('emulator.exe' if windows else 'emulator')
    return [str(executable), '-avd', avd, '-port', str(port), '-read-only',
            '-no-window', '-no-boot-anim', '-no-audio', '-no-snapshot-load',
            '-no-snapshot-save', '-gpu', 'swiftshader_indirect', '-memory', '2048', '-cores', '2']


def main(default_avd=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sdk')
    parser.add_argument('--avd', default=default_avd, required=default_avd is None)
    parser.add_argument('--port', type=int, default=5580)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    sdk = sdk_directory(args.sdk)
    command = emulator_command(sdk, args.avd, args.port)
    serial = f'emulator-{args.port}'
    if args.dry_run:
        print(json.dumps({'command': command, 'serial': serial, 'launches_device': False}))
        return
    adb = sdk / 'platform-tools' / ('adb.exe' if os.name == 'nt' else 'adb')
    if not Path(command[0]).is_file() or not adb.is_file():
        raise SystemExit('Emulator or adb is missing from the selected SDK')
    devices = subprocess.run([str(adb), 'devices'], check=True, capture_output=True, text=True)
    if any(line.split()[0] == serial for line in devices.stdout.splitlines()[1:] if line.split()):
        raise SystemExit('Selected emulator serial is already in use. Choose a free port.')
    directory = Path(__file__).resolve().parents[1] / 'artifacts' / f'emulator-{args.port}'
    directory.mkdir(parents=True, exist_ok=True)
    with (directory / 'emulator.log').open('ab') as output:
        process = subprocess.Popen(command, stdout=output, stderr=subprocess.STDOUT,
                                   creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0,
                                   start_new_session=os.name != 'nt')
    (directory / 'emulator.pid').write_text(str(process.pid))
    try:
        deadline = time.monotonic() + 480
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise RuntimeError('Emulator exited. Inspect its artifact log.')
            result = subprocess.run([str(adb), '-s', serial, 'shell', 'getprop', 'sys.boot_completed'],
                                    capture_output=True, text=True, timeout=15)
            if result.returncode == 0 and result.stdout.strip() == '1':
                print(f'Emulator ready on {serial}, PID {process.pid}')
                return
            time.sleep(2)
        raise RuntimeError('Emulator boot timed out')
    except BaseException:
        process.terminate()
        process.wait(timeout=15)
        raise


if __name__ == '__main__':
    main()
