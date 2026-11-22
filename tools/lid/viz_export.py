"""Export aggregates for the research page (no chat line ever leaves: dev appears
only as counts; texts shown are Tatoeba bench sentences, CC BY 2.0 FR).

python tools/lid/viz_export.py --data <data-dir> --model NAME --out <dir>
Writes <out>/data.json and <out>/model.b64 (the weights, for the live demo).
"""
import argparse
import base64
import collections
import json
import pathlib

import numpy as np

import blob
import cost


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True)
    ap.add_argument('--model', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    d = pathlib.Path(a.data)
    out = pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    raw = (d / 'lid' / 'models' / f'{a.model}.bin').read_bytes()
    m = blob.parse(raw)
    L = m['labels']
    T = json.loads((d / 'detect' / 'texts.json').read_text(encoding='utf-8'))
    ans = json.loads((d / 'lid' / 'answers-dev.json').read_text(encoding='utf-8'))
    feat = d / 'lid' / 'feat'
    cld = {br: json.loads((d / 'detect' / f'answers-{br}.json').read_text(encoding='utf-8'))['out'] for br in ('chrome', 'firefox')}
    bench = T['sets']['tatoeba']
    supported = {r['gold'] for r in bench} | {cost.base(r['gold']) for r in bench}
    pb, nzb = blob.probs(m, feat, 'bench')
    pd, nzd = blob.probs(m, feat, 'dev')
    rows = T['sets']['dev']
    keep = [k for k, r in enumerate(rows) if r['gold'] not in cost.NOT_LANG]

    # Bench: per language accuracy, franc (master chain) vs model chain, and confusions.
    dec_b = cost.decide(ans['bench'], pb, nzb, L, 0.0, float('inf'), 'silence')  # model always answers
    per_lang = collections.defaultdict(lambda: {'n': 0, 'master': 0, 'model': 0})
    conf_model = collections.Counter()
    conf_master = collections.Counter()
    for i, r in enumerate(bench):
        g = r['gold']
        mst = ans['bench'][i][0] or ans['bench'][i][2]
        mdl = dec_b[i][1]
        per_lang[g]['n'] += 1
        per_lang[g]['master'] += cost.base(mst or '') == cost.base(g)
        per_lang[g]['model'] += cost.base(mdl or '') == cost.base(g)
        if mdl and cost.base(mdl) != cost.base(g):
            conf_model[(g, mdl)] += 1
        if mst and cost.base(mst) != cost.base(g):
            conf_master[(g, mst)] += 1

    # 2D map of the bench: PCA of log-probabilities.
    X = np.log(pb + 1e-9)
    X -= X.mean(0)
    _, _, vt = np.linalg.svd(X, full_matrices=False)
    xy = X @ vt[:2].T
    xy = (xy - xy.min(0)) / (xy.max(0) - xy.min(0))
    points = [{'x': round(float(xy[i, 0]), 4), 'y': round(float(xy[i, 1]), 4), 'g': bench[i]['gold'],
               'p': L[int(pb[i].argmax())], 't': bench[i]['text'][:80]} for i in range(len(bench))]

    # Dev, aggregated: cost by threshold for each path, master line, reliability bins.
    chat = ([rows[k]['text'] for k in keep], [rows[k]['gold'] for k in keep])
    master_dec = [[c, c or ms] for c, _, ms in ans['dev']]
    master_cost = {q: float(np.mean(cost.evaluate(*chat, [master_dec[k] for k in keep], q, cld, supported)[0]))
                   for q in ('none', 'chrome', 'firefox')}
    curve = []
    for dt in [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.98]:
        for st in (float('inf'), 0.95):
            dec = cost.decide(ans['dev'], pd, nzd, L, dt, st, 'silence')
            sel = [dec[k] for k in keep]
            curve.append({'det': dt, 'sl': 'off' if st == float('inf') else st,
                          **{q: float(np.mean(cost.evaluate(*chat, sel, q, cld, supported)[0])) for q in ('none', 'chrome', 'firefox')}})
    yd = np.array([L.index(rows[k]['gold']) if rows[k]['gold'] in L else -1 for k in keep])
    pk = pd[keep]
    ok = yd >= 0
    confd, right = pk[ok].max(1), pk[ok].argmax(1) == yd[ok]
    bins = []
    for i in range(10):
        s = (confd > i / 10) & (confd <= (i + 1) / 10)
        bins.append({'lo': i / 10, 'n': int(s.sum()), 'acc': float(right[s].mean()) if s.any() else None,
                     'conf': float(confd[s].mean()) if s.any() else None})

    data = {
        'model': {'name': a.model, 'bytes': len(raw), 'buckets': m['B'], 'labels': L, 'temperature': m['T']},
        'bench': {'per_lang': per_lang, 'confusions_model': [[g, p, n] for (g, p), n in conf_model.most_common(25)],
                  'confusions_master': [[g, p, n] for (g, p), n in conf_master.most_common(25)], 'points': points},
        'dev': {'lines': len(keep), 'master_cost': master_cost, 'curve': curve, 'reliability': bins},
        'research': (d / 'lid' / 'RECHERCHE.md').read_text(encoding='utf-8'),
    }
    (out / 'data.json').write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    (out / 'model.b64').write_text(base64.b64encode(raw).decode(), encoding='ascii')
    print('wrote', out / 'data.json', (out / 'data.json').stat().st_size, 'bytes')


if __name__ == '__main__':
    main()
