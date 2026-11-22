"""Read public Twitch chat anonymously (official IRC, read-only justinfan login).

python tools/lid/twitch_irc.py --channels channels.json --out cap.jsonl --hours 4

channels.json: {"<broadcaster language>": ["login", ...]}, read from the public
directory. Same schema as test/e2e/capture-chat.mjs: {lang, ch, t, content}.
Emotes are cut out with the IRC emote tags (Twitch sends them as words), the
channel is renumbered and @mentions become @u<n>: no user or channel name is
written. Third-party chat: keep the output out of git.
"""
import argparse
import json
import random
import re
import socket
import time


def strip_emotes(text: str, tag: str) -> str:
    """Remove the emote ranges listed in the IRC 'emotes' tag (code point offsets)."""
    spans = []
    for part in filter(None, tag.split('/')):
        for rng in part.split(':', 1)[1].split(','):
            a, b = rng.split('-')
            spans.append((int(a), int(b)))
    cps = list(text)
    for a, b in sorted(spans, reverse=True):
        del cps[a:b + 1]
    return re.sub(r'\s+', ' ', ''.join(cps)).strip()


def parse(line: str):
    """(tags, channel, text) of a PRIVMSG line, else None."""
    if ' PRIVMSG #' not in line:
        return None
    tags = {}
    if line.startswith('@'):
        raw, line = line[1:].split(' ', 1)
        tags = dict(kv.split('=', 1) for kv in raw.split(';') if '=' in kv)
    m = re.match(r':\S+ PRIVMSG #(\S+) :(.*)', line)
    return (tags, m.group(1), m.group(2)) if m else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--channels', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--hours', type=float, default=4)
    a = ap.parse_args()
    by_lang = json.load(open(a.channels, encoding='utf-8'))
    lang_of = {c.lower(): l for l, cs in by_lang.items() for c in cs}
    chans = list(lang_of)
    renum, users = {}, {}
    end = time.time() + a.hours * 3600
    n = 0
    s = None
    with open(a.out, 'a', encoding='utf-8') as out:
        while time.time() < end:
            if s is None:
                # Twitch drops a reader that stops reading: joins are paced inside the read loop, never by sleeping.
                try:
                    s = socket.create_connection(('irc.chat.twitch.tv', 6667), timeout=1)
                except OSError:
                    time.sleep(10)
                    continue
                send = lambda x, s=s: s.sendall((x + '\r\n').encode())
                send('CAP REQ :twitch.tv/tags')
                send(f'NICK justinfan{random.randint(10000, 99999)}')
                todo, next_join, buf = list(chans), 0.0, b''
                print('connected', flush=True)
            try:
                if todo and time.time() >= next_join:  # anonymous join limit: 20 per 10 s
                    send('JOIN ' + ','.join('#' + c for c in todo[:20]))
                    todo, next_join = todo[20:], time.time() + 11
                data = s.recv(65536)
            except socket.timeout:
                continue
            except OSError as e:
                print('disconnected', e, flush=True)
                s.close()
                s = None
                time.sleep(5)
                continue
            if not data:
                s.close()
                s = None
                continue
            buf += data
            *lines, buf = buf.split(b'\r\n')
            for raw in lines:
                line = raw.decode('utf-8', 'replace')
                if line.startswith('PING'):
                    send('PONG' + line[4:])
                    continue
                p = parse(line)
                if not p:
                    continue
                tags, ch, text = p
                if text.startswith('\x01'):  # /me action
                    text = text.strip('\x01')[7:]
                text = strip_emotes(text, tags.get('emotes', ''))
                text = re.sub(r'@([A-Za-z0-9_]{2,25})', lambda m: '@u%d' % users.setdefault(m.group(1).lower(), len(users)), text)
                if not text:
                    continue
                renum.setdefault(ch, len(renum))
                out.write(json.dumps({'lang': lang_of.get(ch, '?'), 'ch': renum[ch], 't': time.strftime('%Y-%m-%dT%H:00Z', time.gmtime()), 'content': text}, ensure_ascii=False) + '\n')
                n += 1
                if n % 1000 == 0:
                    out.flush()
                    print(n, 'lines', len(renum), 'channels', flush=True)
    print('done', n)


if __name__ == '__main__':
    assert strip_emotes('hi Kappa there LUL', '25:3-7/425618:15-17') == 'hi there'
    assert parse('@emotes= :a!a@a PRIVMSG #chan :bonjour') == ({'emotes': ''}, 'chan', 'bonjour')
    main()
