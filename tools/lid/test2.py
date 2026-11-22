"""Score models on test2 (tools/lid/test2.mjs): fresh chat lines labeled by two annotators, kept where they agree.

python tools/lid/test2.py --data <data-dir> --ref st2tw-b16 --models st3tw-lin-e2,st3tw-lr003-d32-h128-e3 [--path adapted]

Each model keeps the thresholds it gets on the even dev lines (adapt.measure, half=even, k=10 causal): nothing here
is chosen on test2. Causal adaptation as on dev: the prior of a line comes from the confident answers on the
lines of its channel strictly before it, counted over every test2 line (<data>/lid/feat/test2all). Three paths as on
dev: none (Brave), chrome and firefox (their detectors' answers on these lines: <data>/lid/test2/answers-<br>.json,
from kct-data/detect/run.mjs --texts). Per model: mean cost on the language lines, then each model against --ref,
paired difference with a 95 % bootstrap over channels, on the mean of the 3 paths and on Brave alone.
The goal's bar: the whole interval below 0.
"""
import argparse
import collections
import json
import pathlib

import numpy as np

import adapt
import blob
import cost

PATHS = ('none', 'chrome', 'firefox')


def score(d, name, ans, sample, rows, keep, golds, texts, cld, supported):
    m = blob.load(d / 'lid' / 'models' / f'{name}.bin')
    L = m['labels']
    r = adapt.measure(argparse.Namespace(data=str(d), model=name, sure=0.9, k=10, key='ch', causal=True, first=0,
                                         half='even'))
    tc = collections.Counter(x['lang'] for x in blob.texts(d / 'lid' / 'feat', 'train'))
    prior_train = np.array([tc[l] for l in L], np.float64)
    prior_train /= prior_train.sum()
    p, nz = blob.probs(m, d / 'lid' / 'feat', 'test2all')
    want = {s['row'] for s in sample}
    counts, prior = collections.defaultdict(lambda: np.zeros(len(L))), {}
    for i, x in enumerate(rows):  # file order: a channel's earlier lines come first
        c = counts[x['ch']]
        if i in want:
            prior[i] = (c + 10 * prior_train) / (c.sum() + 10)
        if nz[i] and p[i].max() >= 0.9:
            c[p[i].argmax()] += 1
    idx = [s['row'] for s in sample]
    P, NZ = p[idx], nz[idx]
    adj = P * np.stack([prior[i] for i in idx]) / prior_train
    adj /= adj.sum(axis=1, keepdims=True)
    out = {}
    for tag, Q in (('plain', P), ('adapted', adj)):
        _, det, sl = r[tag][:3]
        dec = cost.decide(ans, Q, NZ, L, det, sl, 'silence')
        paths = {q: cost.evaluate(texts, golds, [dec[k] for k in keep], q, cld, supported) for q in PATHS}
        per = [sum(c) / len(PATHS) for c in zip(*(v[0] for v in paths.values()))]
        out[tag] = (per, paths['none'][0], {q: float(np.mean(v[0])) for q, v in paths.items()},
                    sum(paths['none'][1].values()), det, sl)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True)
    ap.add_argument('--ref', default='st2tw-b16')
    ap.add_argument('--models', required=True, help='comma-separated names under <data>/lid/models')
    ap.add_argument('--path', default='adapted', choices=['adapted', 'plain'])
    a = ap.parse_args()
    d = pathlib.Path(a.data)
    sample = json.loads((d / 'lid' / 'test2' / 'sample.json').read_text(encoding='utf-8'))
    gold = json.loads((d / 'lid' / 'test2' / 'gold.json').read_text(encoding='utf-8'))
    rows = blob.texts(d / 'lid' / 'feat', 'test2all')
    ans = json.loads((d / 'lid' / 'answers-test2.json').read_text(encoding='utf-8'))['test2']
    assert len(ans) == len(sample)
    cld = {br: json.loads((d / 'lid' / 'test2' / f'answers-{br}.json').read_text(encoding='utf-8'))['out'] for br in PATHS[1:]}
    bench = json.loads((d / 'detect' / 'texts.json').read_text(encoding='utf-8'))['sets']['tatoeba']
    supported = {r['gold'] for r in bench} | {cost.base(r['gold']) for r in bench}
    keep = [k for k, s in enumerate(sample) if gold.get(s['id']) not in cost.NOT_LANG]
    golds = [gold[sample[k]['id']] for k in keep]
    texts = [rows[sample[k]['row']]['text'] for k in keep]
    groups = [rows[sample[k]['row']]['ch'] for k in keep]
    master = [[c, c or ms] for c, _, ms in (ans[k] for k in keep)]
    shipped = {q: float(np.mean(cost.evaluate(texts, golds, master, q, cld, supported)[0])) for q in PATHS}
    print(f'test2: {len(keep)} language lines, {len(set(groups))} channels; shipped rules (master) '
          + ' '.join(f'{q} {v:.4f}' for q, v in shipped.items()))
    res = {n: score(d, n, ans, sample, rows, keep, golds, texts, cld, supported) for n in [a.ref] + a.models.split(',')}
    for n, s in res.items():
        print(f'{n:32s} ' + '  '.join(f'{t} {np.mean(v[0]):.4f} (' + ' '.join(f'{q} {m:.4f}' for q, m in v[2].items())
                                       + f', Brave del {v[3]}, det {v[4]} sl {v[5]})' for t, v in s.items()))
    for n in a.models.split(','):
        for label, i in (('3 navigateurs', 0), ('Brave', 1)):
            old, new = res[a.ref][a.path][i], res[n][a.path][i]
            lo, hi = cost.bootstrap([x - y for x, y in zip(new, old)], groups)
            verdict = 'GAGNE' if hi < 0 else ('PERD' if lo > 0 else 'non tranche')
            print(f'{a.path}, {label}: {a.ref} {np.mean(old):.4f} -> {n} {np.mean(new):.4f}  diff95 [{lo:+.4f}, {hi:+.4f}]  {verdict}')


if __name__ == '__main__':
    main()
