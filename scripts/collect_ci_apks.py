#!/usr/bin/env python3
"""Collect only named APKs and public build provenance; never copy signing material."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess


def collect(source, output, metadata):
    variants = {'arm64': 'arm64-v8a', 'x86_64': 'x86_64', 'universal': 'universal'}
    required = [source / f'app-{abi}-debug.apk' for abi in variants.values()]
    required += [source / 'signatures.txt', source / 'payload-report.jsonl']
    if any(not file.is_file() or not file.stat().st_size for file in required):
        raise ValueError('All three verified APKs and signature/payload reports are required.')
    if output.exists() and any(output.iterdir()):
        raise ValueError('Refusing to mix this build with an existing artifact directory.')
    output.mkdir(parents=True, exist_ok=True)
    description = (
        f"Source commit: `{metadata['sourceCommit']}`\n\n"
        f"Build: {metadata['runUrl']}\n\n"
        f"Version code: `{metadata['versionCode']}`; signing: {metadata['signingMode']}.\n\n"
        'Debug test build. No retailer order/fulfilment or completed payment is implied. '
        'Shopping uses the separately paired Windows host and DealPilot backend. '
        'No account credentials, signing keystore or backend keys are included.\n'
    )
    (output / 'BUILD.md').write_text(description, encoding='utf-8')
    for variant, abi in variants.items():
        folder = output / variant
        folder.mkdir()
        name = f'Pocket-Agent-{variant}.apk'
        apk = folder / name
        shutil.copyfile(source / f'app-{abi}-debug.apk', apk)
        digest = hashlib.sha256(apk.read_bytes()).hexdigest()
        (folder / 'SHA256SUMS.txt').write_text(f'{digest}  {name}\n', encoding='utf-8')
        (folder / 'source-commit.txt').write_text(metadata['sourceCommit'] + '\n', encoding='utf-8')
        (folder / 'build.json').write_text(json.dumps({**metadata, 'abi': abi, 'apkSha256': digest}, indent=2) + '\n', encoding='utf-8')
        (folder / 'BUILD.md').write_text(description, encoding='utf-8')
        for report in ['signatures.txt', 'payload-report.jsonl']:
            shutil.copyfile(source / report, folder / report)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=Path('app/build/outputs/apk/debug'))
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    number = os.environ.get('GITHUB_RUN_NUMBER', '')
    if not number.isdecimal() or not 1 <= int(number) <= 2_099_899_999:
        raise ValueError('Expected a bounded positive GitHub run number.')
    sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip()
    repository = os.environ['GITHUB_REPOSITORY']
    run = os.environ['GITHUB_RUN_ID']
    collect(args.source, args.output, {
        'sourceCommit': sha,
        'event': os.environ['GITHUB_EVENT_NAME'],
        'ref': os.environ['GITHUB_REF'],
        'runUrl': f'https://github.com/{repository}/actions/runs/{run}',
        'versionCode': 100_000 + int(number),
        'signingMode': 'persistent CI debug key' if os.environ.get('CI_DEBUG_KEYSTORE') else 'disposable runner debug key (PRs do not receive the persistent key)',
    })
