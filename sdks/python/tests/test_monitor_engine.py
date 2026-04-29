import json
import tempfile
import unittest
from pathlib import Path

from spectyra.monitor.engine import MonitorEngine


class TestMonitorEngine(unittest.TestCase):
    def test_buffer_and_summary(self) -> None:
        eng = MonitorEngine(enabled=True, jsonl_enabled=False)
        eng.record_event(
            {
                "provider": "openai",
                "model": "gpt-4o-mini",
                "latencyMs": 50,
                "success": True,
                "actualCostUsd": 0.01,
                "inputTokens": 10,
                "outputTokens": 5,
            }
        )
        s = eng.get_monitor_summary()
        self.assertEqual(s["requestCount"], 1)
        self.assertGreaterEqual(s["actualSpendProviderUsd"], 0.01)

    def test_jsonl(self) -> None:
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "m.jsonl"
            eng = MonitorEngine(enabled=True, jsonl_path=str(p), jsonl_enabled=True)
            eng.record_event(
                {"provider": "openai", "latencyMs": 1, "success": True, "integrationMode": "explicit_sdk"}
            )
            lines = p.read_text(encoding="utf-8").strip().splitlines()
            self.assertEqual(len(lines), 1)
            row = json.loads(lines[0])
            self.assertEqual(row["provider"], "openai")


if __name__ == "__main__":
    unittest.main()
