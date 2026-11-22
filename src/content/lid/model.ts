/**
 * Language identification by a trained hashed n-gram classifier.
 *
 * Trained offline by tools/lid/train.py (multinomial logistic regression over
 * hashed character 1-4 grams and words, mean pooled, temperature calibrated),
 * shipped as int8 weights in weights.generated.ts. The training features are
 * computed by THIS file (tools/lid/featurize.mjs imports it), so training and
 * inference cannot disagree on what a feature is.
 *
 * Weight format v1, little endian: "LID1", u32 buckets, u32 classes,
 * f32 temperature, per class (u8 length + UTF-8 label), f32 bias[classes],
 * f32 scale[buckets], int8 weight[buckets * classes], u32 FNV-1a checksum of
 * every byte before it. Anything that does not parse makes the model absent,
 * and callers fall back to the detection they had before it.
 */
import { LID_WEIGHTS } from './weights.generated';

const MAX_CHARS = 256; // a 5000-character paste costs what a normal line costs

export function lidNormalize(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/https?:\/\/\S+|www\.\S+/gu, ' u ')
    .replace(/[0-9]/g, '0')
    .replace(/(.)\1{2,}/gsu, '$1$1')
    .replace(/\s+/gu, ' ')
    .trim();
}

function utf8(cp: number): number[] {
  if (cp < 0x80) return [cp];
  if (cp < 0x800) return [0xc0 | (cp >> 6), 0x80 | (cp & 63)];
  if (cp < 0x10000) return [0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)];
  return [0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)];
}

const FNV_OFFSET = 0x811c9dc5;
const fnvStep = (h: number, b: number): number => Math.imul(h ^ b, 0x01000193) >>> 0;

/** Hashed features of normalized text, each in [0, buckets). `buckets` is a power of two. */
export function lidFeatures(norm: string, buckets: number): number[] {
  const cps = Array.from(norm).slice(0, MAX_CHARS);
  const chars = [' ', ...cps, ' '].map((c) => utf8(c.codePointAt(0)!));
  const mask = buckets - 1;
  const out: number[] = [];
  for (let n = 1; n <= 4; n++) {
    for (let i = 0; i + n <= chars.length; i++) {
      let h = FNV_OFFSET;
      for (let k = i; k < i + n; k++) for (const b of chars[k]!) h = fnvStep(h, b);
      out.push(h & mask);
    }
  }
  const words = [' ', ...cps, ' '].join('').split(' ');
  for (const w of words) {
    if (!w) continue;
    let h = FNV_OFFSET;
    for (const b of [0x77, 0x3a]) h = fnvStep(h, b); // "w:"
    for (const c of Array.from(w)) for (const b of utf8(c.codePointAt(0)!)) h = fnvStep(h, b);
    out.push(h & mask);
  }
  return out;
}

interface Model {
  buckets: number;
  labels: string[];
  temperature: number;
  bias: Float32Array;
  scale: Float32Array;
  weight: Int8Array;
}

export function decodeModel(b64: string): Model | undefined {
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const view = new DataView(bytes.buffer);
    if (bin.slice(0, 4) !== 'LID1') return undefined;
    const end = bytes.length - 4;
    let h = FNV_OFFSET;
    for (let i = 0; i < end; i++) h = fnvStep(h, bytes[i]!);
    if (h !== view.getUint32(end, true)) return undefined;
    let o = 4;
    const buckets = view.getUint32(o, true);
    const classes = view.getUint32(o + 4, true);
    const temperature = view.getFloat32(o + 8, true);
    o += 12;
    const labels: string[] = [];
    const dec = new TextDecoder();
    for (let c = 0; c < classes; c++) {
      const len = bytes[o]!;
      labels.push(dec.decode(bytes.subarray(o + 1, o + 1 + len)));
      o += 1 + len;
    }
    const floats = (n: number): Float32Array => {
      const a = new Float32Array(n);
      for (let i = 0; i < n; i++) a[i] = view.getFloat32(o + 4 * i, true);
      o += 4 * n;
      return a;
    };
    const bias = floats(classes);
    const scale = floats(buckets);
    if (o + buckets * classes !== end) return undefined;
    const weight = new Int8Array(bytes.buffer, o, buckets * classes);
    return { buckets, labels, temperature, bias, scale, weight };
  } catch {
    return undefined;
  }
}

let model: Model | undefined | null = null;
const loaded = (): Model | undefined => (model === null ? (model = decodeModel(LID_WEIGHTS)) : model);

export function lidReady(): boolean {
  return loaded() !== undefined;
}

/** Calibrated class probabilities, or undefined when there is no model or no text. */
export function lidProbabilities(text: string, m: Model | undefined = loaded()): Map<string, number> | undefined {
  if (!m) return undefined;
  const norm = lidNormalize(text);
  if (!norm) return undefined;
  const feats = lidFeatures(norm, m.buckets);
  const C = m.labels.length;
  const z = new Float64Array(C);
  for (const f of feats) {
    const s = m.scale[f]!;
    const row = f * C;
    for (let c = 0; c < C; c++) z[c]! += s * m.weight[row + c]!;
  }
  let max = -Infinity;
  for (let c = 0; c < C; c++) {
    z[c] = (z[c]! / feats.length + m.bias[c]!) / m.temperature;
    if (z[c]! > max) max = z[c]!;
  }
  let sum = 0;
  for (let c = 0; c < C; c++) sum += z[c] = Math.exp(z[c]! - max);
  const out = new Map<string, number>();
  for (let c = 0; c < C; c++) out.set(m.labels[c]!, z[c]! / sum);
  return out;
}

/** Most likely language and its calibrated probability. */
export function lidPredict(text: string): { lang: string; p: number } | undefined {
  const probs = lidProbabilities(text);
  if (!probs) return undefined;
  let lang = '';
  let p = -1;
  for (const [l, v] of probs) if (v > p) [lang, p] = [l, v];
  return { lang, p };
}
