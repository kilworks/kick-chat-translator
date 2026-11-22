"""Yardstick: fastText lid.176 (Facebook, CC BY-SA 3.0, never shipped) dropped into the same decision
and cost as our model, on dev. Evaluation only.

python tools/lid/ft_bench.py --data <data-dir> --ft <dir>/lid.176.ftz [--like accrom-b16]

Its 176-language probabilities are cut to our label set (renormalised), lines with no letter stay
silent as for our model, then the same grid under the same wrong-deletion constraint.
"""
import argparse
import json
import pathlib
import sys

import numpy as np

import blob
import cost


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default=r'C:\Users\kil\kct-data')
    ap.add_argument('--ft', required=True)
    ap.add_argument('--like', default='accrom-b16', help='model whose label set and no-feature mask are reused')
    a = ap.parse_args()
    import fasttext
    ft = fasttext.load_model(a.ft)
    d = pathlib.Path(a.data)
    m = blob.load(d / 'lid' / 'models' / f'{a.like}.bin')
    L = m['labels']
    _, nz = blob.probs(m, d / 'lid' / 'feat', 'dev')
    T = json.loads((d / 'detect' / 'texts.json').read_text(encoding='utf-8'))
    rows = T['sets']['dev']
    ans = json.loads((d / 'lid' / 'answers-dev.json').read_text(encoding='utf-8'))['dev']
    cld = {br: json.loads((d / 'detect' / f'answers-{br}.json').read_text(encoding='utf-8'))['out'] for br in ('chrome', 'firefox')}
    bench = T['sets']['tatoeba']
    supported = {r['gold'] for r in bench} | {cost.base(r['gold']) for r in bench}
    idx = {l: i for i, l in enumerate(L)}
    P = np.zeros((len(rows), len(L)))
    for i, r in enumerate(rows):
        # ft.predict breaks on numpy 2 (copy=False); the raw binding returns (prob, label) pairs
        for p, lab in ft.f.predict(r['text'].replace('\n', ' ').lower() + '\n', -1, 0.0, 'strict'):
            c = cost.code(lab.replace('__label__', ''))
            if c in idx:
                P[i, idx[c]] += p
        P[i] = P[i] / P[i].sum() if P[i].sum() > 0 else 1 / len(L)
    keep = [k for k, r in enumerate(rows) if r['gold'] not in cost.NOT_LANG]
    texts, golds = [rows[k]['text'] for k in keep], [rows[k]['gold'] for k in keep]
    top = [L[P[k].argmax()] for k in keep]
    print('labels outside fastText:', [l for l in L if l not in {cost.code(x.replace('__label__', '')) for x in ft.get_labels()}])
    print(f'raw argmax right {sum(cost.base(t) == cost.base(g) for t, g in zip(top, golds))} / {len(keep)}')

    def ev(dec):
        return {q: cost.evaluate(texts, golds, [dec[k] for k in keep], q, cld, supported) for q in ('none', 'chrome', 'firefox')}

    base = ev([[c, c or ms] for c, _, ms in ans])
    best = None
    for below in ('silence', 'franc'):
        for dt in cost.GRID_DET:
            for st in cost.GRID_SL:
                s = ev(cost.decide(ans, P, nz, L, dt, st, below))
                ok = all(s[q][1].get(t, 0) <= base[q][1].get(t, 0) for q in s for t in base[q][1])
                score = sum(float(np.mean(v[0])) for v in s.values()) / 3
                if ok and (best is None or score < best[0]):
                    best = (score, (dt, st, below), s)
    score, cfg, s = best
    print('fastText', cfg, f'{score:.4f}', {q: (round(float(np.mean(v[0])), 4), int(sum(v[2])), int(sum(v[3]))) for q, v in s.items()})


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
