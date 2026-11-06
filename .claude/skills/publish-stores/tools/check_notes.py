"""Check translated release notes against en.txt before copying them into store/notes/.

usage: python check_notes.py <notes-dir> <repo>/store/notes
Every language that has a file in store/notes must exist in <notes-dir>, with LF endings, as many
paragraphs as en.txt, no dash or curly quote, and every "quoted" example and proper name of en.txt kept.
Red control: run it with store/notes itself as <notes-dir> (the previous release) and it must fail.
payloads.mjs still runs the accent and Cyrillic checks once the files are in the repository.
"""
import pathlib
import re
import sys

notes, langs = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
en = (notes / "en.txt").read_text(encoding="utf-8")
n_par = len([x for x in en.strip().split("\n\n") if x.strip()])
keep = set(re.findall(r'"([^"]+)"', en)) | {w for w in ("Kick", "Discord", "DeepL", "Twitch Chat Translator", "Google", "MyMemory", "Lingva", "7TV") if w in en}
bad = []
codes = sorted(p.stem for p in langs.glob("*.txt"))
for code in codes:
    p = notes / f"{code}.txt"
    if not p.exists():
        bad.append(f"{code}: missing")
        continue
    raw = p.read_bytes()
    t = raw.decode("utf-8")
    paras = [x for x in t.strip().split("\n\n") if x.strip()]
    if b"\r" in raw:
        bad.append(f"{code}: CRLF")
    if len(paras) != n_par:
        bad.append(f"{code}: {len(paras)} paragraphs, en has {n_par}")
    if re.search("[" + "".join(map(chr, (0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D))) + "]", t):
        bad.append(f"{code}: dash or curly quote")
    for s in sorted(keep):
        if s not in t:
            bad.append(f"{code}: lost {s!r}")
print(f"{len(codes)} langs, {len(bad)} problems")
print("\n".join(bad))
sys.exit(1 if bad else 0)
