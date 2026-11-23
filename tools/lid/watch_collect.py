"""Live console dashboard of the chat collection (E9), built on tui_dash.py.

python tools/lid/watch_collect.py --data <data-dir> [--once]

Reads <data>/lid/raw-chat: kick-*.jsonl, twitch-*.jsonl and their logs. Only
the bytes appended since the last refresh are parsed. Ctrl+C to quit.
"""
import collections
import json
import pathlib
import re
import sys
import time

import tui_dash as T
from pseudo import KICK  # Kick names -> language codes, so both sources share one row per language

START = '17:20'                 # first Twitch reader
# Kick names pseudo.KICK leaves out (display only, training keeps its own map)
EXTRA = {'Serbian': 'sr', 'Malayalam': 'ml', 'Mongolian': 'mn', 'Albanian': 'sq', 'Bosnian': 'bs', 'Macedonian': 'mk',
         'Croatian': 'hr', 'Nepali': 'ne', 'Somali': 'so', 'Latvian': 'lv', 'Lithuanian': 'lt', 'Bengali': 'bn',
         'Urdu': 'ur', 'Azerbaijani': 'az', 'Korean': 'ko', 'Norwegian': 'no', 'Greek': 'el', 'Vietnamese': 'vi'}
DATA = pathlib.Path(sys.argv[sys.argv.index('--data') + 1])
RAW = DATA / 'lid' / 'raw-chat'


class Tail:
    """Lines per language in one jsonl file, reading only what was appended."""

    def __init__(self, path):
        self.path, self.pos, self.rest, self.n = path, 0, b'', 0
        self.langs = collections.Counter()

    def update(self):
        with open(self.path, 'rb') as f:
            f.seek(self.pos)
            chunk = f.read()
            self.pos = f.tell()
        *lines, self.rest = (self.rest + chunk).split(b'\n')
        for line in lines:
            line = line.strip()
            if line:
                try:
                    self.langs[json.loads(line)['lang']] += 1
                    self.n += 1
                except ValueError:
                    pass


tails, hist = {}, collections.deque(maxlen=400)


def where(name):
    return 'ORACLE' if '-ora-' in name else 'INSTABOX' if '-ibx-' in name else 'PC'


def hhmm(t):
    return time.strftime('%H:%M', time.localtime(t))


def read(name):
    p = RAW / name
    return p.read_text(encoding='utf-8', errors='replace') if p.exists() else ''


def build():
    for f in sorted(RAW.glob('*.jsonl')):
        if f.name.startswith(('kick-', 'twitch-')) and f not in tails:
            tails[f] = Tail(f)
    for t in tails.values():
        t.update()
    now = time.time()
    total = {s: sum(t.n for f, t in tails.items() if f.name.startswith(s)) for s in ('kick', 'twitch')}
    src = collections.Counter()
    for f, t in tails.items():
        src['KICK' if f.name.startswith('kick') else where(f.name)] += t.n
    hist.append((now, dict(src)))
    old = next((h for h in hist if h[0] >= now - 120), hist[0])
    span = max(now - old[0], 1)
    rate = {k: (v - old[1].get(k, 0)) / span * 60 for k, v in src.items()}
    rate['kick'], rate['twitch'] = rate.get('KICK', 0), sum(rate.get(k, 0) for k in ('PC', 'ORACLE', 'INSTABOX'))
    langs = collections.defaultdict(lambda: [0, 0])
    for f, t in tails.items():
        kick = f.name.startswith('kick')
        for l, n in t.langs.items():
            key = ('en-IN' if l == 'English (India)' else KICK.get(l) or EXTRA.get(l, l)) if kick else l
            langs[key][0 if kick else 1] += n
    klog = read('kick-log.txt')
    klog_run = klog[klog.rfind('---'):]
    http = re.findall(r'http ok (\d+) refused (\d+) err (\d+) -> next round in (\d+) s', klog_run)
    rounds = re.findall(r'^round (\d+)/\d+: \+(\d+) \((\d+)\) from (\d+) channels', klog, re.M)
    tlog = read('twitch-log.txt')
    tchan = (re.findall(r'(\d+) channels', tlog) or ['?'])[-1]
    disc = tlog.count('disconnected')
    day = time.strftime('%Y-%m-%d ')
    t_start = time.mktime(time.strptime(day + START, '%Y-%m-%d %H:%M'))
    up = int(now - t_start)
    rlog = read('remote-log.txt').splitlines()
    remote_ch = (re.findall(r'(\d+) chaines nouvelles', ' '.join(rlog)) or ['0'])[-1]
    fresh = {}
    for k in ('ORACLE', 'INSTABOX'):
        fs = [f for f in tails if where(f.name) == k]
        fresh[k] = int(now - max(f.stat().st_mtime for f in fs)) if fs else None
    ok, ref = (int(http[-1][0]), int(http[-1][1])) if http else (0, 0)
    refused = ref / max(ok + ref, 1)
    run_rounds = re.findall(r'^round (\d+)/(\d+): \+(\d+) \((\d+)\) from (\d+) channels', klog_run, re.M)
    grand = total['kick'] + total['twitch']
    per_min = rate['kick'] + rate['twitch']
    top = sorted(langs.items(), key=lambda x: -sum(x[1]))
    series = [int(r[1]) for r in rounds]
    fin = 'sans fin'
    return {
        'logo': T.logo('LID'),
        'title': 'KCT LANGUAGE ID  -  COLLECTE DE CHAT',
        'subtitle': 'auto-apprentissage E9  -  Kick + Twitch  -  PC + Oracle + InstaBox  -  donnees non etiquetees',
        'headline': f'LIGNES {grand:,}',
        'subline': f'kick {total["kick"]:,}    twitch {total["twitch"]:,}',
        'cards': [('TOTAL', f'{grand:,}', 'w'), ('DEBIT /MIN', f'{per_min:,.0f}', 'g'), ('KICK', f'{total["kick"]:,}', 'g'),
                  ('TWITCH', f'{total["twitch"]:,}', 'g'), ('PC TW', f'{src["PC"]:,}', 'w'),
                  ('ORACLE', f'{src["ORACLE"]:,}', 'c'), ('INSTABOX', f'{src["INSTABOX"]:,}', 'c'),
                  ('KICK REFUS', f'{refused:.0%}', 'r' if refused > 0.1 else 'g'),
                  ('LANGUES', str(len(langs)), 'w'),
                  ('CHAINES', f'{int(rounds[-1][3]) if rounds else 0}+{tchan}+{remote_ch}', 'w')],
        'left_title': 'LANGUES DECLAREES', 'left_note': 'la langue que la chaine annonce, pas celle de chaque ligne',
        'table': {'cols': [('LANGUE', 7, '<'), ('KICK', 9, '>'), ('TWITCH', 9, '>'), ('TOTAL', 9, '>'), ('PART', 7, '>')],
                  'rows': [[(l[:6], 'r' if l == '?' else 'w'), (f'{k:,}', 'w'), (f'{w:,}', 'w'), (f'{k + w:,}', 'b'),
                            (f'{(k + w) / max(grand, 1):.1%}', 'w')] for l, (k, w) in top],
                  'bars': [tuple(v) for _, v in top]},
        'chart_title': 'KICK  -  LIGNES NOUVELLES PAR TOUR (1 min), TOUT LE RUN', 'chart': series,
        'chart_note': (f'min {min(series):,}   max {max(series):,}   dernier {series[-1]:,}') if series else '',
        'log_title': 'JOURNAL (moteur distant, puis Kick)',
        'log': [(f'en cours depuis {up // 3600} h {up % 3600 // 60:02d}, sans heure de fin', 'y'),
                (f'debit /min : kick {rate["kick"]:,.0f}  pc {rate.get("PC", 0):,.0f}  oracle {rate.get("ORACLE", 0):,.0f}'
                 f'  instabox {rate.get("INSTABOX", 0):,.0f}', 'g'),
                (f'rapatrie il y a : oracle {fresh["ORACLE"]} s  instabox {fresh["INSTABOX"]} s',
                 'r' if any(v is not None and v > 150 for v in fresh.values()) else 'w'),
                (f'kick http ok {ok}  refuse {ref}  prochain tour dans {http[-1][3] if http else "?"} s',
                 'r' if refused > 0.1 else 'g'),
                (f'chaines : kick {int(rounds[-1][3]) if rounds else 0}  twitch pc {tchan}  distantes {remote_ch}', 'w')]
               + [(l[:72], 'c') for l in rlog[-3:]] + [(f'kick tour {int(r[0]):>2}  +{int(r[1]):>5,}  lot {int(r[2]):>7,}  {r[3]} chaines', 'w') for r in [x[:1] + x[2:] for x in run_rounds[-3:][::-1]]]
               + ([(f'twitch : {disc} deconnexion(s), reconnecte seul', 'r')] if disc else []),
        'ticker': (f'   LIGNES {grand:,}   |   KICK {total["kick"]:,}   |   TWITCH {total["twitch"]:,}   |   '
                   f'{per_min:,.0f} LIGNES/MIN   |   {len(langs)} LANGUES   |   FIN {fin}   |'),
    }


if __name__ == '__main__':
    T.run(build, every=2)
