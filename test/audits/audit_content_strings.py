"""Every user-visible string the content script writes, and whether it goes
through the catalogue.

The t() coverage test only scans the options and popup bundles. The content
script reads `_locales` through msg() instead, and nothing checked that it did:
the hover placeholder sat there in English through every one of those runs.

Two earlier versions of this script under-reported, both in the same way, and
both would have read as good news:

  - asking for two words in a row missed 'Translating', the single most
    looked-at word the extension puts on screen, plus 'Auto' and 'OFF'
  - matching a line at a time missed `Reading chat in ...`, whose assignment
    sits on the line above the template

So it scans STATEMENTS: from a sink to the semicolon that closes it, however
many lines that takes.

A string is user-visible when it reaches textContent, title, placeholder,
aria-label, alt, or setAttribute for one of those, and holds a run of three or
more letters that is not a class name, a selector or a URL.
"""
import os
import re
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# A sink, then everything up to the semicolon that ends the statement.
STATEMENT = re.compile(
    r"(?:\.textContent|\.title|\.placeholder|\.innerText|\.alt)\s*=(.*?);\n"
    r"|setAttribute\(\s*['\"](?:title|aria-label|placeholder|alt)['\"]\s*,(.*?)\)\s*;\n",
    re.S,
)
LITERAL = re.compile(r"'([^'\\]*)'|\"([^\"\\]*)\"|`([^`]*)`")
WORDY = re.compile(r"[A-Za-z]{3}")
INTERPOLATION = re.compile(r"\$\{[^}]*\}")
CODEISH = re.compile(r"^(kt-|data-|aria-|https?:|#|\.|\[)")

# Deliberate exceptions, each with the reason it is not copy. Anything not on
# this list and not going through msg() is a finding.
KEEP_AS_IS = {
    # The chip shows ISO codes in a 44px monospace box: JA, PT-BR, ZH-TW. These
    # two are read in that register, not as English words, and a translated
    # word does not fit the box.
    'OFF': 'code sur la puce, meme registre que JA / PT-BR',
    'AUTO': 'code sur la puce, meme registre que JA / PT-BR',
}

FILES = [
    'src/content/injector.ts',
    'src/content/langChip.ts',
    'src/content/compose.ts',
    'src/content/composeUi.ts',
    'src/content/index.ts',
]

visible = 0
raw = []
kept = []
for path in FILES:
    if not os.path.exists(path):
        continue
    src = open(path, encoding='utf-8').read()
    for m in STATEMENT.finditer(src):
        expr = m.group(1) or m.group(2) or ''
        line = src[: m.start()].count('\n') + 1
        for lit in LITERAL.finditer(expr):
            text = next((g for g in lit.groups() if g), '')
            # A template's ${...} is code: `${name} (${native})` holds no copy.
            text = INTERPOLATION.sub('', text)
            if not WORDY.search(text) or CODEISH.match(text):
                continue
            if ' ' not in text and text == text.lower():
                continue  # a class or an attribute name
            visible += 1
            if text in KEEP_AS_IS:
                kept.append((path, line, text))
            elif 'msg(' not in expr:
                raw.append((path, line, text))

for path, line, text in raw:
    print(f'{path}:{line}: BRUT  {text[:70]}')
for path, line, text in kept:
    print(f'{path}:{line}: garde {text}  ({KEEP_AS_IS[text]})')
print()
print(
    f'{visible} chaines visibles | {len(raw)} hors catalogue | '
    f'{len(kept)} gardees telles quelles | {visible - len(raw) - len(kept)} via msg()'
)
sys.exit(1 if raw else 0)
