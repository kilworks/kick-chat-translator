"""Run twitch_irc.py on Oracle and on free InstaBox VMs, pull their files into raw-chat every minute.

python tools/lid/remote_collect.py --channels <data>/lid/raw-chat/twitch-channels-2.json --until 19:58
    [--oracle 8] [--vms ibx-w1,ibx-w2,ibx-w3] [--per-vm 6] [--data C:/Users/kil/kct-data] [--here] [--target 100000]

--here: run on Oracle itself (oracle_collect.sh, service lid-collect): its readers write straight into raw-chat,
the VMs' files are pulled every 5 minutes. --target: a language with that many lines already collected
(base-counts.json plus the twitch-*.jsonl of raw-chat) leaves the list, so the languages even out.

Channels already read by the PC (twitch-channels.json) are skipped. Each process reads one shard
over its own anonymous IRC connection (no browser, ~1 % CPU). Output lands in
raw-chat/twitch-ora-<i>.jsonl and twitch-<vm>-<i>.jsonl, which watch_collect.py already counts.
VMs come through ibx.hold() (never one a job holds; w4-w5 are the feed's) and are suspended at the end.
"""
import argparse
import collections
import datetime
import json
import os
import pathlib
import shlex
import subprocess
import sys
import threading
import time

HERE = pathlib.Path(__file__).parent
IRC = HERE / 'twitch_irc.py'
sys.path.insert(0, os.environ.get('IBX_DIR', r'C:\Users\kil\Downloads\02 - Projects\instabox-farm'))
LOCAL = False  # --here


def shards(new, existing, n):
    """Split the channels of NEW not in EXISTING into n shards, languages spread round robin."""
    seen = {c for v in existing.values() for c in v}
    flat = [(l, c) for l, v in new.items() for c in v if c not in seen]
    out = [{} for _ in range(n)]
    for i, (l, c) in enumerate(flat):
        out[i % n].setdefault(l, []).append(c)
    return [s for s in out if s]


def counts(raw):
    """Lines per declared language collected so far: base-counts.json (collected elsewhere) plus raw's twitch files."""
    base = raw / 'base-counts.json'
    c = collections.Counter(json.loads(base.read_text(encoding='utf-8')) if base.exists() else {})
    for f in raw.glob('twitch-*.jsonl'):
        with open(f, 'rb') as fh:
            for line in fh:
                i = line.find(b'"lang": "')
                if i >= 0:
                    c[line[i + 9:line.index(b'"', i + 9)].decode()] += 1
    return c


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def oracle(parts, secs, raw, end, tag='', slot=''):
    """SLOT names a second batch beside the main one (the parts of a VM a job holds): own dir, files, pkill."""
    o = f'{"here" if LOCAL else "ora"}{slot}'
    if LOCAL:  # on Oracle itself: readers write straight into raw, nothing to pull
        tmp = raw / '_shards'
        tmp.mkdir(exist_ok=True)
        procs = []
        for i, s in enumerate(parts):
            (tmp / f'{o}-{i}.json').write_text(json.dumps(s), encoding='utf-8')
            procs.append(subprocess.Popen(['timeout', str(secs + 60), sys.executable, str(IRC), '--channels', str(tmp / f'{o}-{i}.json'),
                                           '--out', str(raw / f'twitch-{o}-{tag}{i}.jsonl'), '--hours', f'{secs / 3600:.4f}'],
                                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        log(o, len(parts), 'processus lances')
        for p in procs:
            p.wait()
        log(o, 'termine')
        return
    d = f'lid-collect/run{slot}'
    subprocess.run(['ssh', 'oracle', f'rm -rf {d} && mkdir -p {d}'], check=True)
    tmp = raw / '_shards'
    tmp.mkdir(exist_ok=True)
    for i, s in enumerate(parts):
        (tmp / f'{o}-{i}.json').write_text(json.dumps(s), encoding='utf-8')
    subprocess.run(['scp', '-q', str(IRC), *[str(tmp / f'{o}-{i}.json') for i in range(len(parts))], f'oracle:{d}/'], check=True)
    start = ' '.join(f'(nohup nice -n 10 timeout {secs + 60} python3 twitch_irc.py --channels {o}-{i}.json '
                     f'--out {o}-{i}.jsonl --hours {secs / 3600:.4f} > {o}-{i}.log 2>&1 &);' for i in range(len(parts)))
    subprocess.run(['ssh', 'oracle', f'cd {d} && {start} sleep 1; pgrep -fc twitch_irc.py'], check=True)
    log(o, len(parts), 'processus lances')
    while True:
        last = time.time() > end + 30
        for i in range(len(parts)):
            dst = raw / f'twitch-{o}-{tag}{i}.jsonl'
            r = subprocess.run(['scp', '-q', f'oracle:{d}/{o}-{i}.jsonl', str(dst) + '.part'], capture_output=True)
            if r.returncode == 0:
                os.replace(str(dst) + '.part', dst)
        if last:
            break
        time.sleep(60)
    subprocess.run(['ssh', 'oracle', f'pkill -f "twitch_irc.py --channels {o}-" ; rm -rf {d}'])
    log(o, 'termine')


def vm(name, parts, secs, raw, end, tag=''):
    import ibx
    with ibx.hold([name]) as n:
        if n is None:  # the feed has it: its channels go to Oracle, which has room (0.1 % CPU per reader)
            log(name, 'tenue par un autre job : ses parts vont sur Oracle')
            oracle(parts, int(end - time.time()), raw, end, tag, slot=name.split('-')[-1])
            return
        mid = ibx.up(n)
        d = f'{ibx.WORK}/lid-collect'
        ibx.must(mid, f'rm -rf {d} && mkdir -p {d}')
        ibx.push(mid, str(IRC), f'{d}/twitch_irc.py')
        for i, s in enumerate(parts):
            p = raw / '_shards' / f'{n}-{i}.json'
            p.parent.mkdir(exist_ok=True)
            p.write_text(json.dumps(s), encoding='utf-8')
            ibx.push(mid, str(p), f'{d}/s-{i}.json')
        start = ' '.join(f'(nohup timeout {secs + 60} python3 twitch_irc.py --channels s-{i}.json --out s-{i}.jsonl '
                         f'--hours {secs / 3600:.4f} > s-{i}.log 2>&1 &);' for i in range(len(parts)))
        ibx.must(mid, f'cd {d} && {start} sleep 1; pgrep -fc twitch_irc.py')
        log(n, len(parts), 'processus lances')
        while True:
            last = time.time() > end + 30
            for i in range(len(parts)):
                try:
                    ibx.pull(mid, f'{d}/s-{i}.jsonl', raw / f'twitch-{n}-{tag}{i}.jsonl')
                except (SystemExit, Exception) as e:  # file not there yet, or a cut pull: next minute
                    if last:
                        log(n, i, 'pull rate', str(e)[:80])
            if last:
                break
            time.sleep(300 if LOCAL else 60)  # on Oracle the pulls come in over its network card: less often
        ibx.sh(mid, f'pkill -f "twitch_irc.py --channels s-" ; rm -rf {d}', 60)
    ibx.sleep(name)
    log(n, 'termine et en veille')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default=r'C:\Users\kil\kct-data')
    ap.add_argument('--channels', required=True)
    ap.add_argument('--until', help='HH:MM local')
    ap.add_argument('--minutes', type=float, help='run length instead of --until (cycles with no end time)')
    ap.add_argument('--tag', default='', help='file name part, so a new cycle never overwrites the last one')
    ap.add_argument('--oracle', type=int, default=8)
    ap.add_argument('--vms', default='ibx-w1,ibx-w2,ibx-w3')  # the PC's pool (PC out of the feed); w4-w5 belong to Oracle's reserve_kick
    ap.add_argument('--per-vm', type=int, default=6)
    ap.add_argument('--here', action='store_true', help='run on Oracle itself')
    ap.add_argument('--target', type=int, default=0, help='lines per language after which it leaves the list')
    a = ap.parse_args()
    global LOCAL
    LOCAL = a.here
    raw = pathlib.Path(a.data) / 'lid' / 'raw-chat'
    if a.minutes:
        end = time.time() + a.minutes * 60
    else:
        h, m = map(int, a.until.split(':'))
        end = datetime.datetime.now().replace(hour=h, minute=m, second=0).timestamp()
    secs = int(end - time.time())
    assert secs > 120, 'until is less than 2 minutes away'
    vms = [v for v in a.vms.split(',') if v]
    new = json.loads(pathlib.Path(a.channels).read_text(encoding='utf-8'))
    if a.target:
        c = counts(raw)
        (raw / 'counts.json').write_text(json.dumps(dict(c.most_common())), encoding='utf-8')
        full = sorted(l for l in new if c[l] >= a.target)
        new = {l: v for l, v in new.items() if l not in full}
        log('au plafond', a.target, ':', ' '.join(full) or '-')
    pc = raw / 'twitch-channels.json'  # the PC's own list, read by its reader: absent on Oracle
    parts = shards(new, json.loads(pc.read_text(encoding='utf-8')) if pc.exists() else {}, a.oracle + a.per_vm * len(vms))
    log(sum(len(c) for s in parts for c in s.values()), 'chaines nouvelles en', len(parts), 'parts, fin', time.strftime('%H:%M', time.localtime(end)))
    jobs = [threading.Thread(target=oracle, args=(parts[:a.oracle], secs, raw, end, a.tag))]
    for k, v in enumerate(vms):
        p = parts[a.oracle + k * a.per_vm:a.oracle + (k + 1) * a.per_vm]
        if p:
            jobs.append(threading.Thread(target=vm, args=(v, p, secs, raw, end, a.tag)))
    for j in jobs:
        j.start()
    for j in jobs:
        j.join()
    log('fin')


if __name__ == '__main__':
    if '--selftest' in sys.argv:
        s = shards({'en': ['a', 'b', 'c'], 'fr': ['d']}, {'en': ['a']}, 2)
        assert sorted(c for p in s for v in p.values() for c in v) == ['b', 'c', 'd'] and len(s) == 2
        import tempfile
        with tempfile.TemporaryDirectory() as t:
            t = pathlib.Path(t)
            (t / 'base-counts.json').write_text('{"fr": 5}', encoding='utf-8')
            (t / 'twitch-x.jsonl').write_text('{"lang": "fr", "ch": 0}\n{"lang": "da", "ch": 1}\n', encoding='utf-8')
            assert counts(t) == {'fr': 6, 'da': 1}
        print('remote_collect ok')
    else:
        main()
