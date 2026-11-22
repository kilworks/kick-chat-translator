"""Per-channel prior adaptation, simulated.

python tools/lid/adapt.py --data <data-dir> --model NAME [--sure 0.9] [--k 50]

In the extension a channel's chat would teach its own language mix: count the
model's confident answers (p >= sure) on that channel, and shift the bias by
log(pi_channel / pi_train). Simulation: for each dev line, the counts come from
the captured lines of the same channel only (captures.mjs already excludes every
dev and heldout text), never from the line itself or its label. The channel key
is the capture's declared channel language, used as a grouping id only.
pi_channel = (counts + k * pi_train) / (n + k): k pseudo-lines of the training
prior, so a channel with few lines barely moves.
"""
import argparse
import collections
import json
import pathlib

import numpy as np

import blob
import cost


def channel_priors(p, nz, keys, L, prior_train, sure, k, first=0):
    counts = collections.defaultdict(lambda: np.zeros(len(L)))
    seen = collections.Counter()
    for i, key in enumerate(keys):
        seen[key] += 1
        if first and seen[key] > first:
            continue
        if nz[i] and p[i].max() >= sure:
            counts[key][p[i].argmax()] += 1
    return {key: (c + k * prior_train) / (c.sum() + k) for key, c in counts.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True)
    ap.add_argument('--model', required=True)
    ap.add_argument('--sure', type=float, default=0.9)
    ap.add_argument('--k', type=float, default=50)
    ap.add_argument('--first', type=int, default=0, help='only the first N captured lines of each channel (warm-up)')
    a = ap.parse_args()
    d = pathlib.Path(a.data)
    m = blob.load(d / 'lid' / 'models' / f'{a.model}.bin')
    L = m['labels']
    feat = d / 'lid' / 'feat'
    tc = collections.Counter(r['lang'] for r in blob.texts(feat, 'train'))
    prior_train = np.array([tc[l] for l in L], np.float64)
    prior_train /= prior_train.sum()
    pc, nzc = blob.probs(m, feat, 'captures')
    caps = blob.texts(feat, 'captures')
    pri = channel_priors(pc, nzc, [r['lang'] for r in caps], L, prior_train, a.sure, a.k, a.first)

    T = json.loads((d / 'detect' / 'texts.json').read_text(encoding='utf-8'))
    raw = [json.loads(l) for l in (d / 'dev.jsonl').read_text(encoding='utf-8').splitlines() if l]
    ans = json.loads((d / 'lid' / 'answers-dev.json').read_text(encoding='utf-8'))['dev']
    pd, nzd = blob.probs(m, feat, 'dev')
    adj = pd.copy()
    for i, r in enumerate(raw):
        w = pri.get(r['decl'])
        if w is not None:
            adj[i] = pd[i] * (w / prior_train)
            adj[i] /= adj[i].sum()
    cld = {br: json.loads((d / 'detect' / f'answers-{br}.json').read_text(encoding='utf-8'))['out'] for br in ('chrome', 'firefox')}
    rows = T['sets']['dev']
    keep = [k for k, r in enumerate(rows) if r['gold'] not in cost.NOT_LANG]
    bench = T['sets']['tatoeba']
    supported = {r['gold'] for r in bench} | {cost.base(r['gold']) for r in bench}
    chat = ([rows[k]['text'] for k in keep], [rows[k]['gold'] for k in keep])
    master = [[c, c or ms] for c, _, ms in ans]
    base_s = {q: cost.evaluate(*chat, [master[k] for k in keep], q, cld, supported) for q in ('none', 'chrome', 'firefox')}
    best = []
    for P, tag in ((pd, 'plain'), (adj, 'adapted')):
        for dt in cost.GRID_DET:
            for st in cost.GRID_SL:
                dec = cost.decide(ans, P, nzd, L, dt, st, 'silence')
                s = {q: cost.evaluate(*chat, [dec[k] for k in keep], q, cld, supported) for q in ('none', 'chrome', 'firefox')}
                ok = all(s[q][1].get(t, 0) <= base_s[q][1].get(t, 0) for q in s for t in base_s[q][1])
                means = {q: float(np.mean(v[0])) for q, v in s.items()}
                best.append((sum(means.values()) / 3, ok, tag, dt, st, means))
    for tag, P in (('plain', pd), ('adapted', adj)):
        m0 = min((b for b in best if b[2] == tag and b[1]), key=lambda b: b[0])
        dec = cost.decide(ans, P, nzd, L, m0[3], m0[4], 'silence')
        sl_given = sum(1 for k in keep if dec[k][0])
        sl_wrong = sum(1 for k in keep if dec[k][0] and cost.base(dec[k][0]) != cost.base(rows[k]['gold']))
        print(f"{tag:8s} {m0[0]:.4f} det {m0[3]} sl {m0[4]} " + ' '.join(f'{q} {v:.4f}' for q, v in m0[5].items())
              + f' | sl given {sl_given}, wrong {sl_wrong}')
    print('channels with a prior', len(pri), 'dev lines covered', sum(1 for r in raw if r['decl'] in pri), '/', len(raw))


if __name__ == '__main__':
    main()
