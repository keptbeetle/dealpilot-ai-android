from pathlib import Path
import unittest
from start_emulator import emulator_command


class EmulatorHostTests(unittest.TestCase):
    def test_windows_uses_native_sdk_binary_and_read_only_avd(self):
        command = emulator_command(Path('SDK with spaces'), 'shopping_api35', 5580, windows=True)
        self.assertTrue(command[0].endswith('emulator.exe'))
        self.assertIn('-read-only', command)
        self.assertIn('shopping_api35', command)
        self.assertNotIn('Xvfb', command)

    def test_unix_uses_native_binary(self):
        self.assertEqual(Path(emulator_command('/sdk', 'shopping', 5580, windows=False)[0]).name, 'emulator')

    def test_rejects_ambiguous_names_and_invalid_ports(self):
        for name, port in [('../other', 5580), ('shopping', 5581), ('shopping', 1)]:
            with self.assertRaises(ValueError):
                emulator_command('/sdk', name, port)
