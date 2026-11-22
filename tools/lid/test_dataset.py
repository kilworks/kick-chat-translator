import unittest

from dataset import LeakError, assert_no_leak, build, excluded_texts
from features import normalize


class DatasetTest(unittest.TestCase):
    def test_injected_bench_sentence_is_dropped(self):
        bench = 'Ich habe keine Zeit.'
        rows = build({'de': ['Das ist gut.', bench]}, {normalize(bench)})
        self.assertNotIn(normalize(bench), {normalize(r['text']) for r in rows})
        self.assertIn('Das ist gut.', [r['text'] for r in rows])

    def test_leak_guard_raises(self):
        with self.assertRaises(LeakError):
            assert_no_leak([{'text': 'Hola amigo', 'lang': 'es'}], {normalize('hola amigo')})

    def test_bench_size_checked(self):
        with self.assertRaises(LeakError):
            excluded_texts({'sets': {'dev': [], 'heldout': [], 'tatoeba': [{'text': 'x', 'gold': 'en'}]}})

    def test_normalize(self):
        self.assertEqual(normalize('  JAJAJAJA  sooooo   123 https://x.y/z '), 'jajajaja soo 00 u')


if __name__ == '__main__':
    unittest.main()
