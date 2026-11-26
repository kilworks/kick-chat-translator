// Generated from labelled lines of known origin; see docs/han-detection.md (pass A2). Do not edit by hand.
// Han characters that occur in at least 10 Japanese train lines and in no Chinese train line.
const JA_ONLY = new Set(Array.from('両乗亜仏仮伝価兎児冨処刈剣剤労効卍単厳収呪唖営団囲図圏圧塩増壊売奨妬姉実対専嶋巣巻帯帰庁広廃弁弾彡従応悩悪戯戸拝拠拡挙撃斉斎曽栄桜検楽様権樫檜欝歓歩歯歴毎気氷汚沢浄浜涙渋渕満濯瀬焼獣瑠砕穂篠粛経継総縄縦缶脇脳臓舎苺薬蛍覚覧観訳読譲豊賛贄転軽辺込郷酢醤釈鉄銃銭鋭錬録関闘険隠隷雑霊靭駄駅駆騒験髪鮎麺黒黙齢'));

/** True when the line holds a Han character that only Japanese writes. Linear in the line length. */
export function hasJaOnlyForm(text: string): boolean {
  for (const ch of text) if (JA_ONLY.has(ch)) return true;
  return false;
}
