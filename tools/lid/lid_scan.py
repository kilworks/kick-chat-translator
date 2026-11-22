"""Rescan the public Twitch directory on a free InstaBox VM: Dagu DAG lid-scan on Oracle, every 2 h (scan-run.sh).

Video encodes come first: lowest ordo priority (9, recorded), only a machine nobody holds, else this run is
skipped; held for the scan alone (about 25 min), then paused if nobody took it, so its run time is not used up.
Only the languages under the target are scanned, the missing ones included. The VM merges its find into a copy
of the list; the copy replaces Oracle's list only when no language lost a channel. lid-collect.service reads the
list at its next cycle. Prints counts only.
"""
import json
import os
import pathlib
import sys
import time

os.environ['IBX_PRIO'] = '9'
sys.path.insert(0, os.environ['IBX_DIR'])
import ibx  # noqa: E402

H = pathlib.Path(__file__).resolve().parent
RAW = H / 'lid' / 'raw-chat'
LIST = RAW / 'twitch-channels-2.json'
TARGET = 100000  # same as oracle_collect.sh
LANGS = ('ar bg bn ca cs da de el en es et fa fi fr he hi hu id it ja ko lt lv ms nl no pl pt ro ru sk sl sv ta th tl tr '
         'uk vi zh zh-hk').split()


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


def main():
    counts = json.loads((RAW / 'counts.json').read_text(encoding='utf-8')) if (RAW / 'counts.json').exists() else {}
    langs = [l for l in LANGS if l != 'en' and counts.get(l, 0) < TARGET]
    old = json.loads(LIST.read_text(encoding='utf-8'))
    log(len(langs), 'langues sous le plafond a rescanner')
    with ibx.hold() as n:
        if n is None:
            log('aucune machine libre : scan saute, les encodages passent avant')
            return
        mid = ibx.up(n)
        d = f'{ibx.WORK}/lid-scan'
        ibx.must(mid, f'mkdir -p {d} && cd {d} && rm -f done scan.log && '
                      '([ -d node_modules/playwright-core ] || npm i --no-audit --no-fund --silent playwright-core >/dev/null 2>&1)')
        ibx.push(mid, str(H / 'twitch_dir.mjs'), f'{d}/twitch_dir.mjs')
        ibx.push(mid, str(LIST), f'{d}/list.json')
        run = (f'LID_CHROMIUM=/usr/bin/chromium timeout 3000 node twitch_dir.mjs --out list.json --min 20 '
               f'--langs {",".join(langs)} > scan.log 2>&1; echo $? > done')
        ibx.must(mid, f"cd {d} && (nohup sh -c '{run}' > /dev/null 2>&1 &); sleep 1")
        log(n, 'scan lance')
        rc = ''
        for _ in range(55):
            time.sleep(60)
            rc = ibx.sh(mid, f'cat {d}/done 2>/dev/null', 30, log=False)['stdout'].strip()
            if rc:
                break
        ibx.pull(mid, f'{d}/scan.log', RAW / 'scan-last.log')
        log('scan', 'fini rc ' + rc if rc else 'trop long, abandonne', '|',
            ' '.join((RAW / 'scan-last.log').read_text(encoding='utf-8', errors='replace').split()[-24:]))
        if rc == '0':
            ibx.pull(mid, f'{d}/list.json', str(LIST) + '.new')
            new = json.loads(pathlib.Path(str(LIST) + '.new').read_text(encoding='utf-8'))
            lost = [l for l, v in old.items() if len(new.get(l, [])) < len(v)]
            if lost:
                log('liste gardee : des langues perdraient des chaines', ' '.join(lost))
            else:
                os.replace(str(LIST) + '.new', LIST)
                log('liste remplacee :', sum(map(len, old.values())), '->', sum(map(len, new.values())), 'chaines,',
                    len(old), '->', len(new), 'langues')
    try:
        ibx.sleep(n)  # refused when a job took it meanwhile
        log(n, 'en pause')
    except (Exception, SystemExit) as e:
        log(n, 'laissee allumee :', str(e)[:80])


if __name__ == '__main__':
    main()
