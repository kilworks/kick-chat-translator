"""Read a LID1 weight blob (format in src/content/lid/model.ts) and score featurized sets."""
import json
import pathlib
import struct

import numpy as np


def parse(blob: bytes):
    if blob[:4] == b'LID2':
        return parse_mlp(blob)
    assert blob[:4] == b'LID1'
    B, C, T = struct.unpack_from('<IIf', blob, 4)
    o = 16
    labels = []
    for _ in range(C):
        n = blob[o]
        labels.append(blob[o + 1:o + 1 + n].decode('utf-8'))
        o += 1 + n
    bias = np.frombuffer(blob, '<f4', C, o)
    o += 4 * C
    scale = np.frombuffer(blob, '<f4', B, o)
    o += 4 * B
    q = np.frombuffer(blob, np.int8, B * C, o).reshape(B, C)
    return {'B': B, 'labels': labels, 'T': T, 'bias': bias, 'W': q.astype(np.float32) * scale[:, None]}


def parse_mlp(blob: bytes):
    B, D, H, C, T = struct.unpack_from('<IIIIf', blob, 4)
    o = 24
    labels = []
    for _ in range(C):
        n = blob[o]
        labels.append(blob[o + 1:o + 1 + n].decode('utf-8'))
        o += 1 + n

    def take(dtype, n):
        nonlocal o
        a = np.frombuffer(blob, dtype, n, o)
        o += a.itemsize * n
        return a
    scale = take('<f4', B)
    E = take(np.int8, B * D).reshape(B, D).astype(np.float32) * scale[:, None]
    b1, W1 = take('<f4', H), take('<f4', D * H).reshape(D, H)
    b2, W2 = take('<f4', C), take('<f4', H * C).reshape(H, C)
    return {'B': B, 'labels': labels, 'T': T, 'mlp': (E, b1, W1, b2, W2)}


def probs(model, feat_dir: pathlib.Path, name: str):
    """Calibrated probabilities for every row of a featurized set (rows without features: None)."""
    idx = np.fromfile(feat_dir / f'{name}.idx', dtype=np.int32) & (model['B'] - 1)
    off = np.fromfile(feat_dir / f'{name}.off', dtype=np.int32).astype(np.int64)
    n = len(off) - 1
    counts = np.diff(off)
    nz = counts > 0
    if 'mlp' in model:
        E, b1, W1, b2, W2 = model['mlp']
        x = np.zeros((n, E.shape[1]), dtype=np.float64)
        if len(idx):
            x[nz] = np.add.reduceat(E[idx], off[:-1][nz], axis=0) / counts[nz, None]
        z = (np.maximum(x @ W1 + b1, 0) @ W2 + b2) / model['T']
    else:
        z = np.zeros((n, len(model['labels'])), dtype=np.float64)
        if len(idx):
            z[nz] = np.add.reduceat(model['W'][idx], off[:-1][nz], axis=0) / counts[nz, None]
        z = (z + model['bias']) / model['T']
    z -= z.max(axis=1, keepdims=True)
    p = np.exp(z)
    p /= p.sum(axis=1, keepdims=True)
    return p, nz


def load(path: pathlib.Path):
    return parse(path.read_bytes())


def texts(feat_dir: pathlib.Path, name: str):
    return json.loads((feat_dir / f'{name}.json').read_text(encoding='utf-8'))
