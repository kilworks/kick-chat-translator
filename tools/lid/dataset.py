"""Build the training set from the Tatoeba exports.

python tools/lid/dataset.py --data <data-dir>

Reads <data>/lid/tatoeba/*.txt (fetch_tatoeba.py) and <data>/detect/texts.json
(the realText of dev, heldout and the 5040-sentence bench, from prep.mjs).
Writes <data>/lid/train.jsonl and valid.jsonl with {"text", "lang"}.

Nothing evaluated may be trained on: every normalized text of dev, heldout and
the bench is excluded, and build() raises LeakError if one survives anyway.
Augmentation pulls written sentences toward chat register: lowercase without
punctuation, and short windows of 1 to 4 words.
"""
import argparse
import json
import pathlib
import random
import re

from features import normalize

PUNCT = re.compile(r'[^\w\s]', re.U)
BENCH_SIZE = 5040


class LeakError(Exception):
    pass


def chat_variants(sentence: str, rng: random.Random) -> list[str]:
    bare = PUNCT.sub(' ', sentence).lower().split()
    out = [' '.join(bare)] if bare else []
    if len(bare) > 2:
        n = rng.randint(1, min(4, len(bare) - 1))
        i = rng.randrange(len(bare) - n + 1)
        out.append(' '.join(bare[i:i + n]))
    return out


def excluded_texts(texts_json: dict) -> set[str]:
    sets = texts_json['sets']
    if len(sets['tatoeba']) != BENCH_SIZE:
        raise LeakError(f"bench has {len(sets['tatoeba'])} sentences, expected {BENCH_SIZE}")
    return {normalize(r['text']) for name in ('dev', 'heldout', 'tatoeba') for r in sets[name] if r['text']}


def build(sources: dict[str, list[str]], exclude: set[str], seed: int = 0) -> list[dict]:
    rng = random.Random(seed)
    seen: set[str] = set()
    rows = []
    for lang in sorted(sources):
        for s in sources[lang]:
            for text in [s, *chat_variants(s, rng)]:
                key = normalize(text)
                if not key or key in seen or key in exclude:
                    continue
                seen.add(key)
                rows.append({'text': text, 'lang': lang})
    rng.shuffle(rows)
    return rows


def assert_no_leak(rows: list[dict], exclude: set[str]) -> None:
    leaked = [r['text'] for r in rows if normalize(r['text']) in exclude]
    if leaked:
        raise LeakError(f'{len(leaked)} evaluated texts in training')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True)
    args = ap.parse_args()
    data = pathlib.Path(args.data)
    exclude = excluded_texts(json.loads((data / 'detect' / 'texts.json').read_text(encoding='utf-8')))
    sources = {
        p.stem: [l for l in p.read_text(encoding='utf-8').split('\n') if l.strip()]
        for p in sorted((data / 'lid' / 'tatoeba').glob('*.txt'))
    }
    rows = build(sources, exclude)
    assert_no_leak(rows, exclude)
    cut = len(rows) // 50
    for name, part in (('valid', rows[:cut]), ('train', rows[cut:])):
        with open(data / 'lid' / f'{name}.jsonl', 'w', encoding='utf-8', newline='\n') as f:
            for r in part:
                f.write(json.dumps(r, ensure_ascii=False) + '\n')
    print('languages', len(sources), 'train', len(rows) - cut, 'valid', cut, 'excluded keys', len(exclude))


if __name__ == '__main__':
    main()
