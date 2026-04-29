import unittest

from spectyra.automation import get_auto_monitor_engine, start_spectyra_auto, stop_spectyra_auto


class TestAutomation(unittest.TestCase):
    def tearDown(self) -> None:
        stop_spectyra_auto()

    def test_start_stop_roundtrip(self) -> None:
        eng = start_spectyra_auto(jsonl_enabled=False)
        self.assertIs(eng, get_auto_monitor_engine())
        eng.record_event(
            {
                "provider": "openai",
                "model": "gpt-4o-mini",
                "latencyMs": 2,
                "success": True,
                "integrationMode": "auto_http",
            }
        )
        self.assertEqual(eng.get_monitor_summary()["requestCount"], 1)
        stop_spectyra_auto()
        self.assertIsNone(get_auto_monitor_engine())


if __name__ == "__main__":
    unittest.main()
