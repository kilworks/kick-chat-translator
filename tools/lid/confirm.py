"""Pick a model on the even dev lines, then compare it with a reference on the odd lines the pick never saw.

python tools/lid/confirm.py --data <data-dir> --ref st2tw-b16 --models 'st2tw-*-e*' [--path adapted]

Every candidate (models/<glob>.bin) and the reference get their thresholds on the even lines (adapt.measure,
k=10 causal, half=even). The candidate with the lowest even-line cost is the pick. On the odd lines: mean cost
of the pick and of the reference, paired difference with a 95 % bootstrap over channels (file:channel keys).
The goal's bar (kil, 22/11): the whole interval below 0 on the adapted path. Run it on candidates ONCE, at the end:
every look at the odd lines spends them. Heldout is never read.
"""
import argparse
import pathlib

import adapt
import cost


def run(data, model):
    return adapt.measure(argparse.Namespace(data=str(data), model=model, sure=0.9, k=10, key='ch', causal=True,
                                            first=0, half='even'))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True)
    ap.add_argument('--ref', default='st2tw-b16')
    ap.add_argument('--models', required=True, help='glob over <data>/lid/models/*.bin, without .bin')
    ap.add_argument('--path', default='adapted', choices=['adapted', 'plain'])
    a = ap.parse_args()
    data = pathlib.Path(a.data)
    names = sorted(p.stem for p in (data / 'lid' / 'models').glob(f'{a.models}.bin'))
    assert names, f'no model matches {a.models}'
    scores = {n: run(data, n) for n in names}
    ranked = sorted(names, key=lambda n: scores[n][a.path][0])
    print('\neven lines (selection), best first:')
    for n in ranked[:10]:
        print(f'  {n:32s} {a.path} {scores[n][a.path][0]:.4f}  plain {scores[n]["plain"][0]:.4f}')
    pick, ref = ranked[0], run(data, a.ref)
    for path in ('adapted', 'plain'):
        new, old, groups = scores[pick][path][5], ref[path][5], ref[path][6]
        assert len(new) == len(old) == len(groups)
        lo, hi = cost.bootstrap([x - y for x, y in zip(new, old)], groups)
        verdict = 'GAGNE' if hi < 0 else ('PERD' if lo > 0 else 'non tranche')
        print(f'odd lines ({len(new)}), {path}: {a.ref} {sum(old) / len(old):.4f} -> {pick} {sum(new) / len(new):.4f}'
              f'  diff95 [{lo:+.4f}, {hi:+.4f}]  {verdict}')


if __name__ == '__main__':
    main()
