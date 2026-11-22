"""Text normalization for deduplication. The features themselves come from
src/content/lid/model.ts through featurize.mjs, so training and inference share one
definition; this copy of lidNormalize only decides which texts are the same."""
import re
import unicodedata

URL = re.compile(r'https?://\S+|www\.\S+')
DIGIT = re.compile(r'[0-9]')
RUN = re.compile(r'(.)\1{2,}', re.S)
SPACE = re.compile(r'\s+')


def normalize(text: str) -> str:
    t = unicodedata.normalize('NFKC', text).lower()
    t = URL.sub(' u ', t)
    t = DIGIT.sub('0', t)
    t = RUN.sub(r'\1\1', t)
    return SPACE.sub(' ', t).strip()
