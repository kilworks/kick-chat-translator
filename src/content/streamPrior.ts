// A running prior on the language family of the open channel, built from the sure answers of confidentLanguage.
// It settles Han-only lines, which carry no script evidence of their own. In memory only: never stored, never sent.
export type Family = 'ja' | 'zh';

/** Japanese, or Chinese (zh, zh-tw, yue); any other language is not a family. */
export function familyOf(lang: string | undefined): Family | undefined {
  if (lang === 'ja') return 'ja';
  if (lang === 'zh' || lang === 'zh-tw' || lang === 'yue') return 'zh';
  return undefined;
}

export class StreamPrior {
  private ja = 0;
  private zh = 0;
  private seen = 0;
  // Chinese answers only, with how many of them were Cantonese: the Cantonese share of the stream.
  private chinese = 0;
  private yue = 0;
  private chineseSeen = 0; // raw count: the decayed total above never reaches the minimum on time
  // Half-life of about 200 answers of the two families.
  private static readonly DECAY = Math.pow(0.5, 1 / 200);
  private static readonly MIN = 30;
  private static readonly SHARE = 0.6;
  // Mainland and Taiwan streams name 0.4 percent of their Chinese lines `yue` at most (31 Twitch units); Cantonese ones name
  // about 55 percent (the rest read Traditional or nothing). 0.25 sits in the gap.
  private static readonly YUE_MIN = 30;
  private static readonly YUE_SHARE = 0.25;

  observe(sure: string | undefined): void {
    const f = familyOf(sure);
    if (!f) return;
    this.ja *= StreamPrior.DECAY;
    this.zh *= StreamPrior.DECAY;
    if (f === 'zh') {
      this.chineseSeen++;
      this.chinese = this.chinese * StreamPrior.DECAY + 1;
      this.yue = this.yue * StreamPrior.DECAY + (sure === 'yue' ? 1 : 0);
    }
    if (f === 'ja') this.ja += 1;
    else this.zh += 1;
    this.seen++;
  }

  family(): Family | undefined {
    if (this.seen < StreamPrior.MIN) return undefined;
    const total = this.ja + this.zh;
    if (this.ja / total >= StreamPrior.SHARE) return 'ja';
    if (this.zh / total >= StreamPrior.SHARE) return 'zh';
    return undefined;
  }

  /** True on a stream whose Chinese is mostly Cantonese: a Traditional line there is probably Cantonese, not Mandarin. */
  cantonese(): boolean {
    return this.chineseSeen >= StreamPrior.YUE_MIN && this.yue / this.chinese >= StreamPrior.YUE_SHARE;
  }

  reset(): void {
    this.chinese = 0;
    this.yue = 0;
    this.chineseSeen = 0;
    this.ja = 0;
    this.zh = 0;
    this.seen = 0;
  }
}
