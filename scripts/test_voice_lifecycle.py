"""Run the existing Android-independent voice simulators on the native host JVM."""
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


class VoiceLifecycleHostTest(unittest.TestCase):
    def test_lifecycle_and_startup_simulators(self):
        with tempfile.TemporaryDirectory(prefix='pocket voice host ') as temporary:
            sources = [ROOT / name for name in [
                'app/src/main/java/dev/pocket/agent/SubscriptionVoiceLifecycle.java',
                'scripts/SubscriptionVoiceLifecycleSimulator.java',
                'scripts/SubscriptionVoiceStartupSimulator.java',
            ]]
            subprocess.run(['javac', '--release', '17', '-d', temporary,
                            *map(str, sources)], check=True, timeout=30)
            for name in ['SubscriptionVoiceLifecycleSimulator', 'SubscriptionVoiceStartupSimulator']:
                subprocess.run(['java', '-cp', temporary, f'dev.pocket.agent.{name}'],
                               check=True, timeout=15)
