import unittest


class TestImport(unittest.TestCase):
    def test_import_spectyra(self):
        from spectyra import Spectyra, SpectyraConfig

        s = Spectyra(SpectyraConfig(mode="runtime"))
        self.assertTrue(s._runtime_url().startswith("http"))


if __name__ == "__main__":
    unittest.main()
