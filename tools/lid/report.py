"""Evaluation-only report for the review dossier: no training, existing models and dev only.

python tools/lid/report.py --data <data-dir> [--models accrom-b16,st1-b16,st-twitch-b16,st-kick-b16] [--out report.json]

For each model, plain and with the causal per-channel adaptation (k=10, sure 0.9), the best grid point
under the wrong-deletion constraint (as cost.py / adapt.py pick it), then:
- paired bootstrap 95 % CI of the cost gain against master and against the first model, resampling
  real channels (file:channel) and, for comparison, capture files (what cost.py does);
- wrong deletions per reader x path, master -> model;
- per-language accuracy, wrong deletions and top confusions (path none);
- short band (<= 20 chars) cost, ECE from the training report;
- what the decision does on the dev lines left out of the cost (neutral, other, mixed, null).
"""
import argparse
import collections
import json
import pathlib
import random
import sys

import numpy as np

import adapt
import blob
import cost

PATHS = ('none', 'chrome', 'firefox')


def boot(diff, groups, n=2000, seed=0):
    """95 % CI of mean(diff), resampling whole groups."""
    by = collections.defaultdict(list)
    for d, g in zip(diff, groups):
        by[g].append(d)
    keys, rng, means = list(by), random.Random(seed), []
    for _ in range(n):
        s = [x for k in (rng.choice(keys) for _ in keys) for x in by[k]]
        means.append(sum(s) / len(s))
    means.sort()
    return round(means[int(0.025 * n)], 4), round(means[int(0.975 * n)], 4), len(keys)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default=r'C:\Users\kil\kct-data')
    ap.add_argument('--models', default='accrom-b16,st1-b16,st-twitch-b16,st-kick-b16')
    ap.add_argument('--k', type=float, default=10)
    ap.add_argument('--sure', type=float, default=0.9)
    ap.add_argument('--out', default='report.json')
    a = ap.parse_args()
    d = pathlib.Path(a.data)
    feat = d / 'lid' / 'feat'
    T = json.loads((d / 'detect' / 'texts.json').read_text(encoding='utf-8'))
    rows = T['sets']['dev']
    raw = [json.loads(l) for l in (d / 'dev.jsonl').read_text(encoding='utf-8').splitlines() if l]
    assert len(raw) == len(rows) and all(r['text'].split()[-1] in x['text'] for r, x in zip(rows, raw) if r['text'].strip())  # bench text drops emotes and mentions, 'dev order differs'
    ans = json.loads((d / 'lid' / 'answers-dev.json').read_text(encoding='utf-8'))['dev']
    cld = {br: json.loads((d / 'detect' / f'answers-{br}.json').read_text(encoding='utf-8'))['out'] for br in ('chrome', 'firefox')}
    bench = T['sets']['tatoeba']
    supported = {r['gold'] for r in bench} | {cost.base(r['gold']) for r in bench}
    keep = [k for k, r in enumerate(rows) if r['gold'] not in cost.NOT_LANG]
    out_of_cost = [k for k, r in enumerate(rows) if r['gold'] in cost.NOT_LANG]
    texts, golds = [rows[k]['text'] for k in keep], [rows[k]['gold'] for k in keep]
    ch = [raw[k]['ch'] for k in keep]
    cap = [c.split(':')[0] for c in ch]
    short = [len(t) <= 20 for t in texts]

    def ev(dec):
        return {q: cost.evaluate(texts, golds, [dec[k] for k in keep], q, cld, supported) for q in PATHS}

    master_dec = [[c, c or m] for c, _, m in ans]
    base = ev(master_dec)
    rep = {'dev_lines': len(rows), 'in_cost': len(keep), 'channels': len(set(ch)), 'capture_files': len(set(cap)),
           'out_of_cost': dict(collections.Counter(str(rows[k]['gold']) for k in out_of_cost)), 'configs_tried': 0, 'models': {}}

    def summary(s):
        return {q: {'cost': round(float(np.mean(v[0])), 4),
                    'short_cost': round(float(np.mean([c for c, f in zip(v[0], short) if f])), 4),
                    'raw_wrong': int(sum(v[2])), 'silent': int(sum(v[3])), 'wrong_deletions': dict(v[1])} for q, v in s.items()}

    rep['master'] = summary(base)

    def excluded(dec):
        """Answers on dev lines left out of the cost, path none: how many get a language, and a reader target."""
        c = collections.defaultdict(collections.Counter)
        for k in out_of_cost:
            g, det = str(rows[k]['gold']), dec[k][1]
            c[g]['answered' if det else 'silent'] += 1
            if det and cost.base(det) in cost.TARGETS:
                c[g]['answered_a_reader_target'] += 1  # hidden for that reader, shown with a flag to the others
            if dec[k][0]:
                c[g]['sl_sent'] += 1
        return {g: dict(v) for g, v in c.items()}

    rep['master_out_of_cost'] = excluded(master_dec)
    first = {}  # tag -> (key, per-path evaluation) of the first model
    for name in a.models.split(','):
        m = blob.load(d / 'lid' / 'models' / f'{name}.bin')
        L = m['labels']
        pd, nzd = blob.probs(m, feat, 'dev')
        tc = collections.Counter(r['lang'] for r in blob.texts(feat, 'train'))
        prior_train = np.array([tc[l] for l in L], np.float64)
        prior_train /= prior_train.sum()
        pc, nzc = blob.probs(m, feat, 'captures')
        pri = adapt.causal_priors(d, raw, blob.texts(feat, 'captures'), pc, nzc, L, prior_train, a.sure, a.k)
        adj = pd.copy()
        for i, w in pri.items():
            adj[i] = pd[i] * (w / prior_train)
            adj[i] /= adj[i].sum()
        info = json.loads((d / 'lid' / 'models' / f'{name}.json').read_text(encoding='utf-8'))
        rep['models'][name] = {'temperature': info.get('temperature'), 'ece_odd_raw': info.get('ece_odd_raw'),
                               'ece_odd_cal': info.get('ece_odd_cal'), 'dev_acc_train_report': info.get('dev_acc')}
        for tag, P in (('plain', pd), ('adapted', adj)):
            best = None
            for below in ('silence', 'franc'):
                for dt in cost.GRID_DET:
                    for st in cost.GRID_SL:
                        rep['configs_tried'] += 1
                        dec = cost.decide(ans, P, nzd, L, dt, st, below)
                        s = ev(dec)
                        ok = all(s[q][1].get(t, 0) <= base[q][1].get(t, 0) for q in PATHS for t in base[q][1])
                        score = sum(float(np.mean(s[q][0])) for q in PATHS) / 3
                        if ok and (best is None or score < best[0]):
                            best = (score, (dt, st, below), dec, s)
            score, cfg, dec, s = best
            r = {'config': cfg, 'mean_cost': round(score, 4), 'paths': summary(s), 'out_of_cost': excluded(dec),
                 'ci_vs_master': {}}
            for q in PATHS:
                diff = [n - o for n, o in zip(s[q][0], base[q][0])]
                r['ci_vs_master'][q] = {'by_channel': boot(diff, ch), 'by_capture_file': boot(diff, cap)}
            per = collections.defaultdict(collections.Counter)
            conf = collections.Counter()
            for j, k in enumerate(keep):
                g, det = cost.base(golds[j]), dec[k][1]
                per[g]['n'] += 1
                per[g]['right'] += det is not None and cost.base(det) == g
                per[g]['silent'] += det is None
                if det is not None and cost.base(det) != g:
                    conf[f'{g}->{cost.base(det)}'] += 1
            r['per_language'] = {g: dict(v) for g, v in sorted(per.items(), key=lambda x: -x[1]['n'])}
            r['top_confusions'] = conf.most_common(15)
            key = f'{name}/{tag}'
            if tag not in first:
                first[tag] = (key, s)
            else:
                r['ci_vs_' + first[tag][0]] = {q: boot([n - o for n, o in zip(s[q][0], first[tag][1][q][0])], ch) for q in PATHS}
            rep['models'][name][tag] = r
            print(key, cfg, round(score, 4), {q: r['ci_vs_master'][q]['by_channel'] for q in PATHS}, flush=True)
    pathlib.Path(a.out).write_text(json.dumps(rep, indent=1, ensure_ascii=False), encoding='utf-8')
    print('configs tried', rep['configs_tried'], '->', a.out)


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    if '--selftest' in sys.argv:
        lo, hi, n = boot([1.0, 1.0, -1.0, -1.0], ['a', 'a', 'b', 'b'], n=200)
        assert n == 2 and lo == -1.0 and hi == 1.0
        print('report ok')
    else:
        main()
