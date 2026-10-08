"""Offline tests for review fixes in persistence_in_memory.py (no network,
no ARC_API_KEY). Run: python3 test_persistence_in_memory.py"""
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

try:
    import persistence_in_memory as pim
except ImportError as exc:  # requests missing
    pim = None
    IMPORT_ERROR = exc


class _Resp:
    def __init__(self, status, payload=None):
        self.status_code = status
        self._payload = payload or {}
        self.content = b"{}"
        self.text = "{}"

    def json(self):
        return self._payload


class _Session:
    def __init__(self, statuses):
        self.statuses = list(statuses)
        self.calls = 0
        self.headers = {}

    def post(self, url, json=None, timeout=None):
        self.calls += 1
        return _Resp(self.statuses.pop(0) if self.statuses else 429)

    get = post


@unittest.skipIf(pim is None, "requests is not installed")
class ReviewFixTest(unittest.TestCase):
    def test_429_retries_stop_at_deadline(self):
        c = pim.Client("k")
        c.s = _Session([429] * 8)
        c.deadline = time.time() + 1.0   # first backoff is 2 s: must not sleep past it
        t0 = time.time()
        status, _ = c.req("POST", "/api/cmd/ACTION1", {})
        self.assertEqual(status, 429)
        self.assertLess(time.time() - t0, 1.0)
        self.assertEqual(c.s.calls, 1)

    def test_no_deadline_still_retries(self):
        c = pim.Client("k")
        c.s = _Session([429, 200])
        old = pim.time.sleep
        pim.time.sleep = lambda s: None
        try:
            status, _ = c.req("POST", "/api/cmd/ACTION1", {})
        finally:
            pim.time.sleep = old
        self.assertEqual(status, 200)
        self.assertEqual(c.s.calls, 2)

    def test_out_dir_checks(self):
        with tempfile.TemporaryDirectory() as td:
            fresh = Path(td) / "fresh"
            pim.prepare_out_dir(fresh)
            self.assertEqual(os.stat(fresh).st_mode & 0o777, 0o700)
            pim.prepare_out_dir(fresh)  # existing private dir is fine
            loose = Path(td) / "loose"
            loose.mkdir()
            os.chmod(loose, 0o777)
            with self.assertRaises(SystemExit):
                pim.prepare_out_dir(loose)
            link = Path(td) / "link"
            link.symlink_to(fresh)
            with self.assertRaises(SystemExit):
                pim.prepare_out_dir(link)


if __name__ == "__main__":
    unittest.main(verbosity=2)
