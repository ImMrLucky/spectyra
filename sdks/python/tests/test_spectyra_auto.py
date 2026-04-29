def test_spectyra_auto_start_idempotent() -> None:
    from spectyra_auto.state import get_engine, start, stop

    stop()
    e1 = start(jsonl_enabled=False)
    e2 = start(jsonl_enabled=False)
    assert e1 is e2
    e1.record_event({"provider": "openai", "latencyMs": 10, "success": True})
    assert len(e1.get_events_snapshot()) == 1
    stop()
    assert get_engine() is None
