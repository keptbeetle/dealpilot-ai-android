import hashlib
import json
from pathlib import Path
import tempfile
import unittest

from collect_ci_apks import collect


class CiApkArtifactsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.source = Path(self.temp.name) / 'source'
        self.source.mkdir()
        self.output = Path(self.temp.name) / 'download'
        self.metadata = {'sourceCommit': 'a' * 40, 'runUrl': 'https://github.com/example/app/actions/runs/12', 'versionCode': 100012, 'signingMode': 'test fixture'}
        for abi in ['arm64-v8a', 'x86_64', 'universal']:
            (self.source / f'app-{abi}-debug.apk').write_bytes(f'INJECTED APK {abi}'.encode())
        for report in ['signatures.txt', 'payload-report.jsonl']:
            (self.source / report).write_text('Synthetic verification fixture')

    def test_each_download_has_its_own_matching_apk_checksum_and_source(self):
        collect(self.source, self.output, self.metadata)
        for variant in ['arm64', 'x86_64', 'universal']:
            folder = self.output / variant
            name = f'Pocket-Agent-{variant}.apk'
            sha = hashlib.sha256((folder / name).read_bytes()).hexdigest()
            self.assertEqual((folder / 'SHA256SUMS.txt').read_text(), f'{sha}  {name}\n')
            self.assertEqual(json.loads((folder / 'build.json').read_text())['apkSha256'], sha)
            self.assertEqual((folder / 'source-commit.txt').read_text().strip(), 'a' * 40)

    def test_unrelated_keys_and_logs_cannot_enter_the_artifact(self):
        (self.source / 'debug.keystore').write_bytes(b'PRIVATE FIXTURE KEY')
        (self.source / 'host.log').write_text('PRIVATE FIXTURE LOG')
        collect(self.source, self.output, self.metadata)
        self.assertFalse(any(b'PRIVATE FIXTURE' in file.read_bytes() for file in self.output.rglob('*') if file.is_file()))

    def test_missing_or_empty_verification_prevents_partial_artifacts(self):
        for missing in ['app-arm64-v8a-debug.apk', 'app-x86_64-debug.apk', 'app-universal-debug.apk', 'signatures.txt', 'payload-report.jsonl']:
            file = self.source / missing
            original = file.read_bytes()
            file.write_bytes(b'')
            with self.assertRaisesRegex(ValueError, 'required'):
                collect(self.source, self.output, self.metadata)
            self.assertFalse(self.output.exists())
            file.write_bytes(original)

    def test_an_existing_download_is_not_silently_mixed_with_a_new_build(self):
        self.output.mkdir()
        (self.output / 'previous.txt').write_text('previous build')
        with self.assertRaisesRegex(ValueError, 'existing'):
            collect(self.source, self.output, self.metadata)
        self.assertEqual((self.output / 'previous.txt').read_text(), 'previous build')


if __name__ == '__main__':
    unittest.main()
