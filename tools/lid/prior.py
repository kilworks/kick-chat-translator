"""Estimate the language prior of real chat without labels (Saerens et al., 2002).

python tools/lid/prior.py --data <data-dir> --model NAME [--save NAME2]

The model is trained on Tatoeba, whose language mix is near uniform; Kick chat is
not. EM on the unlabeled captures (dev and heldout texts excluded, captures.mjs)
re-estimates the chat prior pi from the model's posteriors:
    p'(c|x) proportional to p(c|x) * pi_c / pi_train_c ;  pi_c = mean_x p'(c|x)
The correction is a bias shift (bias += T * log(pi / pi_train)), so it ships in
the same LID1 blob with no inference change. --save writes the shifted model.
Optional --shrink s in [0, 1] mixes the estimate with the training prior.
"""
import argparse
import collections
import json
import pathlib
import struct

import numpy as np

import blob


def em_prior(p, prior_train, iters=200, tol=1e-8):
    pi = prior_train.copy()
    for _ in range(iters):
        q = p * (pi / prior_train)
        q /= q.sum(axis=1, keepdims=True)
        new = q.mean(axis=0)
        if np.abs(new - pi).max() < tol:
            break
        pi = new
    return pi


def shifted_blob(raw: bytes, shift: np.ndarray) -> bytes:
    m = blob.parse(raw)
    C = len(m['labels'])
    o = 16 + sum(1 + len(l.encode('utf-8')) for l in m['labels'])
    bias = np.frombuffer(raw, '<f4', C, o) + shift.astype(np.float32)
    out = bytearray(raw[:-4])
    out[o:o + 4 * C] = bias.astype('<f4').tobytes()
    h = 0x811C9DC5
    for byte in out:
        h = ((h ^ byte) * 0x01000193) & 0xFFFFFFFF
    return bytes(out + struct.pack('<I', h))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True)
    ap.add_argument('--model', required=True)
    ap.add_argument('--shrink', type=float, default=0.0)
    ap.add_argument('--save')
    ap.add_argument('--hard', type=float, default=0.0, help='count confident argmax (p >= this) instead of EM')
    a = ap.parse_args()
    d = pathlib.Path(a.data)
    raw = (d / 'lid' / 'models' / f'{a.model}.bin').read_bytes()
    m = blob.parse(raw)
    L = m['labels']
    counts = collections.Counter(r['lang'] for r in blob.texts(d / 'lid' / 'feat', 'train'))
    prior_train = np.array([counts[l] for l in L], np.float64)
    prior_train /= prior_train.sum()
    p, nz = blob.probs(m, d / 'lid' / 'feat', 'captures')
    if a.hard:
        pz = p[nz]
        sure = pz.max(axis=1) >= a.hard
        c = np.bincount(pz[sure].argmax(axis=1), minlength=len(L)).astype(np.float64) + 1.0  # add-one: no class at zero
        pi = c / c.sum()
    else:
        pi = em_prior(p[nz], prior_train)
    pi = (1 - a.shrink) * pi + a.shrink * prior_train
    order = np.argsort(-pi)
    print('chat prior (EM):', ', '.join(f'{L[i]} {pi[i]:.3f}' for i in order[:15]))
    shift = m['T'] * np.log(pi / prior_train)
    if a.save:
        out = shifted_blob(raw, shift)
        (d / 'lid' / 'models' / f'{a.save}.bin').write_bytes(out)
        (d / 'lid' / 'models' / f'{a.save}.json').write_text(json.dumps(
            {'from': a.model, 'prior': dict(zip(L, map(float, pi))), 'shrink': a.shrink}), encoding='utf-8')
        print('saved', a.save)


if __name__ == '__main__':
    main()
