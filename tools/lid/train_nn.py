"""Train the neural language identifier (CLD3-like, numpy, hand-written backprop).

python tools/lid/train_nn.py --data <data-dir> --bits 16 --dim 32 --hidden 128 [--epochs 3] [--save NAME]

Architecture: hashed n-gram features (featurize.mjs) -> learned embedding of
dimension D per bucket -> mean -> dense H + ReLU -> dense C -> softmax.
Lazy Adam on the embedding rows a batch touches, Adam on the dense layers,
label smoothing 0.1, temperature fitted on even dev lines, ECE on odd ones.
Embedding quantized int8 per row; dense layers kept float32 (small).

Blob format LID2, little endian: "LID2", u32 B, u32 D, u32 H, u32 C,
f32 temperature, labels (u8 length + UTF-8), f32 scale[B], int8 E[B*D],
f32 b1[H], f32 W1[D*H], f32 b2[C], f32 W2[H*C], u32 FNV-1a checksum.
"""
import argparse
import json
import pathlib
import struct
import time

import numpy as np

from train import SMOOTH, ece, fit_temperature, load, softmax

B1, B2, EPS = 0.9, 0.999, 1e-8


class Adam:
    def __init__(self, shape):
        self.m = np.zeros(shape, np.float32)
        self.v = np.zeros(shape, np.float32)

    def step(self, p, g, lr, t):
        self.m = B1 * self.m + (1 - B1) * g
        self.v = B2 * self.v + (1 - B2) * g * g
        p -= lr * (self.m / (1 - B1 ** t)) / (np.sqrt(self.v / (1 - B2 ** t)) + EPS)


def embed(E, idx, off, lo, hi):
    s, e = off[lo], off[hi]
    seg = idx[s:e]
    starts = off[lo:hi] - s
    counts = np.diff(off[lo:hi + 1]).astype(np.float32)
    nz = counts > 0
    x = np.zeros((hi - lo, E.shape[1]), np.float32)
    if len(seg):
        x[nz] = np.add.reduceat(E[seg], starts[nz], axis=0) / counts[nz, None]
    return x, seg, counts


def forward(P, x):
    a1 = x @ P['W1'] + P['b1']
    h = np.maximum(a1, 0)
    return h @ P['W2'] + P['b2'], a1, h


def train(idx, off, y, C, bits, D, H, epochs, lr, seed=0, bs=4096):
    rng = np.random.default_rng(seed)
    B = 1 << bits
    P = {
        'E': (rng.standard_normal((B, D)) * 0.1).astype(np.float32),
        'W1': (rng.standard_normal((D, H)) * np.sqrt(2 / D)).astype(np.float32),
        'b1': np.zeros(H, np.float32),
        'W2': (rng.standard_normal((H, C)) * np.sqrt(1 / H)).astype(np.float32),
        'b2': np.zeros(C, np.float32),
    }
    opt = {k: Adam(v.shape) for k, v in P.items() if k != 'E'}
    mE, vE = np.zeros((B, D), np.float32), np.zeros((B, D), np.float32)
    tE = np.zeros(B, np.int64)
    n = len(y)
    t = 0
    for ep in range(epochs):
        t0 = time.time()
        loss = 0.0
        lr_ep = lr * (0.5 ** ep)
        for lo in rng.permutation(np.arange(0, n, bs)):
            hi = min(lo + bs, n)
            x, seg, counts = embed(P['E'], idx, off, lo, hi)
            z, a1, h = forward(P, x)
            p = softmax(z)
            tgt = np.full_like(p, SMOOTH / C)
            tgt[np.arange(hi - lo), y[lo:hi]] += 1 - SMOOTH
            loss += float(-(tgt * np.log(p + 1e-9)).sum())
            g = ((p - tgt) / (hi - lo)).astype(np.float32)
            t += 1
            dh = g @ P['W2'].T
            da1 = dh * (a1 > 0)
            grads = {'W2': h.T @ g, 'b2': g.sum(0), 'W1': x.T @ da1, 'b1': da1.sum(0)}
            dx = da1 @ P['W1'].T
            for k, gk in grads.items():
                opt[k].step(P[k], gk, lr_ep, t)
            if not len(seg):
                continue
            rows = np.repeat(dx / np.maximum(counts, 1)[:, None], counts.astype(np.int64), axis=0)
            order = np.argsort(seg, kind='stable')
            uniq, first = np.unique(seg[order], return_index=True)
            gE = np.add.reduceat(rows[order], first, axis=0)
            gap = (t - tE[uniq]).astype(np.float32)[:, None]
            mE[uniq] = (B1 ** gap) * mE[uniq] + (1 - B1) * gE
            vE[uniq] = (B2 ** gap) * vE[uniq] + (1 - B2) * gE * gE
            tE[uniq] = t
            P['E'][uniq] -= lr_ep * (mE[uniq] / (1 - B1 ** t)) / (np.sqrt(vE[uniq] / (1 - B2 ** t)) + EPS)
        print(f'epoch {ep} loss {loss / n:.4f} {time.time() - t0:.0f}s', flush=True)
    return P


def quantize(P):
    scale = np.abs(P['E']).max(axis=1) / 127
    scale[scale == 0] = 1
    q = np.clip(np.round(P['E'] / scale[:, None]), -127, 127).astype(np.int8)
    Q = dict(P)
    Q['E'] = q.astype(np.float32) * scale[:, None]
    return Q, q, scale.astype(np.float32)


def logits(P, idx, off):
    out = []
    for lo in range(0, len(off) - 1, 4096):
        hi = min(lo + 4096, len(off) - 1)
        x, _, _ = embed(P['E'], idx, off, lo, hi)
        out.append(forward(P, x)[0])
    return np.concatenate(out)


def serialize(P, q, scale, labels, T):
    B, D = q.shape
    H, C = P['W2'].shape
    out = bytearray(b'LID2') + struct.pack('<IIIIf', B, D, H, C, T)
    for l in labels:
        enc = l.encode('utf-8')
        out += bytes([len(enc)]) + enc
    for arr in (scale, q, P['b1'], P['W1'], P['b2'], P['W2']):
        out += arr.astype('<f4').tobytes() if arr.dtype != np.int8 else arr.tobytes()
    h = 0x811C9DC5
    for byte in out:
        h = ((h ^ byte) * 0x01000193) & 0xFFFFFFFF
    return bytes(out + struct.pack('<I', h))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True)
    ap.add_argument('--src', default='lid')
    ap.add_argument('--bits', type=int, default=16)
    ap.add_argument('--dim', type=int, default=32)
    ap.add_argument('--hidden', type=int, default=128)
    ap.add_argument('--epochs', type=int, default=3)
    ap.add_argument('--lr', type=float, default=0.01)
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--save')
    a = ap.parse_args()
    data = pathlib.Path(a.data)
    feat, tfeat = data / 'lid' / 'feat', data / a.src / 'feat'
    idx, off, rows = load(tfeat, 'train', a.bits)
    labels = sorted({r['lang'] for r in rows})
    L = {l: i for i, l in enumerate(labels)}
    y = np.array([L[r['lang']] for r in rows], np.int64)
    if a.limit:
        off, y = off[: a.limit + 1], y[: a.limit]
    P = train(idx, off, y, len(labels), a.bits, a.dim, a.hidden, a.epochs, a.lr)
    Q, q, scale = quantize(P)
    rep = {'arch': 'mlp', 'bits': a.bits, 'dim': a.dim, 'hidden': a.hidden, 'epochs': a.epochs, 'lr': a.lr,
           'rows': len(y), 'src': a.src}
    for name, fd in (('valid', tfeat), ('bench', feat)):
        i2, o2, r2 = load(fd, name, a.bits)
        y2 = np.array([L.get(r['lang'], -1) for r in r2])
        rep[f'{name}_acc'] = float((logits(Q, i2, o2).argmax(1) == y2)[y2 >= 0].mean())
    i3, o3, r3 = load(feat, 'dev', a.bits)
    zd = logits(Q, i3, o3)
    yd = np.array([L.get(r['lang'] or '', -1) for r in r3])
    keep = np.where(yd >= 0)[0]
    even, odd = keep[::2], keep[1::2]
    T = fit_temperature(zd[even], yd[even])
    rep.update(dev_acc=float((zd.argmax(1) == yd)[keep].mean()), temperature=T,
               ece_odd_raw=ece(softmax(zd[odd]), yd[odd]), ece_odd_cal=ece(softmax(zd[odd] / T), yd[odd]))
    blob = serialize(Q, q, scale, labels, T)
    rep['bytes'] = len(blob)
    print(json.dumps(rep), flush=True)
    if a.save:
        models = data / 'lid' / 'models'
        models.mkdir(exist_ok=True)
        (models / f'{a.save}.bin').write_bytes(blob)
        (models / f'{a.save}.json').write_text(json.dumps(rep), encoding='utf-8')


if __name__ == '__main__':
    main()
