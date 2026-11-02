"""Private host files using owner-only POSIX modes or Windows DACLs."""
import os
from pathlib import Path
import stat
import subprocess

WINDOWS_POLICY = Path(__file__).with_name('windows-private-path.ps1')


def _windows_access(path, action):
    result = subprocess.run(
        ['powershell.exe', '-NoProfile', '-NonInteractive', '-File',
         str(WINDOWS_POLICY), '-Path', str(Path(path).resolve()), '-Action', action],
        capture_output=True, timeout=15, creationflags=subprocess.CREATE_NO_WINDOW,
    )
    if result.returncode:
        raise ValueError('Private storage access protection could not be established or verified')


def protect_private_path(path, directory=False):
    path = Path(path)
    if path.is_symlink() or (not path.is_dir() if directory else not path.is_file()):
        raise ValueError('Invalid private storage path')
    if os.name == 'nt':
        _windows_access(path, 'Protect')
    else:
        path.chmod(0o700 if directory else 0o600)


def assert_private_path(path, directory=False):
    path = Path(path)
    info = path.lstat()
    expected = stat.S_ISDIR if directory else stat.S_ISREG
    if path.is_symlink() or not expected(info.st_mode):
        raise ValueError('Invalid private storage path')
    if os.name == 'nt':
        _windows_access(path, 'Check')
    elif info.st_uid != os.getuid() or info.st_mode & 0o077:
        raise ValueError('Private storage grants access to another user')
