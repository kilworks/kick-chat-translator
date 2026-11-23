"""Train neural LID configurations on free InstaBox VMs, watched live in TensorBoard on the PC.

python tools/lid/train_ibx.py --data <data-dir> --src lid-st2tw --run NAME:LR:DIM:HIDDEN:EPOCHS [--run ...]
    (HIDDEN 0: the linear model, train.py, DIM ignored)
    [--vms ibx-w1,ibx-w2,ibx-w3,ibx-w4,ibx-w5] [--ref st2tw-b16,nn-st2tw-d32-h128]
python tools/lid/train_ibx.py --data <data-dir> --note "text"     (a line in the TensorBoard journal)

One configuration per VM at a time, held through ibx.hold() at ordo priority 9: video encodes come first, a VM
another job holds is skipped and the configuration waits for the next free one. A VM receives the train and valid
features of --src and the dev and bench features (never heldout, never texts.json), trains with train_nn.py --tb,
and every minute the PC pulls its TensorBoard logs and epoch models into <data>/lid/tb/NAME and <data>/lid/models,
measures each new epoch on the even dev lines (adapt.measure, k=10, causal, half=even: the odd ones stay for
confirm.py) and writes the cost beside the curves. --ref models
are drawn as flat lines to beat. One HParams row per run at the end; VMs paused when the queue is empty.
Needs tensorboardX (the venv <data>/lid/venv has it).
"""
import argparse
import json
import os
import pathlib
import queue
import sys
import tarfile
import threading
import time
import traceback

os.environ.setdefault('IBX_PRIO', '9')
sys.path.insert(0, os.environ['IBX_DIR'])  # the instabox-farm checkout (ibx.py))
import ibx  # noqa: E402
from tensorboardX import SummaryWriter  # noqa: E402

import adapt  # noqa: E402

HERE = pathlib.Path(__file__).parent
MEASURE = threading.Lock()  # one cost measure at a time on the PC
NOTE = threading.Lock()  # the journal counter is shared by the VM threads
WAIT_S = 300  # a held VM is asked again after this
FAILS = {}  # errors per run name: a run is dropped at 3
LEFT = [0]  # configs not finished yet: a worker with an empty queue waits while one may come back from a held VM


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def note(tb, text):
    """Append TEXT to the journal run, numbered."""
    log(text)
    j = tb / 'journal'
    with NOTE:
        j.mkdir(parents=True, exist_ok=True)
        n = int((j / 'n.txt').read_text()) + 1 if (j / 'n.txt').exists() else 1
        (j / 'n.txt').write_text(str(n))
        with SummaryWriter(str(j)) as w:
            w.add_text('journal', f"{time.strftime('%d/%m %H:%M')}  {text}", n)


def cost(data, model):
    with MEASURE:
        r = adapt.measure(argparse.Namespace(data=str(data), model=model, sure=0.9, k=10, key='ch', causal=True, first=0,
                                             half='even'))
    return r['plain'][0], r['adapted'][0], r['adapted'][4]


def shipped(data, src):
    """(local file, path under the VM's data dir) of everything a run reads: never heldout."""
    out = [(data / src / 'feat' / f'{n}.{e}', f'{src}/feat/{n}.{e}') for n in ('train', 'valid') for e in ('idx', 'off', 'json')]
    return out + [(data / 'lid' / 'feat' / f'{n}.{e}', f'lid/feat/{n}.{e}') for n in ('dev', 'bench') for e in ('idx', 'off', 'json')]


def setup(mid, D, data, src):
    ibx.must(mid, f'mkdir -p {D}/lid/models {D}/tb && (python3 -c "import tensorboardX" 2>/dev/null || '
                  'pip3 install -q --break-system-packages tensorboardX)', 600)  # API cap: 1-600 s
    have = ibx.sh(mid, f'cd {D} && find . -type f -printf "%P %s\\n"', 120, log=False).get('stdout', '')
    sizes = dict(l.rsplit(' ', 1) for l in have.splitlines() if ' ' in l)
    for loc, rel in shipped(data, src):
        if sizes.get(rel) != str(loc.stat().st_size):
            t = time.time()
            ibx.push(mid, str(loc), f'{D}/{rel}')
            log(mid[:8], 'envoye', rel, f'{loc.stat().st_size >> 20} Mo en {time.time() - t:.0f} s')
    for f in ('train_nn.py', 'train.py'):
        ibx.push(mid, str(HERE / f), f'{D}/{f}')


def pull(mid, D, name, data, tbdir):
    """Pull the run's logs and epoch models; only expected paths are written (no tar member chooses its path)."""
    # tar exits 1 on 'file changed as we read it' (the event file grows): the copy is still usable
    ibx.must(mid, f'cd {D} && tar czf /tmp/{name}.tgz tb/{name} {name}.log $(ls lid/models/{name}-e* 2>/dev/null) 2>/dev/null; test $? -le 1', 300)
    tmp = tbdir / f'.{name}.tgz'
    ibx.pull(mid, f'/tmp/{name}.tgz', tmp)
    with tarfile.open(tmp) as t:
        for m in t.getmembers():
            if not m.isfile() or '..' in m.name:
                continue
            if m.name.startswith(f'tb/{name}/'):
                dst = tbdir / name / m.name[len(f'tb/{name}/'):]
            elif m.name.startswith(f'lid/models/{name}-e') and '/' not in m.name[len('lid/models/'):]:
                dst = data / 'lid' / 'models' / m.name[len('lid/models/'):]
            elif m.name == f'{name}.log':
                dst = tbdir / name / 'train.log'
            else:
                continue
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_bytes(t.extractfile(m).read())
    tmp.unlink()


def run(mid, D, cfg, data, src, tbdir):
    name, lr, dim, hidden, epochs = cfg
    args = f'--data {D} --src {src} --bits 16 --dim {dim} --hidden {hidden} --epochs {epochs} --lr {lr} --save {name} --tb tb/{name}'
    job = f'python3 -u train_nn.py {args} > {name}.log 2>&1; echo $? > {name}.done'
    if not int(hidden):  # the linear model: one model at the end, saved as the last epoch
        args = f'--data {D} --src {src} --bits 16 --epochs {epochs} --lr {lr} --save {name}-e{epochs}'
        job = f'mkdir -p tb/{name}; python3 -u train.py {args} > {name}.log 2>&1; echo $? > {name}.done'
    ibx.must(mid, f"cd {D} && rm -rf tb/{name} {name}.done lid/models/{name}-e* && (nohup sh -c '{job}' > /dev/null 2>&1 &); sleep 1")
    note(tbdir, f'{name} lance ({mid[:8]}) : lr {lr}, embedding {dim}, couche cachee {hidden}, {epochs} epoques')
    w = SummaryWriter(str(tbdir / name))  # the PC's own event file in the run dir: the cost per epoch
    seen, best = set(), None
    while True:
        rc = ibx.sh(mid, f'cat {D}/{name}.done 2>/dev/null', 60, log=False).get('stdout', '').strip()
        try:
            pull(mid, D, name, data, tbdir)
        except (Exception, SystemExit) as e:  # a cut pull: next minute
            log(name, 'pull rate', str(e)[:100])
        for e in range(1, int(epochs) + 1):
            if e in seen or not (data / 'lid' / 'models' / f'{name}-e{e}.json').exists():  # json written after the bin
                continue
            seen.add(e)
            rep = json.loads((data / 'lid' / 'models' / f'{name}-e{e}.json').read_text(encoding='utf-8'))
            plain, adapted, slw = cost(data, f'{name}-e{e}')
            w.add_scalar('cost/plain', plain, e)
            w.add_scalar('cost/adapted', adapted, e)
            w.add_scalar('cost/sl_wrong_adapted', slw, e)
            w.flush()
            if best is None or adapted < best[1]:
                best = (plain, adapted, e, rep)
            note(tbdir, f'{name} epoque {e} : cout seul {plain:.4f}, adapte {adapted:.4f}, dev {rep["dev_acc"]:.3f}, ECE {rep["ece_odd_cal"]:.3f}')
        if rc:
            break
        time.sleep(60)
    if rc != '0' or best is None:
        tail = (tbdir / name / 'train.log').read_text(encoding='utf-8', errors='replace')[-300:] if (tbdir / name / 'train.log').exists() else ''
        note(tbdir, f'{name} ECHEC code {rc} : {tail}')
        w.close()
        return
    plain, adapted, e, rep = best
    w.add_hparams({'lr': float(lr), 'dim': int(dim), 'hidden': int(hidden), 'epochs': int(epochs), 'src': src},
                  {'hp/cost_adapted': adapted, 'hp/cost_plain': plain, 'hp/best_epoch': e, 'hp/dev_acc': rep['dev_acc']},
                  name='hparams')
    w.close()
    with open(data / 'lid' / 'sweep-nn.jsonl', 'a', encoding='utf-8') as f:
        f.write(json.dumps({'run': name, 'src': src, 'best_epoch': e, 'plain': plain, 'adapted': adapted, **rep}) + '\n')
    note(tbdir, f'{name} fini : meilleure epoque {e}, cout seul {plain:.4f}, adapte {adapted:.4f}')


def worker(vm, q, data, src, tbdir):
    D, ready = f'{ibx.WORK}/lid-train', False
    while True:
        try:
            cfg = q.get_nowait()
        except queue.Empty:
            if not LEFT[0]:
                break
            time.sleep(WAIT_S)
            continue
        try:
            with ibx.hold([vm]) as n:
                if n is not None:
                    mid = ibx.up(n)
                    if not ready:
                        setup(mid, D, data, src)
                        ready = True
                    run(mid, D, cfg, data, src, tbdir)
                    with NOTE:
                        LEFT[0] -= 1
                    continue
            why = 'tenue par un autre job'
        except BaseException as e:  # ibx raises SystemExit, which a thread swallows without a word
            traceback.print_exc()
            FAILS[cfg[0]] = FAILS.get(cfg[0], 0) + 1
            why = f'erreur {type(e).__name__} : {str(e)[:160]}'
            if FAILS[cfg[0]] >= 3:
                note(tbdir, f'{cfg[0]} abandonne apres 3 erreurs ({vm}) : {why}')
                with NOTE:
                    LEFT[0] -= 1
                continue
        q.put(cfg)  # the config waits for the next free VM
        log(vm, why, ', nouvel essai dans', WAIT_S, 's')
        time.sleep(WAIT_S)
    try:
        ibx.sleep(vm)
        log(vm, 'en pause')
    except (Exception, SystemExit) as e:
        log(vm, 'laissee allumee :', str(e)[:80])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', required=True)
    ap.add_argument('--src', default='lid-st2tw')
    ap.add_argument('--run', action='append', default=[], help='NAME:LR:DIM:HIDDEN:EPOCHS')
    ap.add_argument('--vms', default='ibx-w1,ibx-w2,ibx-w3,ibx-w4,ibx-w5')
    ap.add_argument('--ref', default='st2tw-b16,nn-st2tw-d32-h128', help='models drawn as flat lines to beat')
    ap.add_argument('--note')
    a = ap.parse_args()
    data = pathlib.Path(a.data)
    tbdir = data / 'lid' / 'tb'
    if a.note:
        note(tbdir, a.note)
        return
    cfgs = [r.split(':') for r in a.run]
    assert cfgs and all(len(c) == 5 for c in cfgs), 'each --run is NAME:LR:DIM:HIDDEN:EPOCHS'
    top = max(int(c[4]) for c in cfgs)
    for r in [x for x in a.ref.split(',') if x and not (tbdir / f'ref-{x}').exists()]:
        plain, adapted, slw = cost(data, r)
        with SummaryWriter(str(tbdir / f'ref-{r}')) as w:
            for e in range(1, top + 1):
                w.add_scalar('cost/plain', plain, e)
                w.add_scalar('cost/adapted', adapted, e)
                w.add_scalar('cost/sl_wrong_adapted', slw, e)
    q = queue.Queue()
    for c in cfgs:
        q.put(c)
    LEFT[0] = len(cfgs)
    note(tbdir, f'vague lancee sur {a.src} : ' + ', '.join(c[0] for c in cfgs))
    jobs = [threading.Thread(target=worker, args=(v, q, data, a.src, tbdir)) for v in a.vms.split(',') if v]
    for j in jobs:
        j.start()
    for j in jobs:
        j.join()
    note(tbdir, 'vague terminee')


if __name__ == '__main__':
    main()
