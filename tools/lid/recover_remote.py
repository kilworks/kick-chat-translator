"""Recover a remote_collect run whose driver died: pull every file left on Oracle and the VMs into
raw-chat, then stop the readers, remove the run dirs, free the VM leases and suspend the VMs.

python tools/lid/recover_remote.py [--tag ''] [--vms ibx-w4,ibx-w5] [--data C:/Users/kil/kct-data]

--tag is the tag of the dead run (its local file names). Pulled files replace the local ones:
a remote file only grows, so the full copy is a superset of the last pull.
"""
import argparse
import os
import pathlib
import subprocess
import sys

sys.path.insert(0, r'C:\Users\kil\Downloads\02 - Projects\instabox-farm')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--data', default=r'C:\Users\kil\kct-data')
    ap.add_argument('--tag', default='')
    ap.add_argument('--vms', default='ibx-w4,ibx-w5')
    a = ap.parse_args()
    raw = pathlib.Path(a.data) / 'lid' / 'raw-chat'
    d = 'lid-collect/run'
    subprocess.run(['ssh', 'oracle', 'pkill -f "twitch_irc.py --channels ora-"'])  # stop writers first: a growing file fails the size check
    ls = subprocess.run(['ssh', 'oracle', f'ls {d} 2>/dev/null'], capture_output=True, text=True).stdout.split()
    for f in sorted(x for x in ls if x.endswith('.jsonl')):
        i = f[len('ora-'):-len('.jsonl')]
        dst = raw / f'twitch-ora-{a.tag}{i}.jsonl'
        if subprocess.run(['scp', '-q', f'oracle:{d}/{f}', str(dst) + '.part']).returncode == 0:
            os.replace(str(dst) + '.part', dst)
            print('oracle', f, '->', dst.name, dst.stat().st_size, flush=True)
    subprocess.run(['ssh', 'oracle', f'pkill -f "twitch_irc.py --channels ora-" ; rm -rf {d}'])
    import ibx
    for name in [v for v in a.vms.split(',') if v]:
        m = ibx.machine(name)
        if not m or m.get('state') != 'running':
            print(name, 'etat', m and m.get('state'), ': rien a rapatrier', flush=True)
        else:
            mid, rd = m['id'], f'{ibx.WORK}/lid-collect'
            ibx.sh(mid, 'pkill -f "twitch_irc.py --channels s-"', 60)
            files = ibx.sh(mid, f'ls {rd} 2>/dev/null', 60, log=False).get('stdout', '').split()
            for f in sorted(x for x in files if x.endswith('.jsonl')):
                i = f[len('s-'):-len('.jsonl')]
                dst = raw / f'twitch-{name}-{a.tag}{i}.jsonl'
                ibx.pull(mid, f'{rd}/{f}', dst)
                print(name, f, '->', dst.name, dst.stat().st_size, flush=True)
            ibx.sh(mid, f'pkill -f "twitch_irc.py --channels s-" ; rm -rf {rd}', 60)
        print(name, ibx.release_dead(name), flush=True)
        ibx.sleep(name)
        print(name, 'en veille', flush=True)


if __name__ == '__main__':
    main()
