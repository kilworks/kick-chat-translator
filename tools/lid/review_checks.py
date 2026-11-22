"""Evaluation-only checks for the LID review (dev and unlabeled pool, never heldout).

python tools/lid/review_checks.py <repo> <data> <mask.json> [A] [B] [C]
(mask.json: written by tools/lid/prefilter.mjs)
A: cost of master / accrom-b16 plain and adapted, best config under the deletion constraint,
   with silence weight 0.5 and 0, on all 711 in-cost dev lines and on those reaching detection.
B: causal per-channel adaptation on the unlabeled pool: how often a confident plain answer is
   overturned, by number of confident lines already seen in the channel.
C: romanized-Hindi markers among the pseudo-label candidates of each source.
Only counts are printed: no chat line, no channel.
"""
import collections
import json
import pathlib
import re
import sys

import numpy as np

repo, data, mask_path = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2]), sys.argv[3]
parts = set(sys.argv[4:]) or {'A', 'B', 'C'}
sys.path.insert(0, str(repo / 'tools' / 'lid'))
import adapt  # noqa: E402
import blob  # noqa: E402
import cost  # noqa: E402

sys.stdout.reconfigure(encoding='utf-8')
PATHS = ('none', 'chrome', 'firefox')
feat = data / 'lid' / 'feat'
m = blob.load(data / 'lid' / 'models' / 'accrom-b16.bin')
L = m['labels']
tc = collections.Counter(r['lang'] for r in blob.texts(feat, 'train'))
pt = np.array([tc[l] for l in L], np.float64)
pt /= pt.sum()

if 'A' in parts:
    T = json.loads((data / 'detect' / 'texts.json').read_text(encoding='utf-8'))
    rows, bench = T['sets']['dev'], T['sets']['tatoeba']  # only dev and the public Tatoeba bench are touched
    del T
    raw = [json.loads(l) for l in (data / 'dev.jsonl').read_text(encoding='utf-8').splitlines() if l]
    mask = json.loads(pathlib.Path(mask_path).read_text(encoding='utf-8'))
    assert len(raw) == len(rows) == len(mask)
    ans = json.loads((data / 'lid' / 'answers-dev.json').read_text(encoding='utf-8'))['dev']
    cld = {br: json.loads((data / 'detect' / f'answers-{br}.json').read_text(encoding='utf-8'))['out'] for br in ('chrome', 'firefox')}
    supported = {r['gold'] for r in bench} | {cost.base(r['gold']) for r in bench}
    pd, nzd = blob.probs(m, feat, 'dev')
    pc, nzc = blob.probs(m, feat, 'captures')
    pri = adapt.causal_priors(data, raw, blob.texts(feat, 'captures'), pc, nzc, L, pt, 0.9, 10)
    adj = pd.copy()
    for i, w in pri.items():
        adj[i] = pd[i] * (w / pt)
        adj[i] /= adj[i].sum()
    print(f'A: causal prior found for {len(pri)} of {len(raw)} dev lines')
    master_dec = [[c, c or ms] for c, _, ms in ans]
    neutral = [k for k, r in enumerate(rows) if r['gold'] == 'neutral']

    def run(keep):
        texts, golds = [rows[k]['text'] for k in keep], [rows[k]['gold'] for k in keep]
        ev = lambda dec: {q: cost.evaluate(texts, golds, [dec[k] for k in keep], q, cld, supported) for q in PATHS}
        base = ev(master_dec)
        out = {'master': {q: float(np.mean(base[q][0])) for q in PATHS}}
        for tag, P in (('plain', pd), ('adapted', adj)):
            best = None
            for below in ('silence', 'franc'):
                for dt in cost.GRID_DET:
                    for st in cost.GRID_SL:
                        dec = cost.decide(ans, P, nzd, L, dt, st, below)
                        s = ev(dec)
                        ok = all(s[q][1].get(t, 0) <= base[q][1].get(t, 0) for q in PATHS for t in base[q][1])
                        sc = sum(float(np.mean(s[q][0])) for q in PATHS) / 3
                        if ok and (best is None or sc < best[0]):
                            best = (sc, (dt, st, below), {q: float(np.mean(s[q][0])) for q in PATHS}, dec)
            out[tag] = best
        return out

    in_cost = [k for k, r in enumerate(rows) if r['gold'] not in cost.NOT_LANG]
    reach = [k for k in in_cost if mask[k]]
    for w in (0.5, 0.0):
        cost.COST['silence'] = w
        for name, keep in (('711 in-cost', in_cost), (f'{len(reach)} reaching detection', reach)):
            o = run(keep)
            line = f"silence={w} {name}: master " + ' '.join(f'{q} {v:.3f}' for q, v in o['master'].items())
            for tag in ('plain', 'adapted'):
                sc, cfg, per, dec = o[tag]
                line += f" | {tag} {cfg} " + ' '.join(f'{q} {v:.3f}' for q, v in per.items())
                if w == 0.5 and tag == 'adapted':
                    sl_neu = sum(1 for k in neutral if dec[k][0])
                    sl_neu_reach = sum(1 for k in neutral if dec[k][0] and mask[k])
                    line += f' | neutral with sl {sl_neu}, of which reach detection {sl_neu_reach}'
            print(line, flush=True)
    cost.COST['silence'] = 0.5
    sure = [k for k in in_cost if nzd[k] and pd[k].max() >= 0.9]
    right = sum(1 for k in sure if cost.base(L[int(pd[k].argmax())]) == cost.base(rows[k]['gold']))
    print(f'A: plain p>=0.9 on dev in-cost lines: {len(sure)} lines, right {right} ({right / len(sure):.1%})')

if 'B' in parts or 'C' in parts:
    prow = blob.texts(feat, 'pool')
    pp, nzp = blob.probs(m, feat, 'pool')
    top = pp.argmax(1)
    pmax = pp.max(1)

if 'B' in parts:
    by = collections.defaultdict(list)
    for i, r in enumerate(prow):
        by[r['ch']].append(i)
    edges = [0, 10, 50, 200, 1000, 10 ** 9]
    agg = collections.defaultdict(collections.Counter)
    sizes = sorted(len(v) for v in by.values())
    for idx in by.values():
        idx = np.array(idx)
        p = pp[idx]
        s = nzp[idx] & (pmax[idx] >= 0.9)
        onehot = np.zeros_like(p)
        onehot[np.arange(len(idx))[s], top[idx][s]] = 1
        C = np.cumsum(onehot, 0) - onehot  # confident lines strictly before
        n = C.sum(1)
        pi = (C + 10 * pt) / (n + 10)[:, None]
        a = p * pi / pt
        a /= a.sum(1, keepdims=True)
        at, am = a.argmax(1), a.max(1)
        b = np.digitize(n, edges) - 1
        for j in range(len(idx)):
            if not nzp[idx[j]]:
                continue
            c = agg[b[j]]
            c['lines'] += 1
            flip = at[j] != top[idx[j]]
            if s[j]:
                c['sure'] += 1
                c['sure_flipped'] += flip
                c['sure_flipped_to_sl'] += flip and am[j] >= 0.95
            c['sl_by_adaptation_other_than_plain'] += flip and am[j] >= 0.95
    print(f'B: pool channels {len(by)}, lines per channel median {sizes[len(sizes) // 2]}, p90 {sizes[int(len(sizes) * 0.9)]}, max {sizes[-1]}')
    for bi in range(len(edges) - 1):
        c = agg[bi]
        if not c['lines']:
            continue
        print(f"B: confident lines seen before in [{edges[bi]}, {edges[bi + 1]}): lines {c['lines']}, confident {c['sure']}, "
              f"confident overturned {c['sure_flipped']} ({c['sure_flipped'] / max(1, c['sure']):.2%}), "
              f"of which sl-level {c['sure_flipped_to_sl']}; all lines given sl on a language the plain model did not pick "
              f"{c['sl_by_adaptation_other_than_plain']} ({c['sl_by_adaptation_other_than_plain'] / c['lines']:.2%})")

if 'C' in parts:
    MARK = set('hai hain nahi nhi nahin kya kyu kyun bhai yaar kar karo raha rahi tha thi mera meri tera teri kaise accha acha '
               'bhi kuch matlab abhi bohot bahut hoga gaya sab yeh woh aur chal dekh pagal sahi'.split())
    word = re.compile(r'[a-z]+')
    en = L.index('en')
    groups = {
        'twitch decl en, candidate (en p>=0.9)': lambda r, i: r['src'] == 'twitch' and r['decl'] == 'en' and top[i] == en and pmax[i] >= 0.9,
        'kick English (India), en p>=0.9 [control +]': lambda r, i: r['src'] == 'kick' and r['decl'] == 'English (India)' and top[i] == en and pmax[i] >= 0.9,
        'kick English, candidate [control -]': lambda r, i: r['src'] == 'kick' and r['decl'] == 'English' and top[i] == en and pmax[i] >= 0.9,
        'twitch decl de, en p>=0.9 [control -]': lambda r, i: r['src'] == 'twitch' and r['decl'] == 'de' and top[i] == en and pmax[i] >= 0.9,
    }
    for name, f in groups.items():
        n = hits = 0
        chans = collections.Counter()
        for i, r in enumerate(prow):
            if not nzp[i] or not f(r, i):
                continue
            n += 1
            if len(MARK & set(word.findall(r['text'].lower()))) >= 2:
                hits += 1
                chans[r['ch']] += 1
        top10 = sum(v for _, v in chans.most_common(10))
        print(f'C: {name}: {n} lines, >=2 Hindi markers {hits} ({hits / max(1, n):.2%}), '
              f'channels {len(chans)}, top-10 channels hold {top10}')
    # witness: does the marker test fire on Hindi-declared chat at all, and what does the model say there
    for name, f in (('kick English (India), all lines', lambda r: r['src'] == 'kick' and r['decl'] == 'English (India)'),
                    ('twitch decl hi, all lines', lambda r: r['src'] == 'twitch' and r['decl'] == 'hi'),
                    ('twitch decl en, all lines', lambda r: r['src'] == 'twitch' and r['decl'] == 'en')):
        n = hits = 0
        said = collections.Counter()
        for i, r in enumerate(prow):
            if not nzp[i] or not f(r):
                continue
            n += 1
            if len(MARK & set(word.findall(r['text'].lower()))) >= 2:
                hits += 1
                said[(L[top[i]], 'sure' if pmax[i] >= 0.9 else 'unsure')] += 1
        print(f'C witness: {name}: {n} lines, >=2 markers {hits} ({hits / max(1, n):.2%}); model on those: {said.most_common(6)}')
