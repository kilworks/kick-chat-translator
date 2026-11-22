"""Self-training set (E9): pseudo-labeled chat added to a Tatoeba training set.

python tools/lid/pseudo.py --data <data-dir> --model accrom-b16 --base lid-accrom --out lid-st \
    [--sure 0.9] [--cap 30000] [--mode agree|model]

Reads <data>/lid/feat/pool.* (tools/lid/pool.mjs). A chat line becomes a
training row labeled with the model's answer when that answer is sure
(p >= --sure) and, in --mode agree, also matches the language the channel
declares: two independent signals, so the model's own confident mistakes are
not fed back unless the channel agrees. --cap bounds each language so English
does not drown the rest. Writes <data>/<out>/train.jsonl (base rows + pseudo
rows) and copies valid.jsonl. Dev, heldout and bench are never touched.
"""
import argparse
import collections
import pathlib
import shutil

import json
import numpy as np

import blob

# Kick declares languages by name, Twitch by code; both map onto model labels.
# 'English (India)' is left out: its chat mixes romanized Hindi and English, so
# agreeing on 'en' fed Hinglish back as English (112 of 381 Kick 'en' rows, E9).
KICK = {'Arabic': 'ar', 'Bulgarian': 'bg', 'Bengali': 'bn', 'Catalan': 'ca', 'Czech': 'cs', 'Danish': 'da',
        'German': 'de', 'Greek': 'el', 'English': 'en', 'Spanish': 'es', 'Estonian': 'et',
        'Persian': 'fa', 'Finnish': 'fi', 'French': 'fr', 'Hebrew': 'he', 'Hindi': 'hi', 'Hungarian': 'hu',
        'Indonesian': 'id', 'Italian': 'it', 'Japanese': 'ja', 'Korean': 'ko', 'Lithuanian': 'lt', 'Latvian': 'lv',
        'Malay': 'ms', 'Dutch': 'nl', 'Norwegian': 'no', 'Polish': 'pl', 'Portuguese': 'pt', 'Romanian': 'ro',
        'Russian': 'ru', 'Slovak': 'sk', 'Slovenian': 'sl', 'Swedish': 'sv', 'Tamil': 'ta', 'Thai': 'th',
        'Filipino': 'tl', 'Turkish': 'tr', 'Ukrainian': 'uk', 'Vietnamese': 'vi', 'Chinese': 'zh'}


def declared(row, labels):
    d = row['decl']
    code = KICK.get(d) if row['src'] == 'kick' else d
    return code if code in labels else None


def select(p, nz, rows, labels, sure, cap, mode, seed=0):
    """Indices and labels of the pool rows kept, at most cap per language (random among the kept)."""
    best = p.argmax(1)
    keep = collections.defaultdict(list)
    for i, r in enumerate(rows):
        if not nz[i] or p[i, best[i]] < sure:
            continue
        lab = labels[best[i]]
        if mode == 'agree' and declared(r, labels) != lab:
            continue
        keep[lab].append(i)
    rng = np.random.default_rng(seed)
    out = []
    for lab, ids in keep.items():
        ids = list(rng.permutation(ids))[:cap]
        out += [(int(i), lab) for i in ids]
    return out


def write_feat(base, pool, out, picked, copies, seed=0):
    """Base training features + picked pool rows (x copies), every row shuffled.

    train.py shuffles batches, not rows: rows appended at the end made pure-chat batches holding
    the copies of one line side by side. Features are the pool's own (same 2^20 hashing)."""
    out.mkdir(parents=True, exist_ok=True)
    bi = np.fromfile(base / 'train.idx', dtype=np.int32)
    bo = np.fromfile(base / 'train.off', dtype=np.int32).astype(np.int64)
    brow = json.loads((base / 'train.json').read_text(encoding='utf-8'))
    pi = np.fromfile(pool / 'pool.idx', dtype=np.int32)
    po = np.fromfile(pool / 'pool.off', dtype=np.int32).astype(np.int64)
    prow = json.loads((pool / 'pool.json').read_text(encoding='utf-8'))
    # every row as (source, start, end, row dict)
    starts = np.concatenate([bo[:-1], np.repeat([po[i] for i, _ in picked], copies)]).astype(np.int64)
    ends = np.concatenate([bo[1:], np.repeat([po[i + 1] for i, _ in picked], copies)]).astype(np.int64)
    src = np.concatenate([np.zeros(len(brow), np.int8), np.ones(len(picked) * copies, np.int8)])
    meta = brow + [{'text': prow[i]['text'], 'lang': lab} for i, lab in picked for _ in range(copies)]
    order = np.random.default_rng(seed).permutation(len(meta))
    lens = (ends - starts)[order]
    off = np.zeros(len(order) + 1, np.int64)
    np.cumsum(lens, out=off[1:])
    assert off[-1] < 2 ** 31, 'offsets are int32 on disk'
    idx = np.empty(off[-1], np.int32)
    for k, r in enumerate(order):
        arr = bi if src[r] == 0 else pi
        idx[off[k]:off[k + 1]] = arr[starts[r]:ends[r]]
    idx.tofile(out / 'train.idx')
    off.astype(np.int32).tofile(out / 'train.off')
    (out / 'train.json').write_text(json.dumps([meta[r] for r in order], ensure_ascii=False), encoding='utf-8')
    for ext in ('idx', 'off', 'json'):
        shutil.copyfile(base / f'valid.{ext}', out / f'valid.{ext}')
    print('feat rows', len(order), 'features', int(off[-1]), flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True)
    ap.add_argument('--model', required=True)
    ap.add_argument('--base', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--sure', type=float, default=0.9)
    ap.add_argument('--cap', type=int, default=30000)
    ap.add_argument('--mode', choices=['agree', 'model'], default='agree')
    ap.add_argument('--copies', type=int, default=1, help='repeat each pseudo row (weight against the Tatoeba rows)')
    ap.add_argument('--only', choices=['kick', 'twitch'], help='keep pseudo rows from one platform only')
    ap.add_argument('--feat', action='store_true',
                    help='write <out>/feat directly from the base features and pool.* (no featurize run), rows shuffled')
    a = ap.parse_args()
    d = pathlib.Path(a.data)
    m = blob.load(d / 'lid' / 'models' / f'{a.model}.bin')
    p, nz = blob.probs(m, d / 'lid' / 'feat', 'pool')
    rows = blob.texts(d / 'lid' / 'feat', 'pool')
    picked = select(p, nz, rows, m['labels'], a.sure, a.cap, a.mode)
    if a.only:  # leakage control: dev comes from Kick captures, Twitch shares no channel with it
        picked = [(i, lab) for i, lab in picked if rows[i]['src'] == a.only]
    out = d / a.out
    out.mkdir(exist_ok=True)
    c = collections.Counter(lab for _, lab in picked)
    print('pool', len(rows), 'picked', len(picked), 'languages', len(c), c.most_common(12), flush=True)
    if a.feat:
        write_feat(d / a.base / 'feat', d / 'lid' / 'feat', out / 'feat', picked, a.copies)
        return
    shutil.copyfile(d / a.base / 'valid.jsonl', out / 'valid.jsonl')
    with open(out / 'train.jsonl', 'w', encoding='utf-8', newline='\n') as f:
        f.write((d / a.base / 'train.jsonl').read_text(encoding='utf-8'))
        for i, lab in picked:
            for _ in range(a.copies):
                f.write(json.dumps({'text': rows[i]['text'], 'lang': lab}, ensure_ascii=False) + '\n')
    c = collections.Counter(lab for _, lab in picked)
    print('pool', len(rows), 'picked', len(picked), 'languages', len(c), c.most_common(12))


if __name__ == '__main__':
    labs = ['en', 'fr']
    pr = np.array([[0.95, 0.05], [0.95, 0.05], [0.6, 0.4], [0.02, 0.98]])
    rs = [{'decl': 'English', 'src': 'kick'}, {'decl': 'fr', 'src': 'twitch'}, {'decl': 'en', 'src': 'twitch'}, {'decl': 'fr', 'src': 'twitch'}]
    assert sorted(select(pr, np.ones(4, bool), rs, labs, 0.9, 10, 'agree')) == [(0, 'en'), (3, 'fr')]
    assert len(select(pr, np.ones(4, bool), rs, labs, 0.9, 10, 'model')) == 3
    main()
