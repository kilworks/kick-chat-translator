// Extra han-only evidence, consulted only when the base traditional and simplified tables of langDetect.ts say nothing.
// Pure on purpose: the regexes arrive as parameters, so this module imports nothing from langDetect.ts.

export interface HanLists {
  /** Characters Chinese chat writes and Japanese chat does not (particles, pronouns, a few verbs). */
  zh?: RegExp;
}

export function extraHan(text: string, lists: HanLists): 'zh' | undefined {
  return lists.zh?.test(text) ? 'zh' : undefined;
}
