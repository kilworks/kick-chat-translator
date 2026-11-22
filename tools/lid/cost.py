"""Cost of language detection errors, as the pipeline pays them.

python tools/lid/cost.py --data <data-dir> --model NAME [--set dev|heldout] [--pick det,sl,below]

Reads answers-<set>.json (answers.mjs: looked-up answer, rule answer before
the model, master answer), the model <data>/lid/models/NAME.bin applied to the
featurized texts (featurize.mjs), and the stored browser answers
(detect/answers-chrome.json, answers-firefox.json, keyed by text).
Three paths: none (no browser detector, Brave), chrome, firefox, which apply
the detectLanguageWithBrowser rule of src/content/langDetect.ts.

Cost table (spec, fixed before measurement): wrong deletion 10, wrong cloud
`sl` 5, wrong flag 1, silence (cloud detects) 0.5, right 0. The on-device
source cost (4) does not apply: the default engine mode is cloud-first.
Readers: fr es pt de en ru tr ar with default settings (ignoreEnglish on),
plus one fr reader with source allowlist en es pt.
"""
import argparse
import collections
import json
import pathlib
import random
import re
import sys

import numpy as np

import blob

sys.stdout.reconfigure(encoding='utf-8')
TARGETS = ['fr', 'es', 'pt', 'de', 'en', 'ru', 'tr', 'ar']
ALLOW = {'en', 'es', 'pt'}
NOT_LANG = {'neutral', 'other', 'mixed', None, ''}
NON_EN_LETTER = re.compile(r'[^\W\d_A-Za-z]')  # hasNonEnglishLetter: a letter outside A-Z
COST = {'deletion': 10, 'sl': 5, 'flag': 1, 'silence': 0.5, 'kept_unwanted': 1}


def base(c):
    return c.split('-')[0] if c else c


def code(c):
    c = c.lower()
    if c in ('zh-tw', 'zh-hant'):
        return 'zh-tw'
    if c in ('zh-cn', 'zh-hans'):
        return 'zh'
    return {'iw': 'he', 'nb': 'no', 'nn': 'no', 'in': 'id', 'fil': 'tl'}.get(c, c)


def browser_rule(conf, guess, cld, supported):
    """detectLanguageWithBrowser, given confidentLanguage, detectLanguage and the browser answer."""
    if conf or cld is None:
        return guess
    langs = cld.get('languages') or []
    first = code(langs[0]['language']) if langs else None
    if cld.get('reliable') and first and first in supported:
        return first
    return guess if guess == first else None


def line_cost(text, gold, conf, det, target, allow=None):
    """Cost of one line for one reader; also says whether it was a wrong deletion."""
    g = base(gold)
    if allow is None and target == 'en' and det == 'en' and not NON_EN_LETTER.search(text):
        return (0, False) if g == 'en' else (COST['deletion'], True)
    if conf and base(conf) == base(target):
        return (0, False) if g == base(target) else (COST['deletion'], True)
    if allow is not None:
        dropped = det is None or det not in allow
        if dropped:
            return (COST['deletion'], True) if g in allow else (0, False)
        if g not in allow:
            return COST['kept_unwanted'], False
    c = 0.0
    if g == base(target):
        c += COST['silence']  # translated for nothing, comes back identical
    elif conf is None:
        c += COST['silence']
    elif base(conf) != g:
        c += COST['sl']
    if det is not None and base(det) != g:
        c += COST['flag']
    return c, False


def evaluate(texts, golds, answers, path, cld, supported):
    """Per line: mean cost over readers, wrong deletions per reader, raw-answer error."""
    per_line, dels, wrong, silent = [], collections.Counter(), [], []
    for i, (text, gold) in enumerate(zip(texts, golds)):
        conf, guess = answers[i]
        det = guess if path == 'none' else browser_rule(conf, guess, cld[path].get(text), supported)
        total = 0.0
        for t in TARGETS:
            c, d = line_cost(text, gold, conf, det, t)
            total += c
            dels[t] += d
        c, d = line_cost(text, gold, conf, det, 'fr', ALLOW)
        total += c
        dels['fr+allow'] += d
        per_line.append(total / (len(TARGETS) + 1))
        wrong.append(det is not None and base(det) != base(gold))
        silent.append(det is None)
    return per_line, dels, wrong, silent


def bootstrap(diff, groups, n=1000, seed=0):
    by = collections.defaultdict(list)
    for d, g in zip(diff, groups):
        by[g].append(d)
    keys = list(by)
    rng = random.Random(seed)
    means = []
    for _ in range(n):
        s = [x for k in (rng.choice(keys) for _ in keys) for x in by[k]]
        means.append(sum(s) / len(s))
    means.sort()
    return means[int(0.025 * n)], means[int(0.975 * n)]


GRID_DET = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.98]
GRID_SL = [float('inf'), 0.9, 0.95, 0.98, 0.99, 0.995]


def decide(answers, probs, nz, labels, det_t, sl_t, below):
    """[confident, detected] per text, as langDetect.ts decides them for these thresholds."""
    top = probs.argmax(axis=1)
    pmax = probs.max(axis=1)
    out = []
    for i, (conf, pre, master) in enumerate(answers):
        lang = labels[top[i]] if nz[i] else None
        c = conf or (lang if lang and pmax[i] >= sl_t else None)
        if c:
            d = c
        elif pre:
            d = pre
        elif not nz[i]:
            d = master
        elif pmax[i] >= det_t:
            d = lang
        else:
            d = master if below == 'franc' else None
        out.append([c, d])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True)
    ap.add_argument('--model', required=True)
    ap.add_argument('--set', default='dev')
    ap.add_argument('--pick')
    ap.add_argument('--top', type=int, default=12)
    a = ap.parse_args()
    data = pathlib.Path(a.data)
    T = json.loads((data / 'detect' / 'texts.json').read_text(encoding='utf-8'))
    allt = T['all']
    cld = {}
    for br in ('chrome', 'firefox'):
        out = json.loads((data / 'detect' / f'answers-{br}.json').read_text(encoding='utf-8'))['out']
        cld[br] = out  # keyed by text
    ans = json.loads((data / 'lid' / f'answers-{a.set}.json').read_text(encoding='utf-8'))
    model = blob.load(data / 'lid' / 'models' / f'{a.model}.bin')
    feat = data / 'lid' / 'feat'
    P = {a.set: blob.probs(model, feat, a.set), 'bench': blob.probs(model, feat, 'bench')}
    raw = [json.loads(l) for l in (data / f'{a.set}.jsonl').read_text(encoding='utf-8').splitlines() if l]
    rows = T['sets'][a.set]
    keep = [k for k, r in enumerate(rows) if r['gold'] not in NOT_LANG]
    bench = T['sets']['tatoeba']
    supported = {r['gold'] for r in bench} | {base(r['gold']) for r in bench}
    chat = ([rows[k]['text'] for k in keep], [rows[k]['gold'] for k in keep])
    groups = [raw[k]['ch'].split(':')[0] for k in keep]
    short = [len(t) <= 20 for t in chat[0]]
    btexts, bgolds = [r['text'] for r in bench], [r['gold'] for r in bench]

    def score(cfg):
        p, nz = P[a.set]
        d_chat = decide(ans[a.set], p, nz, model['labels'], *cfg)
        pb, nzb = P['bench']
        d_bench = decide(ans['bench'], pb, nzb, model['labels'], *cfg)
        sel = [d_chat[k] for k in keep]
        return ({q: evaluate(*chat, sel, q, cld, supported) for q in ('none', 'chrome', 'firefox')},
                {q: evaluate(btexts, bgolds, d_bench, q, cld, supported) for q in ('none', 'chrome', 'firefox')})

    def master_cfg_answers(name):
        return [[c, c or m] for c, _, m in ans[name]]

    base_s = {q: evaluate(*chat, [master_cfg_answers(a.set)[k] for k in keep], q, cld, supported)
              for q in ('none', 'chrome', 'firefox')}
    base_b = {q: evaluate(btexts, bgolds, master_cfg_answers('bench'), q, cld, supported)
              for q in ('none', 'chrome', 'firefox')}
    mean = lambda s: {q: sum(v[0]) / len(v[0]) for q, v in s.items()}
    dels = lambda s: {q: dict(v[1]) for q, v in s.items()}
    fmt = lambda d: '{' + ', '.join(f'{q}: {v:.4f}' for q, v in d.items()) + '}'
    print(f'model {a.model} set {a.set} lines {len(keep)}')
    print('master   chat', fmt(mean(base_s)), 'bench', fmt(mean(base_b)))
    if not a.pick:
        ranked = []
        for below in ('silence', 'franc'):
            for dt in GRID_DET:
                for st in GRID_SL:
                    s, b = score((dt, st, below))
                    ok = all(dels(s)[q].get(t, 0) <= dels(base_s)[q].get(t, 0) for q in s for t in dels(base_s)[q])
                    ranked.append((sum(mean(s).values()) / 3, ok, (dt, st, below), mean(s), mean(b)))
        ranked.sort(key=lambda x: x[0])
        for m, ok, cfg, sc, bc in ranked[: a.top]:
            print(f'{m:.4f} deletions_ok={ok} {cfg} chat {fmt(sc)} bench {fmt(bc)}')
        return
    dt, st, below = a.pick.split(',')
    s, b = score((float(dt), float(st), below))
    for q in ('none', 'chrome', 'firefox'):
        new, old = s[q][0], base_s[q][0]
        lo, hi = bootstrap([n - o for n, o in zip(new, old)], groups)
        sh = lambda v: sum(c for c, f in zip(v, short) if f) / max(1, sum(short))
        fixed = sum(1 for x, y in zip(base_s[q][2], s[q][2]) if x and not y)
        broke = sum(1 for x, y in zip(base_s[q][2], s[q][2]) if y and not x)
        chi2 = (abs(fixed - broke) - 1) ** 2 / (fixed + broke) if fixed + broke else 0.0
        bm, bo = sum(b[q][0]) / len(b[q][0]), sum(base_b[q][0]) / len(base_b[q][0])
        print(f'[{q}] chat {sum(old) / len(old):.4f} -> {sum(new) / len(new):.4f} diff95 [{lo:+.4f}, {hi:+.4f}]'
              f' short {sh(old):.4f} -> {sh(new):.4f} bench {bo:.4f} -> {bm:.4f}')
        print(f'     raw wrong {sum(base_s[q][2])} -> {sum(s[q][2])} / {len(new)} (fixed {fixed}, broke {broke}, McNemar chi2 {chi2:.1f})')
        print(f'     silent {sum(1 for x in s[q][3] if x)} (master {sum(1 for x in base_s[q][3] if x)})')
        print(f'     wrong deletions {dels(base_s)[q]} -> {dels(s)[q]}')


if __name__ == '__main__':
    main()
