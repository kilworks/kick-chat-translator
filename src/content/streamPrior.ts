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
  // Half-life of about 200 answers of the two families.
  private static readonly DECAY = Math.pow(0.5, 1 / 200);
  private static readonly MIN = 30;
  private static readonly SHARE = 0.6;

  observe(sure: string | undefined): void {
    const f = familyOf(sure);
    if (!f) return;
    this.ja *= StreamPrior.DECAY;
    this.zh *= StreamPrior.DECAY;
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

  reset(): void {
    this.ja = 0;
    this.zh = 0;
    this.seen = 0;
  }
}
