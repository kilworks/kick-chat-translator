"""Chat-style romanization of Hindi (Devanagari) and Bengali sentences.

Kick chat writes Hindi and Bengali in Latin letters ("kya kar raha hai",
"ki korcho"); Tatoeba only has the native scripts. This turns native sentences
into the loose spelling chat uses: inherent vowel 'a', dropped at word end
(Hindi schwa deletion), long vowels written single, nasals as 'n'. It is a
data generator for training only, not a transliteration standard.
"""
import random

HI_CONS = dict(zip('कखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसह',
                   'k kh g gh n ch chh j jh n t th d dh n t th d dh n p ph b bh m y r l v sh sh s h'.split()))
HI_CONS.update({'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'ड़': 'r', 'ढ़': 'rh', 'फ़': 'f'})
HI_VOW = dict(zip('अआइईउऊऋएऐओऔ', 'a aa i ee u oo ri e ai o au'.split()))
HI_MATRA = dict(zip('ािीुूृेैोौ', 'a i i u u ri e ai o au'.split()))
BN_CONS = dict(zip('কখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহ',
                   'k kh g gh n ch chh j jh n t th d dh n t th d dh n p ph b bh m j r l sh sh s h'.split()))
BN_CONS.update({'ড়': 'r', 'ঢ়': 'rh', 'য়': 'y', 'ৎ': 't'})
BN_VOW = dict(zip('অআইঈউঊঋএঐওঔ', 'o a i i u u ri e oi o ou'.split()))
BN_MATRA = dict(zip('ািীুূৃেৈোৌ', 'a i i u u ri e oi o ou'.split()))

TABLES = {
    'hi': (HI_CONS, HI_VOW, HI_MATRA, '्', 'ंँ', 'a'),
    'bn': (BN_CONS, BN_VOW, BN_MATRA, '্', 'ংঁ', 'o'),
}


def romanize(text: str, lang: str, rng: random.Random | None = None) -> str:
    cons, vow, matra, virama, nasal, inherent = TABLES[lang]
    words = []
    for word in text.split():
        out = []
        inherent_last = False
        chars = list(word)
        for i, c in enumerate(chars):
            nxt = chars[i + 1] if i + 1 < len(chars) else ''
            if c in cons:
                out.append(cons[c])
                inherent_last = nxt not in matra and nxt != virama and nxt != '़'
                if inherent_last:
                    # Bengali chat drops a medial inherent 'o' before a consonant cluster end ("korcho")
                    if lang == 'bn' and rng and nxt in cons and rng.random() < 0.5:
                        inherent_last = False
                        continue
                    out.append(inherent)
                continue
            elif c in vow:
                out.append(vow[c])
            elif c in matra:
                out.append(matra[c])
            elif c in nasal:
                out.append('n')
            elif c in (virama, '़', '।', '॥'):
                continue
            elif c.isascii():
                out.append(c)
            inherent_last = False
        w = ''.join(out)
        if inherent_last and len(w) > 2:
            w = w[:-1]  # final inherent vowel dropped: "kam" not "kama", but "kya", "pata" keep theirs
        if rng and rng.random() < 0.3:
            w = w.replace('aa', 'a').replace('ee', 'i').replace('oo', 'u')
        if w:
            words.append(w)
    return ' '.join(words).lower()


if __name__ == '__main__':
    for s, l in (('क्या कर रहे हो', 'hi'), ('मुझे नहीं पता', 'hi'), ('তুমি কি করছো', 'bn'), ('আমি জানি না', 'bn')):
        print(s, '->', romanize(s, l))
