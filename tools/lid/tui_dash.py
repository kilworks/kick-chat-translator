"""Console dashboard in a stream style (SafeZone stock bot, KCT chat collection).

Copy this file next to the project's script, then:

    import tui_dash as T
    def build():                       # called every refresh; returns the whole screen as data
        return {
            'logo': T.logo('LID'),      # 4 lines of ASCII, or [] for none
            'title': 'KCT LANGUAGE ID  -  COLLECTE',
            'subtitle': 'what this screen is about, one line',
            'headline': 'LIGNES 566,918',          # the one number that matters, big and green
            'subline': 'kick 226,060    twitch 340,858',
            'cards': [('TOTAL', '566,918', 'w'), ('ERREURS', '0', 'g'), ...],   # color: w g y r c
            'left_title': 'LANGUES', 'left_note': 'what the table counts',
            'table': {'cols': [('LANGUE', 8, '<'), ('TOTAL', 10, '>')],
                      'rows': [[('en', 'w'), ('177,942', 'b')], ...],
                      'bars': [(4401, 173541), ...]},   # optional 2-segment bar per row (green, cyan), log scale
            'chart_title': 'LIGNES PAR MINUTE', 'chart': [ints...], 'chart_note': 'min 0  max 6,362',
            'progress': [('KICK', 0.27, '23:28', 'g'), ('TWITCH', 0.28, '23:24', 'c')],
            'log_title': 'JOURNAL', 'log': [('tour 7/30  +1,300', 'w'), ...],
            'ticker': 'LIGNES 566,918   |   KICK 226,060   |',
        }
    T.run(build, every=2)            # --once on the command line prints one frame and exits

Stdlib only. Needs a console of 120+ columns. Every value is a string the
caller formats; the module only lays out and colors.
"""
import math
import os
import re
import shutil
import sys
import time

ESC = '\033['
RST, BOLD = ESC + '0m', ESC + '1m'
COL = {'c': ESC + '96m', 'g': ESC + '92m', 'y': ESC + '93m', 'r': ESC + '91m', 'w': ESC + '97m', 'l': ESC + '94m',
       'b': ESC + '1m' + ESC + '97m'}  # never dark gray: unreadable on a black console
BLOCKS = ' ▁▂▃▄▅▆▇█'
ANSI = re.compile(r'\033\[[0-9;]*m')
FONT = {  # 4-line ASCII letters for the logo
    'A': [' __ ', '/  \\', '|--|', '|  |'], 'B': [' __ ', '|__)', '|  )', '|__)'], 'C': [' __ ', '/   ', '|   ', '\\__ '],
    'D': [' __ ', '|  \\', '|  |', '|__/'], 'E': [' __ ', '|__ ', '|   ', '|__ '], 'I': ['___', ' | ', ' | ', '_|_'],
    'K': ['    ', '| / ', '|<  ', '| \\ '], 'L': ['    ', '|   ', '|   ', '|__ '], 'O': [' __ ', '/  \\', '|  |', '\\__/'],
    'S': [' __ ', '(_  ', '  ) ', '__) '], 'T': ['___', ' | ', ' | ', ' | '], 'V': ['    ', '\\  /', ' \\/ ', '    '],
    'X': ['    ', '\\_/ ', '/ \\ ', '    '], ' ': ['  ', '  ', '  ', '  '],
}


def c(text, color):
    return COL[color] + str(text) + RST


def vis(s):
    return len(ANSI.sub('', s))


def pad(s, w):
    """Pad or cut a colored string to exactly w visible columns."""
    if vis(s) <= w:
        return s + ' ' * (w - vis(s))
    out, n = '', 0
    for part in re.split(r'(\033\[[0-9;]*m)', s):
        if part and ANSI.fullmatch(part):
            out += part
            continue
        take = part[:w - n]
        out, n = out + take, n + len(take)
        if n >= w:
            break
    return out + RST


def logo(word):
    letters = [FONT.get(ch, FONT[' ']) for ch in word.upper()]
    return [' '.join(l[i] for l in letters) for i in range(4)]


def chart(series, w, h):
    """Block bars of the last w values. Scale = 90th percentile, so one spike does not flatten the rest."""
    vals = list(series)[-w:]
    vals = [0] * (w - len(vals)) + vals
    top = sorted(vals)[int(len(vals) * 0.9)] or max(vals) or 1
    return [COL['g'] + ''.join(BLOCKS[max(0, min(8, int((min(v, top) / top * h - (r - 1)) * 8)))] for v in vals) + RST
            for r in range(h, 0, -1)]


def render(s, cols, rows):
    cols = max(cols, 120)
    out = []
    lg = s.get('logo') or ['', '', '', '']
    lw = max((len(x) for x in lg), default=0)
    title = [c(s.get('title', ''), 'b'), c(s.get('subtitle', ''), 'y'), '', '']
    head = [BOLD + c(s.get('headline', ''), 'g'), c(s.get('subline', ''), 'w'), '', '']
    for i in range(4):
        out.append(pad(c(lg[i].ljust(lw), 'c') + '   ' + pad(title[i], 72), lw + 78) + head[i])
    out.append(c('━' * cols, 'c'))
    cards = s.get('cards', [])
    if cards:
        cw = cols // len(cards)
        out.append(''.join(pad(c('▔' * (cw - 1), 'l'), cw) for _ in cards))
        out.append(''.join(pad(' ' + c(l, 'c'), cw) for l, _, _ in cards))
        out.append(''.join(pad(' ' + BOLD + c(v, k), cw) for _, v, k in cards))
        out.append('')
    lw2 = cols * 3 // 5
    rw = cols - lw2 - 3
    body_h = max(rows - len(out) - 3, 12)
    left = [c(s.get('left_title', ''), 'c') + '   ' + c(s.get('left_note', ''), 'y'), '']
    tb = s.get('table')
    if tb:
        # Every row stays visible: rows that do not fit the height wrap into side-by-side blocks
        # (a table cut at the window height hid 31 of 45 languages once).
        rows_all, bars = tb['rows'], tb.get('bars') or []
        fit = max(body_h - 4, 4)
        blocks = max(1, math.ceil(len(rows_all) / fit))
        bw_block = lw2 // blocks
        used = sum(w for _, w, _ in tb['cols'])
        cols_used = tb['cols']
        if used + 6 > bw_block:  # too narrow: keep the first column and the bold total only
            keep = [0] + [i for i, (v, k) in enumerate(rows_all[0]) if k == 'b'][:1] if rows_all else [0]
            cols_used = [tb['cols'][i] for i in keep]
            rows_all = [[r[i] for i in keep] for r in rows_all]
            used = sum(w for _, w, _ in cols_used)
        peak = max((a + b for a, b in bars), default=1) or 1
        bw = max(bw_block - used - 3, 0)
        per = math.ceil(len(rows_all) / blocks) if rows_all else 0
        grid = []
        for bi in range(blocks):
            col = [COL['c'] + ''.join(f'{n:{a}{w}}' for n, w, a in cols_used) + RST]
            for i in range(bi * per, min((bi + 1) * per, len(rows_all))):
                line = ''.join(c(f'{v:{a}{w}}', k) for (v, k), (_, w, a) in zip(rows_all[i], cols_used))
                if i < len(bars) and bw:
                    g, cy = bars[i]
                    width = bw * math.log1p(g + cy) / math.log1p(peak)
                    gb = int(round(width * g / (g + cy))) if g + cy else 0
                    line += ' ' + c('█' * gb, 'g') + c('█' * (int(round(width)) - gb), 'c')
                col.append(line)
            grid.append(col)
        for r in range(max(len(g) for g in grid)):
            left.append(''.join(pad(g[r] if r < len(g) else '', bw_block) for g in grid))
        left.append(c(f'{len(tb["rows"])} lignes, toutes affichees', 'y'))
    right = []
    if s.get('chart') is not None:
        right += [c(s.get('chart_title', ''), 'c')] + chart(s['chart'], rw, 8) + [c(s.get('chart_note', ''), 'w'), '']
    if s.get('progress'):
        right.append(c('AVANCEMENT', 'c'))
        pw = rw - 26
        for name, frac, end, k in s['progress']:
            f = int(min(max(frac, 0), 1) * pw)
            right.append(f'{c(f"{name:<7}", k)}{c("█" * f, k)}{"·" * (pw - f)} {frac:4.0%} {end}')
        right.append('')
    if s.get('log'):
        right.append(c(s.get('log_title', 'JOURNAL'), 'c'))
        right += [c(t, k) for t, k in s['log']]
    for i in range(max(len(left), len(right))):
        out.append(pad(left[i] if i < len(left) else '', lw2) + ' ' + c('│', 'l') + ' ' + (right[i] if i < len(right) else ''))
    msg = s.get('ticker', '')
    if msg:
        loop = msg * (cols // max(len(msg), 1) + 2)
        off = (int(time.time() / 2) * 3) % len(msg)
        out += [c('━' * cols, 'y'), BOLD + c(loop[off:off + cols], 'g')]
    return '\n'.join(pad(l, cols) for l in out)


def run(build, every=2.0):
    sys.stdout.reconfigure(encoding='utf-8')
    os.system('')  # constant empty command: only turns on ANSI colors in the Windows console
    once = '--once' in sys.argv
    print(ESC + '?25l' + ESC + '2J', end='')  # hide cursor, clear once; then redraw in place (no flicker)
    try:
        while True:
            cols, rows = shutil.get_terminal_size((160, 48))
            print(ESC + 'H' + render(build(), cols, rows), end='', flush=True)
            if once:
                return
            time.sleep(every)
    except KeyboardInterrupt:
        pass
    finally:
        print(RST + ESC + '?25h')


if __name__ == '__main__':
    assert vis(pad(c('abcdef', 'g'), 3)) == 3 and vis(pad('ab', 5)) == 5
    assert len(chart([1, 2, 50], 4, 2)) == 2
    assert len(logo('LID')) == 4
    demo = {'logo': logo('DEMO'), 'title': 'DEMO', 'subtitle': 'tui_dash self-test', 'headline': 'VALUE 42',
            'cards': [('A', '1', 'w'), ('B', '2', 'g')], 'left_title': 'ROWS',
            'table': {'cols': [('NAME', 8, '<'), ('N', 6, '>')], 'rows': [[('x', 'w'), ('5', 'b')]], 'bars': [(3, 2)]},
            'chart_title': 'CHART', 'chart': [1, 3, 2, 8], 'progress': [('JOB', 0.5, '12:00', 'g')],
            'log': [('ok', 'w')], 'ticker': 'DEMO   |'}
    assert 'VALUE 42' in ANSI.sub('', render(demo, 130, 30))
    many = dict(demo, table=dict(demo['table'], rows=[[(f'k{i:02}', 'w'), (str(i), 'b')] for i in range(45)],
                                 bars=[(i, i) for i in range(45)]))
    screen = ANSI.sub('', render(many, 130, 24))
    assert all(f'k{i:02}' in screen for i in range(45)), 'a row was cut by the window height'
    print('tui_dash ok')
