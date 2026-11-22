"""Train the shipped language identifier.

python tools/lid/train.py --data <data-dir> --bits 16 [--epochs 2] [--limit N] [--save NAME]

Multinomial logistic regression over mean-pooled hashed features (featurize.mjs,
reduced from 2^20 to 2^bits buckets), lazy Adam on the rows a batch touches,
label smoothing 0.1. Temperature fitted on the even dev lines, checked (ECE)
on the odd ones. Int8 per-bucket quantization. Writes nothing into the
repository: tools/lid/install.py puts a saved model in the extension, with a
parity fixture drawn from the Tatoeba bench only (never a chat line).
"""
import argparse
import json
import pathlib
import struct
import time

import numpy as np

SMOOTH = 0.1


def load(feat: pathlib.Path, name: str, bits: int):
    idx = np.fromfile(feat / f'{name}.idx', dtype=np.int32)
    idx &= (1 << bits) - 1  # in place: a 2 GB train.idx must fit twice in an 8 GB VM otherwise
    off = np.fromfile(feat / f'{name}.off', dtype=np.int32).astype(np.int64)
    rows = json.loads((feat / f'{name}.json').read_text(encoding='utf-8'))
    return idx, off, rows


def batch_logits(W, b, idx, off, lo, hi):
    s, e = off[lo], off[hi]
    seg = idx[s:e]
    starts = off[lo:hi] - s
    counts = np.diff(off[lo:hi + 1]).astype(np.float32)
    nz = counts > 0
    z = np.zeros((hi - lo, W.shape[1]), dtype=np.float32)
    if len(seg):
        summed = np.add.reduceat(W[seg], starts[nz], axis=0)
        z[nz] = summed / counts[nz, None]
    return z + b, seg, starts, counts


def softmax(z):
    z = z - z.max(axis=1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(axis=1, keepdims=True)


def train(idx, off, y, C, bits, epochs, lr, seed=0, bs=8192):
    rng = np.random.default_rng(seed)
    B = 1 << bits
    W = np.zeros((B, C), dtype=np.float32)
    b = np.zeros(C, dtype=np.float32)
    mW, vW = np.zeros_like(W), np.zeros_like(W)
    mb, vb = np.zeros_like(b), np.zeros_like(b)
    tW = np.zeros(B, dtype=np.int64)
    step = 0
    n = len(y)
    order = np.arange(0, n, bs)
    b1, b2, eps = 0.9, 0.999, 1e-8
    for ep in range(epochs):
        t0 = time.time()
        loss_sum = 0.0
        for lo in rng.permutation(order):
            hi = min(lo + bs, n)
            z, seg, starts, counts = batch_logits(W, b, idx, off, lo, hi)
            p = softmax(z)
            target = np.full_like(p, SMOOTH / C)
            target[np.arange(hi - lo), y[lo:hi]] += 1 - SMOOTH
            loss_sum += float(-(target * np.log(p + 1e-9)).sum())
            g = (p - target) / (hi - lo)
            step += 1
            gb = g.sum(axis=0)
            mb[:] = b1 * mb + (1 - b1) * gb
            vb[:] = b2 * vb + (1 - b2) * gb * gb
            b -= lr * (mb / (1 - b1 ** step)) / (np.sqrt(vb / (1 - b2 ** step)) + eps)
            if not len(seg):
                continue
            per_row = np.repeat(g / np.maximum(counts, 1)[:, None], counts.astype(np.int64), axis=0)
            order_f = np.argsort(seg, kind='stable')
            sseg = seg[order_f]
            uniq, first = np.unique(sseg, return_index=True)
            gW = np.add.reduceat(per_row[order_f], first, axis=0)
            # lazy Adam: decay the moments of touched rows for the steps they missed
            gap = (step - tW[uniq]).astype(np.float32)[:, None]
            mW[uniq] = (b1 ** gap) * mW[uniq] * 1 + (1 - b1) * gW
            vW[uniq] = (b2 ** gap) * vW[uniq] + (1 - b2) * gW * gW
            tW[uniq] = step
            W[uniq] -= lr * (mW[uniq] / (1 - b1 ** step)) / (np.sqrt(vW[uniq] / (1 - b2 ** step)) + eps)
        print(f'epoch {ep} loss {loss_sum / n:.4f} {time.time() - t0:.0f}s', flush=True)
    return W, b


def quantize(W):
    scale = np.abs(W).max(axis=1) / 127
    scale[scale == 0] = 1
    q = np.clip(np.round(W / scale[:, None]), -127, 127).astype(np.int8)
    return q, scale.astype(np.float32)


def logits_q(q, scale, b, idx, off):
    Wd = q.astype(np.float32) * scale[:, None]
    out = []
    for lo in range(0, len(off) - 1, 4096):
        hi = min(lo + 4096, len(off) - 1)
        out.append(batch_logits(Wd, b, idx, off, lo, hi)[0])
    return np.concatenate(out)


def fit_temperature(z, y):
    best = (1e9, 1.0)
    for T in np.exp(np.linspace(np.log(0.2), np.log(5), 60)):
        p = softmax(z / T)
        nll = float(-np.log(p[np.arange(len(y)), y] + 1e-9).mean())
        best = min(best, (nll, float(T)))
    return best[1]


def ece(p, y, bins=10):
    conf = p.max(axis=1)
    right = p.argmax(axis=1) == y
    e = 0.0
    for i in range(bins):
        m = (conf > i / bins) & (conf <= (i + 1) / bins)
        if m.any():
            e += m.mean() * abs(right[m].mean() - conf[m].mean())
    return e


def serialize(q, scale, b, labels, T):
    B, C = q.shape
    out = bytearray(b'LID1')
    out += struct.pack('<IIf', B, C, T)
    for l in labels:
        enc = l.encode('utf-8')
        out += bytes([len(enc)]) + enc
    out += b.astype('<f4').tobytes() + scale.astype('<f4').tobytes() + q.tobytes()
    h = 0x811C9DC5
    for byte in out:
        h = ((h ^ byte) * 0x01000193) & 0xFFFFFFFF
    out += struct.pack('<I', h)
    return bytes(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True)
    ap.add_argument('--bits', type=int, default=16)
    ap.add_argument('--epochs', type=int, default=2)
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--lr', type=float, default=0.2)
    ap.add_argument('--save', help='name under <data>/lid/models/')
    ap.add_argument('--src', default='lid', help='folder under <data> whose feat/ holds train and valid')
    a = ap.parse_args()
    feat = pathlib.Path(a.data) / 'lid' / 'feat'
    tfeat = pathlib.Path(a.data) / a.src / 'feat'
    idx, off, rows = load(tfeat, 'train', a.bits)
    labels = sorted({r['lang'] for r in rows})
    L = {l: i for i, l in enumerate(labels)}
    y = np.array([L[r['lang']] for r in rows], dtype=np.int64)
    if a.limit:
        off = off[: a.limit + 1]
        y = y[: a.limit]
    W, b = train(idx, off, y, len(labels), a.bits, a.epochs, a.lr)
    q, scale = quantize(W)
    report = {'lr': a.lr, 'epochs': a.epochs, 'bits': a.bits, 'rows': len(y), 'labels': len(labels)}
    for name in ('valid', 'bench'):
        i2, o2, r2 = load(tfeat if name == 'valid' else feat, name, a.bits)
        z = logits_q(q, scale, b, i2, o2)
        y2 = np.array([L.get(r['lang'], -1) for r in r2])
        report[f'{name}_acc'] = float((z.argmax(1) == y2)[y2 >= 0].mean())
    i3, o3, r3 = load(feat, 'dev', a.bits)
    zd = logits_q(q, scale, b, i3, o3)
    yd = np.array([L.get(r['lang'] or '', -1) for r in r3])
    keep = np.where(yd >= 0)[0]
    even, odd = keep[::2], keep[1::2]
    T = fit_temperature(zd[even], yd[even])
    report.update(dev_acc=float((zd.argmax(1) == yd)[keep].mean()), temperature=T,
                  ece_odd_raw=ece(softmax(zd[odd]), yd[odd]), ece_odd_cal=ece(softmax(zd[odd] / T), yd[odd]))
    print(json.dumps(report), flush=True)
    blob = serialize(q, scale, b, labels, T)
    if a.save:
        models = pathlib.Path(a.data) / 'lid' / 'models'
        models.mkdir(exist_ok=True)
        (models / f'{a.save}.bin').write_bytes(blob)
        (models / f'{a.save}.json').write_text(json.dumps(report), encoding='utf-8')


if __name__ == '__main__':
    main()
