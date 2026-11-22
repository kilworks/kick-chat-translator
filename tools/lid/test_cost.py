import json
import pathlib
import unittest

from cost import line_cost


class CostRulesTest(unittest.TestCase):
    def test_cases_match_pipeline(self):
        cases = json.loads((pathlib.Path(__file__).parent / 'cost-cases.json').read_text(encoding='utf-8'))
        for c in cases:
            allow = set(c['allow']) if 'allow' in c else None
            # A gold that differs from everything, so any deletion is a wrong one.
            _, deleted = line_cost(c['text'], 'xx', c['conf'], c['det'], c['target'], allow)
            if allow is not None and 'xx' not in allow:
                # an unwanted language dropped is the right call, not a wrong deletion; probe with an allowed gold
                _, deleted = line_cost(c['text'], 'en', c['conf'], c['det'], c['target'], allow)
            self.assertEqual(deleted, c['deleted'], c)


if __name__ == '__main__':
    unittest.main()
