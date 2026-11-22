"""Download full Tatoeba per-language exports for the product languages.

python tools/lid/fetch_tatoeba.py --data <data-dir>

Writes <data>/lid/tatoeba/<code>.txt, one sentence per line, at most CAP lines
per language, sampled uniformly over the whole export (reservoir, fixed seed).
Source: Tatoeba, CC BY 2.0 FR, https://tatoeba.org. The language map and the
simplified/traditional split are read from test/e2e/build-lang-corpus.mjs so
the two never drift apart.
"""
import argparse
import bz2
import pathlib
import random
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
CAP = 20000
URL = 'https://downloads.tatoeba.org/exports/per_language/{iso}/{iso}_sentences.tsv.bz2'


def corpus_config():
    src = (ROOT / 'test/e2e/build-lang-corpus.mjs').read_text(encoding='utf-8')
    block = re.search(r'const TATOEBA = \{(.*?)\};', src, re.S).group(1)
    langs = dict(re.findall(r"'?([a-z-]+)'?:\s*'([a-z]{3})'", block))
    trad = re.search(r'const TRAD_ONLY = /\[(.*?)\]/u', src).group(1)
    simp = re.search(r'const SIMP_ONLY = /\[(.*?)\]/u', src).group(1)
    return langs, set(trad), set(simp)


def stream(iso):
    req = urllib.request.Request(URL.format(iso=iso), headers={'User-Agent': 'lid-trainer'})
    with urllib.request.urlopen(req, timeout=120) as res:
        dec = bz2.BZ2Decompressor()
        buf = b''
        while chunk := res.read(1 << 16):
            buf += dec.decompress(chunk)
            *lines, buf = buf.split(b'\n')
            for line in lines:
                parts = line.decode('utf-8', 'replace').split('\t')
                if len(parts) >= 3 and parts[2].strip():
                    yield parts[2].strip()


def reservoir(items, cap, rng):
    out = []
    for i, x in enumerate(items):
        if i < cap:
            out.append(x)
        else:
            j = rng.randrange(i + 1)
            if j < cap:
                out[j] = x
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True)
    args = ap.parse_args()
    out = pathlib.Path(args.data) / 'lid' / 'tatoeba'
    out.mkdir(parents=True, exist_ok=True)
    langs, trad, simp = corpus_config()
    for code, iso in sorted(langs.items()):
        if (out / f'{code}.txt').exists():
            continue
        rng = random.Random(f'lid-{code}')
        if code == 'zh':
            zh, tw = [], []
            for s in stream(iso):
                t = any(c in trad for c in s)
                p = any(c in simp for c in s)
                if t and not p:
                    tw.append(s)
                elif p and not t:
                    zh.append(s)
            (out / 'zh.txt').write_text('\n'.join(reservoir(zh, CAP, rng)), encoding='utf-8', newline='\n')
            (out / 'zh-tw.txt').write_text('\n'.join(reservoir(tw, CAP, rng)), encoding='utf-8', newline='\n')
            print('zh', len(zh), 'zh-tw', len(tw), flush=True)
            continue
        lines = reservoir(stream(iso), CAP, rng)
        (out / f'{code}.txt').write_text('\n'.join(lines), encoding='utf-8', newline='\n')
        print(code, len(lines), flush=True)


if __name__ == '__main__':
    main()
