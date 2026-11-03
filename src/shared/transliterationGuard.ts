/**
 * Transliteration guard — detects when a translation provider returned a
 * phonetic transliteration instead of a semantic translation, and provides
 * instant overrides for common expressions.
 *
 * Problem: "bonjour" (FR) targeted to JA returns "ボンジュール" (katakana
 * phonetic spelling) instead of "こんにちは" (semantic: "hello").  This is a
 * known limitation of ALL MT engines on short, single-word inputs for distant
 * language pairs (Latin script -> CJK / Arabic / Cyrillic).
 *
 * Three-layer defense:
 * 1. **Override dictionary** — instant, zero-network lookup for ~50 common
 *    chat greetings/expressions across 6 target scripts.
 * 2. **Transliteration detection** — post-translation check; when detected,
 *    the translator chain skips to the next provider (different engines
 *    handle edge cases differently).
 * 3. **Context enhancement** — for DeepL, injects a disambiguation hint in
 *    the free `context` parameter on short inputs.
 */

// ─── Detection ──────────────────────────────────────────────────────────────

// 'yue' is spelled out rather than left to fall back on a base code, because it
// has none: `getSemanticOverride` below tries the full code then everything
// before the hyphen, and for Cantonese both are 'yue'. A variant that inherits
// from 'zh' gets this for free; this one does not.
const NON_LATIN_TARGETS = new Set([
  'ja', 'zh', 'zh-tw', 'yue', 'ko', 'ar', 'ru', 'th', 'hi',
  'he', 'fa', 'el', 'uk', 'bg', 'bn', 'ta',
]);

function isLatinInput(text: string): boolean {
  const stripped = text.replace(/[\s\p{P}\p{S}\d]/gu, '');
  if (stripped.length === 0) return false;
  // Basic Latin + Latin Extended-A/B + Latin Extended Additional
  return /^[A-zÀ-ɏḀ-ỿ]+$/u.test(stripped);
}

function katakanaRatio(text: string): number {
  const stripped = text.replace(/[\s\p{P}\p{S}]/gu, '');
  if (stripped.length === 0) return 0;
  let katakana = 0;
  for (const ch of stripped) {
    const c = ch.codePointAt(0)!;
    // Katakana (30A0-30FF), Katakana Phonetic Ext (31F0-31FF),
    // Half-width Katakana (FF65-FF9F)
    if (
      (c >= 0x30a0 && c <= 0x30ff) ||
      (c >= 0x31f0 && c <= 0x31ff) ||
      (c >= 0xff65 && c <= 0xff9f)
    ) {
      katakana++;
    }
  }
  return katakana / stripped.length;
}

/**
 * Returns true when the output is likely a phonetic transliteration of the
 * Latin-script input rather than a semantic translation.
 *
 * Current coverage:
 * - **Japanese**: pure katakana output for Latin input (very reliable).
 * - Other non-Latin targets are harder to detect and left to the override
 *   dictionary + provider cascade.
 */
export function isTransliteration(
  input: string,
  output: string,
  targetLang: string,
): boolean {
  const target = targetLang.toLowerCase();
  if (!NON_LATIN_TARGETS.has(target)) return false;
  if (!isLatinInput(input)) return false;

  // Short input heuristic: transliteration is almost exclusively a short-input
  // problem. For inputs > 6 words the provider almost always translates
  // semantically, and we'd risk false positives on legitimate katakana loanwords.
  const wordCount = input.trim().split(/\s+/).length;
  if (wordCount > 4) return false;

  if (target === 'ja') {
    // Pure katakana (> 80%) = transliteration.  A real translation would
    // contain kanji and/or hiragana.
    return katakanaRatio(output) > 0.8;
  }

  return false;
}

// ─── Semantic override dictionary ───────────────────────────────────────────
// Common chat greetings and expressions that providers consistently
// transliterate instead of translating on distant language pairs.
//
// Maintained by hand — only add entries that are CONFIRMED to fail on at
// least one major provider (Google, DeepL).  Each value is the natural
// chat-register translation, not the formal/dictionary form.

const OVERRIDES: Record<string, Record<string, string>> = {
  // ── French ────────────────────────────────────────────────────────────────
  'bonjour':          { ja: 'こんにちは', zh: '你好', ko: '안녕하세요', ar: 'مرحبا', ru: 'Привет', th: 'สวัสดี', hi: 'नमस्ते' },
  'bonsoir':          { ja: 'こんばんは', zh: '晚上好', ko: '안녕하세요', ar: 'مساء الخير', ru: 'Добрый вечер', th: 'สวัสดีตอนเย็น', hi: 'शुभ संध्या' },
  'salut':            { ja: 'やあ', zh: '嗨', ko: '안녕', ar: 'مرحبا', ru: 'Привет', th: 'สวัสดี', hi: 'नमस्ते' },
  'coucou':           { ja: 'やっほー', zh: '嘿', ko: '안녕', ar: 'مرحبا', ru: 'Привет', th: 'สวัสดี', hi: 'नमस्ते' },
  'merci':            { ja: 'ありがとう', zh: '谢谢', ko: '감사합니다', ar: 'شكرا', ru: 'Спасибо', th: 'ขอบคุณ', hi: 'धन्यवाद' },
  'au revoir':        { ja: 'さようなら', zh: '再见', ko: '안녕히 가세요', ar: 'مع السلامة', ru: 'До свидания', th: 'ลาก่อน', hi: 'अलविदा' },
  'bonne nuit':       { ja: 'おやすみなさい', zh: '晚安', ko: '잘 자요', ar: 'تصبح على خير', ru: 'Спокойной ночи', th: 'ราตรีสวัสดิ์', hi: 'शुभ रात्रि' },
  'oui':              { ja: 'はい', zh: '是', ko: '네', ar: 'نعم', ru: 'Да', th: 'ใช่', hi: 'हां' },
  'non':              { ja: 'いいえ', zh: '不', ko: '아니요', ar: 'لا', ru: 'Нет', th: 'ไม่', hi: 'नहीं' },
  "d'accord":         { ja: 'わかった', zh: '好的', ko: '알겠어', ar: 'حسنا', ru: 'Ладно', th: 'ตกลง', hi: 'ठीक है' },
  'bien joue':        { ja: 'お見事', zh: '干得好', ko: '잘했어', ar: 'أحسنت', ru: 'Отлично сыграно', th: 'เล่นดีมาก', hi: 'बहुत अच्छा' },
  'bien sur':         { ja: 'もちろん', zh: '当然', ko: '물론이지', ar: 'بالطبع', ru: 'Конечно', th: 'แน่นอน', hi: 'बिल्कुल' },
  'pas mal':          { ja: '悪くない', zh: '不错', ko: '괜찮네', ar: 'ليس سيئا', ru: 'Неплохо', th: 'ไม่เลว', hi: 'बुरा नहीं' },
  'bravo':            { ja: 'すごい', zh: '太棒了', ko: '대단해', ar: 'أحسنت', ru: 'Браво', th: 'เก่งมาก', hi: 'शाबाश' },
  'genial':           { ja: 'すごい', zh: '太好了', ko: '대박', ar: 'رائع', ru: 'Отлично', th: 'เยี่ยม', hi: 'बढ़िया' },
  'bisous':           { ja: 'チュッ', zh: '亲亲', ko: '뽀뽀', ar: 'بوسة', ru: 'Целую', th: 'จุ๊บ', hi: 'प्यार' },
  'allez':            { ja: 'がんばれ', zh: '加油', ko: '파이팅', ar: 'يلا', ru: 'Давай', th: 'สู้ๆ', hi: 'चलो' },
  'je rigole':        { ja: '冗談だよ', zh: '我开玩笑的', ko: '농담이야', ar: 'أمزح', ru: 'Я шучу', th: 'ล้อเล่น', hi: 'मजाक कर रहा हूं' },

  // ── Spanish ───────────────────────────────────────────────────────────────
  'hola':             { ja: 'こんにちは', zh: '你好', ko: '안녕하세요', ar: 'مرحبا', ru: 'Привет', th: 'สวัสดี', hi: 'नमस्ते' },
  'gracias':          { ja: 'ありがとう', zh: '谢谢', ko: '감사합니다', ar: 'شكرا', ru: 'Спасибо', th: 'ขอบคุณ', hi: 'धन्यवाद' },
  'adios':            { ja: 'さようなら', zh: '再见', ko: '안녕히 가세요', ar: 'مع السلامة', ru: 'До свидания', th: 'ลาก่อน', hi: 'अलविदा' },
  'buenos dias':      { ja: 'おはようございます', zh: '早上好', ko: '좋은 아침이에요', ar: 'صباح الخير', ru: 'Доброе утро', th: 'สวัสดีตอนเช้า', hi: 'सुप्रभात' },
  'buenas noches':    { ja: 'おやすみなさい', zh: '晚安', ko: '잘 자요', ar: 'تصبح على خير', ru: 'Спокойной ночи', th: 'ราตรีสวัสดิ์', hi: 'शुभ रात्रि' },
  'buenas tardes':    { ja: 'こんにちは', zh: '下午好', ko: '안녕하세요', ar: 'مساء الخير', ru: 'Добрый день', th: 'สวัสดีตอนบ่าย', hi: 'शुभ दोपहर' },
  'por favor':        { ja: 'お願いします', zh: '拜托', ko: '부탁해요', ar: 'من فضلك', ru: 'Пожалуйста', th: 'ได้โปรด', hi: 'कृपया' },
  'de nada':          { ja: 'どういたしまして', zh: '不客气', ko: '천만에요', ar: 'على الرحب والسعة', ru: 'Не за что', th: 'ไม่เป็นไร', hi: 'कोई बात नहीं' },
  'lo siento':        { ja: 'ごめんなさい', zh: '对不起', ko: '미안해요', ar: 'آسف', ru: 'Извините', th: 'ขอโทษ', hi: 'माफ़ कीजिए' },
  'vamos':            { ja: '行こう', zh: '走吧', ko: '가자', ar: 'هيا بنا', ru: 'Пойдём', th: 'ไปกันเถอะ', hi: 'चलो' },

  // ── English ───────────────────────────────────────────────────────────────
  'hello':            { ja: 'こんにちは', zh: '你好', ko: '안녕하세요', ar: 'مرحبا', ru: 'Привет', th: 'สวัสดี', hi: 'नमस्ते' },
  'goodbye':          { ja: 'さようなら', zh: '再见', ko: '안녕히 가세요', ar: 'مع السلامة', ru: 'До свидания', th: 'ลาก่อน', hi: 'अलविदा' },
  'bye':              { ja: 'さようなら', zh: '再见', ko: '안녕', ar: 'مع السلامة', ru: 'Пока', th: 'บาย', hi: 'अलविदा' },
  'thanks':           { ja: 'ありがとう', zh: '谢谢', ko: '고마워', ar: 'شكرا', ru: 'Спасибо', th: 'ขอบคุณ', hi: 'धन्यवाद' },
  'thank you':        { ja: 'ありがとうございます', zh: '谢谢你', ko: '감사합니다', ar: 'شكرا لك', ru: 'Спасибо', th: 'ขอบคุณครับ', hi: 'धन्यवाद' },
  'please':           { ja: 'お願いします', zh: '拜托', ko: '부탁해요', ar: 'من فضلك', ru: 'Пожалуйста', th: 'ได้โปรด', hi: 'कृपया' },
  'sorry':            { ja: 'ごめんなさい', zh: '对不起', ko: '미안해요', ar: 'آسف', ru: 'Извините', th: 'ขอโทษ', hi: 'माफ़ कीजिए' },
  'good morning':     { ja: 'おはようございます', zh: '早上好', ko: '좋은 아침이에요', ar: 'صباح الخير', ru: 'Доброе утро', th: 'สวัสดีตอนเช้า', hi: 'सुप्रभात' },
  'good night':       { ja: 'おやすみなさい', zh: '晚安', ko: '잘 자요', ar: 'تصبح على خير', ru: 'Спокойной ночи', th: 'ราตรีสวัสดิ์', hi: 'शुभ रात्रि' },
  'good evening':     { ja: 'こんばんは', zh: '晚上好', ko: '안녕하세요', ar: 'مساء الخير', ru: 'Добрый вечер', th: 'สวัสดีตอนเย็น', hi: 'शुभ संध्या' },
  'welcome':          { ja: 'ようこそ', zh: '欢迎', ko: '환영합니다', ar: 'مرحبا بك', ru: 'Добро пожаловать', th: 'ยินดีต้อนรับ', hi: 'स्वागत है' },
  'congratulations':  { ja: 'おめでとうございます', zh: '恭喜', ko: '축하합니다', ar: 'تهانينا', ru: 'Поздравляю', th: 'ยินดีด้วย', hi: 'बधाई हो' },
  'good luck':        { ja: '頑張って', zh: '祝你好运', ko: '행운을 빌어요', ar: 'حظا سعيدا', ru: 'Удачи', th: 'โชคดี', hi: 'शुभकामनाएं' },
  'have fun':         { ja: '楽しんで', zh: '玩得开心', ko: '즐겨', ar: 'استمتع', ru: 'Веселись', th: 'สนุกนะ', hi: 'मज़े करो' },
  'well played':      { ja: 'お見事', zh: '打得好', ko: '잘했어', ar: 'أحسنت', ru: 'Отлично сыграно', th: 'เล่นดีมาก', hi: 'बहुत अच्छा' },
  'good game':        { ja: 'いい試合だった', zh: '打得好', ko: '좋은 게임이었어', ar: 'لعبة جيدة', ru: 'Хорошая игра', th: 'เกมดีมาก', hi: 'अच्छा खेल' },
  'lets go':          { ja: '行くぞ', zh: '走吧', ko: '가자', ar: 'هيا بنا', ru: 'Погнали', th: 'ไปกันเถอะ', hi: 'चलो' },
  "let's go":         { ja: '行くぞ', zh: '走吧', ko: '가자', ar: 'هيا بنا', ru: 'Погнали', th: 'ไปกันเถอะ', hi: 'चलो' },
  'come on':          { ja: '頑張れ', zh: '加油', ko: '파이팅', ar: 'هيا', ru: 'Давай', th: 'สู้ๆ', hi: 'चलो' },

  // ── Portuguese ────────────────────────────────────────────────────────────
  'obrigado':         { ja: 'ありがとう', zh: '谢谢', ko: '감사합니다', ar: 'شكرا', ru: 'Спасибо', th: 'ขอบคุณ', hi: 'धन्यवाद' },
  'obrigada':         { ja: 'ありがとう', zh: '谢谢', ko: '감사합니다', ar: 'شكرا', ru: 'Спасибо', th: 'ขอบคุณ', hi: 'धन्यवाद' },
  'tchau':            { ja: 'さようなら', zh: '再见', ko: '안녕', ar: 'مع السلامة', ru: 'Пока', th: 'บาย', hi: 'अलविदा' },
  'bom dia':          { ja: 'おはようございます', zh: '早上好', ko: '좋은 아침이에요', ar: 'صباح الخير', ru: 'Доброе утро', th: 'สวัสดีตอนเช้า', hi: 'सुप्रभात' },
  'boa noite':        { ja: 'おやすみなさい', zh: '晚安', ko: '잘 자요', ar: 'تصبح على خير', ru: 'Спокойной ночи', th: 'ราตรีสวัสดิ์', hi: 'शुभ रात्रि' },
  'boa tarde':        { ja: 'こんにちは', zh: '下午好', ko: '안녕하세요', ar: 'مساء الخير', ru: 'Добрый день', th: 'สวัสดีตอนบ่าย', hi: 'शुभ दोपहर' },
  'valeu':            { ja: 'ありがとう', zh: '谢啦', ko: '고마워', ar: 'شكرا', ru: 'Спасибо', th: 'ขอบคุณ', hi: 'धन्यवाद' },
  'fala':             { ja: 'やあ', zh: '嗨', ko: '안녕', ar: 'مرحبا', ru: 'Привет', th: 'สวัสดี', hi: 'नमस्ते' },

  // ── German ────────────────────────────────────────────────────────────────
  'danke':            { ja: 'ありがとう', zh: '谢谢', ko: '감사합니다', ar: 'شكرا', ru: 'Спасибо', th: 'ขอบคุณ', hi: 'धन्यवाद' },
  'hallo':            { ja: 'こんにちは', zh: '你好', ko: '안녕하세요', ar: 'مرحبا', ru: 'Привет', th: 'สวัสดี', hi: 'नमस्ते' },
  'guten morgen':     { ja: 'おはようございます', zh: '早上好', ko: '좋은 아침이에요', ar: 'صباح الخير', ru: 'Доброе утро', th: 'สวัสดีตอนเช้า', hi: 'सुप्रभात' },
  'guten abend':      { ja: 'こんばんは', zh: '晚上好', ko: '안녕하세요', ar: 'مساء الخير', ru: 'Добрый вечер', th: 'สวัสดีตอนเย็น', hi: 'शुभ संध्या' },
  'gute nacht':       { ja: 'おやすみなさい', zh: '晚安', ko: '잘 자요', ar: 'تصبح على خير', ru: 'Спокойной ночи', th: 'ราตรีสวัสดิ์', hi: 'शुभ रात्रि' },
  'bitte':            { ja: 'お願いします', zh: '拜托', ko: '부탁해요', ar: 'من فضلك', ru: 'Пожалуйста', th: 'ได้โปรด', hi: 'कृपया' },
  'auf wiedersehen':  { ja: 'さようなら', zh: '再见', ko: '안녕히 가세요', ar: 'مع السلامة', ru: 'До свидания', th: 'ลาก่อน', hi: 'अलविदा' },
  'tschuss':          { ja: 'さようなら', zh: '再见', ko: '안녕', ar: 'مع السلامة', ru: 'Пока', th: 'บาย', hi: 'अलविदा' },
  'gut gemacht':      { ja: 'よくやった', zh: '干得好', ko: '잘했어', ar: 'أحسنت', ru: 'Молодец', th: 'ทำได้ดีมาก', hi: 'बहुत अच्छा' },

  // ── Italian ───────────────────────────────────────────────────────────────
  'ciao':             { ja: 'こんにちは', zh: '你好', ko: '안녕하세요', ar: 'مرحبا', ru: 'Привет', th: 'สวัสดี', hi: 'नमस्ते' },
  'grazie':           { ja: 'ありがとう', zh: '谢谢', ko: '감사합니다', ar: 'شكرا', ru: 'Спасибо', th: 'ขอบคุณ', hi: 'धन्यवाद' },
  'arrivederci':      { ja: 'さようなら', zh: '再见', ko: '안녕히 가세요', ar: 'مع السلامة', ru: 'До свидания', th: 'ลาก่อน', hi: 'अलविदा' },
  'buongiorno':       { ja: 'おはようございます', zh: '早上好', ko: '좋은 아침이에요', ar: 'صباح الخير', ru: 'Доброе утро', th: 'สวัสดีตอนเช้า', hi: 'सुप्रभात' },
  'buonasera':        { ja: 'こんばんは', zh: '晚上好', ko: '안녕하세요', ar: 'مساء الخير', ru: 'Добрый вечер', th: 'สวัสดีตอนเย็น', hi: 'शुभ संध्या' },
  'buonanotte':       { ja: 'おやすみなさい', zh: '晚安', ko: '잘 자요', ar: 'تصبح على خير', ru: 'Спокойной ночи', th: 'ราตรีสวัสดิ์', hi: 'शुभ रात्रि' },
  'prego':            { ja: 'どういたしまして', zh: '不客气', ko: '천만에요', ar: 'على الرحب والسعة', ru: 'Не за что', th: 'ไม่เป็นไร', hi: 'कोई बात नहीं' },
  'scusa':            { ja: 'ごめん', zh: '对不起', ko: '미안해', ar: 'آسف', ru: 'Извини', th: 'ขอโทษ', hi: 'माफ़ कीजिए' },
  'forza':            { ja: 'がんばれ', zh: '加油', ko: '파이팅', ar: 'هيا', ru: 'Давай', th: 'สู้ๆ', hi: 'चलो' },

  // ── Turkish ───────────────────────────────────────────────────────────────
  'merhaba':          { ja: 'こんにちは', zh: '你好', ko: '안녕하세요', ar: 'مرحبا', ru: 'Привет', th: 'สวัสดี', hi: 'नमस्ते' },
  'tesekkurler':      { ja: 'ありがとう', zh: '谢谢', ko: '감사합니다', ar: 'شكرا', ru: 'Спасибо', th: 'ขอบคุณ', hi: 'धन्यवाद' },
  'hosgeldiniz':      { ja: 'ようこそ', zh: '欢迎', ko: '환영합니다', ar: 'مرحبا بك', ru: 'Добро пожаловать', th: 'ยินดีต้อนรับ', hi: 'स्वागत है' },
  'iyi geceler':      { ja: 'おやすみなさい', zh: '晚安', ko: '잘 자요', ar: 'تصبح على خير', ru: 'Спокойной ночи', th: 'ราตรีสวัสดิ์', hi: 'शुभ रात्रि' },

  // ── Dutch ─────────────────────────────────────────────────────────────────
  'bedankt':          { ja: 'ありがとう', zh: '谢谢', ko: '감사합니다', ar: 'شكرا', ru: 'Спасибо', th: 'ขอบคุณ', hi: 'धन्यवाद' },
  'goedemorgen':      { ja: 'おはようございます', zh: '早上好', ko: '좋은 아침이에요', ar: 'صباح الخير', ru: 'Доброе утро', th: 'สวัสดีตอนเช้า', hi: 'सुप्रभात' },
  'goedenacht':       { ja: 'おやすみなさい', zh: '晚安', ko: '잘 자요', ar: 'تصبح على خير', ru: 'Спокойной ночи', th: 'ราตรีสวัสดิ์', hi: 'शुभ रात्रि' },

  // ── Polish ────────────────────────────────────────────────────────────────
  'dziekuje':         { ja: 'ありがとう', zh: '谢谢', ko: '감사합니다', ar: 'شكرا', ru: 'Спасибо', th: 'ขอบคุณ', hi: 'धन्यवाद' },
  'czesc':            { ja: 'やあ', zh: '嗨', ko: '안녕', ar: 'مرحبا', ru: 'Привет', th: 'สวัสดี', hi: 'नमस्ते' },
  'dobranoc':         { ja: 'おやすみなさい', zh: '晚安', ko: '잘 자요', ar: 'تصبح على خير', ru: 'Спокойной ночи', th: 'ราตรีสวัสดิ์', hi: 'शुभ रात्रि' },

  // ── Common romanized greetings (non-Latin origin, typed in Latin) ────────
  'konnichiwa':       { ja: 'こんにちは', zh: '你好', ko: '안녕하세요', ar: 'مرحبا', ru: 'Привет', th: 'สวัสดี', hi: 'नमस्ते' },
  'sayonara':         { ja: 'さようなら', zh: '再见', ko: '안녕히 가세요', ar: 'مع السلامة', ru: 'До свидания', th: 'ลาก่อน', hi: 'अलविदा' },
  'arigatou':         { ja: 'ありがとう', zh: '谢谢', ko: '감사합니다', ar: 'شكرا', ru: 'Спасибо', th: 'ขอบคุณ', hi: 'धन्यवाद' },
  'ganbatte':         { ja: '頑張って', zh: '加油', ko: '파이팅', ar: 'حظا سعيدا', ru: 'Удачи', th: 'สู้ๆ', hi: 'शुभकामनाएं' },
  'kawaii':           { ja: 'かわいい', zh: '可爱', ko: '귀여워', ar: 'جميل', ru: 'Милый', th: 'น่ารัก', hi: 'प्यारा' },
  'sugoi':            { ja: 'すごい', zh: '厉害', ko: '대단해', ar: 'رائع', ru: 'Круто', th: 'เจ๋ง', hi: 'बहुत अच्छा' },
  'umai':             { ja: 'うまい', zh: '厉害', ko: '잘한다', ar: 'ممتاز', ru: 'Круто', th: 'เก่ง', hi: 'अच्छा' },
  'yatta':            { ja: 'やった', zh: '太好了', ko: '해냈다', ar: 'نجحت', ru: 'Ура', th: 'สำเร็จ', hi: 'कर दिखाया' },

  // ── Chat / gaming ──────────────────────────────────────────────────────────
  'gg wp':            { ja: 'お疲れ様', zh: '打得好', ko: '수고했어', ar: 'لعبة جيدة', ru: 'Хорошая игра', th: 'เล่นดีมาก', hi: 'बहुत अच्छा' },
  'nice shot':        { ja: 'ナイスショット', zh: '好球', ko: '나이스 샷', ar: 'رمية جيدة', ru: 'Отличный удар', th: 'ยิงเก่ง', hi: 'अच्छा शॉट' },
  'well done':        { ja: 'よくやった', zh: '干得好', ko: '잘했어', ar: 'أحسنت', ru: 'Молодец', th: 'ทำได้ดี', hi: 'बहुत अच्छा' },
};

// ─── The nine non-Latin targets the table above leaves out ─────────────────
//
// Measured 2026-10-10 on the free Google endpoint, 18 table words alone into
// he, fa, el, uk, bg, bn, ta, zh-tw and yue: valeu came back as "it cost" in
// all nine, merci and gracias as "mercy" and "grace" in Greek, Bengali and
// Tamil, bonjour as "honour" in Persian, "friendship" in Bengali and "good
// luck" in Cantonese, and konnichiwa, arigatou, sugoi and kawaii spelled out
// phonetically. zh-tw also fell back on the 'zh' column above, so a
// Traditional reader got Simplified characters.
//
// Rather than nine more columns on 90 rows, each row names what it means and
// each language says it once. A row with no meaning here keeps the base-code
// fallback it had.
type Concept =
  | 'hello' | 'goodMorning' | 'goodAfternoon' | 'goodEvening' | 'goodNight' | 'bye'
  | 'thanks' | 'please' | 'youreWelcome' | 'sorry' | 'welcome' | 'yes' | 'no' | 'ok'
  | 'ofCourse' | 'notBad' | 'bravo' | 'great' | 'wellDone' | 'wellPlayed' | 'goodGame'
  | 'niceShot' | 'congrats' | 'goodLuck' | 'haveFun' | 'letsGo' | 'comeOn' | 'kisses'
  | 'joking' | 'cute' | 'didIt';

const KEY_CONCEPT: Record<string, Concept> = {
  'bonjour': 'hello', 'bonsoir': 'goodEvening', 'salut': 'hello', 'coucou': 'hello',
  'merci': 'thanks', 'au revoir': 'bye', 'bonne nuit': 'goodNight', 'oui': 'yes',
  'non': 'no', "d'accord": 'ok', 'bien joue': 'wellPlayed', 'bien sur': 'ofCourse',
  'pas mal': 'notBad', 'bravo': 'bravo', 'genial': 'great', 'bisous': 'kisses',
  'allez': 'comeOn', 'je rigole': 'joking',
  'hola': 'hello', 'gracias': 'thanks', 'adios': 'bye', 'buenos dias': 'goodMorning',
  'buenas noches': 'goodNight', 'buenas tardes': 'goodAfternoon', 'por favor': 'please',
  'de nada': 'youreWelcome', 'lo siento': 'sorry', 'vamos': 'letsGo',
  'hello': 'hello', 'goodbye': 'bye', 'bye': 'bye', 'thanks': 'thanks', 'thank you': 'thanks',
  'please': 'please', 'sorry': 'sorry', 'good morning': 'goodMorning', 'good night': 'goodNight',
  'good evening': 'goodEvening', 'welcome': 'welcome', 'congratulations': 'congrats',
  'good luck': 'goodLuck', 'have fun': 'haveFun', 'well played': 'wellPlayed',
  'good game': 'goodGame', 'lets go': 'letsGo', "let's go": 'letsGo', 'come on': 'comeOn',
  'obrigado': 'thanks', 'obrigada': 'thanks', 'tchau': 'bye', 'bom dia': 'goodMorning',
  'boa noite': 'goodNight', 'boa tarde': 'goodAfternoon', 'valeu': 'thanks', 'fala': 'hello',
  'danke': 'thanks', 'hallo': 'hello', 'guten morgen': 'goodMorning', 'guten abend': 'goodEvening',
  'gute nacht': 'goodNight', 'bitte': 'please', 'auf wiedersehen': 'bye', 'tschuss': 'bye',
  'gut gemacht': 'wellDone',
  'ciao': 'hello', 'grazie': 'thanks', 'arrivederci': 'bye', 'buongiorno': 'goodMorning',
  'buonasera': 'goodEvening', 'buonanotte': 'goodNight', 'prego': 'youreWelcome',
  'scusa': 'sorry', 'forza': 'comeOn',
  'merhaba': 'hello', 'tesekkurler': 'thanks', 'hosgeldiniz': 'welcome', 'iyi geceler': 'goodNight',
  'bedankt': 'thanks', 'goedemorgen': 'goodMorning', 'goedenacht': 'goodNight',
  'dziekuje': 'thanks', 'czesc': 'hello', 'dobranoc': 'goodNight',
  'konnichiwa': 'hello', 'sayonara': 'bye', 'arigatou': 'thanks', 'ganbatte': 'comeOn',
  'kawaii': 'cute', 'sugoi': 'great', 'umai': 'great', 'yatta': 'didIt',
  'gg wp': 'goodGame', 'nice shot': 'niceShot', 'well done': 'wellDone',
};

const CONCEPTS: Record<string, Record<Concept, string>> = {
  he: {
    hello: 'היי', goodMorning: 'בוקר טוב', goodAfternoon: 'צהריים טובים', goodEvening: 'ערב טוב',
    goodNight: 'לילה טוב', bye: 'ביי', thanks: 'תודה', please: 'בבקשה', youreWelcome: 'אין בעד מה',
    sorry: 'סליחה', welcome: 'ברוכים הבאים', yes: 'כן', no: 'לא', ok: 'בסדר', ofCourse: 'בטח',
    notBad: 'לא רע', bravo: 'כל הכבוד', great: 'מדהים', wellDone: 'כל הכבוד', wellPlayed: 'שיחקת יפה',
    goodGame: 'משחק טוב', niceShot: 'זריקה יפה', congrats: 'מזל טוב', goodLuck: 'בהצלחה',
    haveFun: 'תהנו', letsGo: 'יאללה', comeOn: 'יאללה', kisses: 'נשיקות', joking: 'סתם צוחק',
    cute: 'חמוד', didIt: 'הצלחנו',
  },
  fa: {
    hello: 'سلام', goodMorning: 'صبح بخیر', goodAfternoon: 'عصر بخیر', goodEvening: 'عصر بخیر',
    goodNight: 'شب بخیر', bye: 'خداحافظ', thanks: 'ممنون', please: 'لطفاً', youreWelcome: 'خواهش می‌کنم',
    sorry: 'ببخشید', welcome: 'خوش اومدی', yes: 'آره', no: 'نه', ok: 'باشه', ofCourse: 'البته',
    notBad: 'بد نیست', bravo: 'آفرین', great: 'عالیه', wellDone: 'آفرین', wellPlayed: 'خوب بازی کردی',
    goodGame: 'بازی خوبی بود', niceShot: 'شلیک خوبی بود', congrats: 'تبریک', goodLuck: 'موفق باشی',
    haveFun: 'خوش بگذره', letsGo: 'بزن بریم', comeOn: 'یالا', kisses: 'بوس', joking: 'شوخی کردم',
    cute: 'بامزه', didIt: 'موفق شدیم',
  },
  el: {
    hello: 'Γεια', goodMorning: 'Καλημέρα', goodAfternoon: 'Καλό απόγευμα', goodEvening: 'Καλησπέρα',
    goodNight: 'Καληνύχτα', bye: 'Αντίο', thanks: 'Ευχαριστώ', please: 'Παρακαλώ', youreWelcome: 'Τίποτα',
    sorry: 'Συγγνώμη', welcome: 'Καλώς ήρθες', yes: 'Ναι', no: 'Όχι', ok: 'Εντάξει', ofCourse: 'Φυσικά',
    notBad: 'Όχι άσχημα', bravo: 'Μπράβο', great: 'Τέλειο', wellDone: 'Μπράβο', wellPlayed: 'Ωραίο παίξιμο',
    goodGame: 'Καλό παιχνίδι', niceShot: 'Ωραία βολή', congrats: 'Συγχαρητήρια', goodLuck: 'Καλή τύχη',
    haveFun: 'Καλή διασκέδαση', letsGo: 'Πάμε', comeOn: 'Έλα', kisses: 'Φιλάκια', joking: 'Πλάκα κάνω',
    cute: 'Χαριτωμένο', didIt: 'Τα καταφέραμε',
  },
  uk: {
    hello: 'Привіт', goodMorning: 'Доброго ранку', goodAfternoon: 'Добрий день', goodEvening: 'Добрий вечір',
    goodNight: 'Добраніч', bye: 'Бувай', thanks: 'Дякую', please: 'Будь ласка', youreWelcome: 'Нема за що',
    sorry: 'Вибач', welcome: 'Ласкаво просимо', yes: 'Так', no: 'Ні', ok: 'Гаразд', ofCourse: 'Звісно',
    notBad: 'Непогано', bravo: 'Браво', great: 'Чудово', wellDone: 'Молодець', wellPlayed: 'Гарно зіграно',
    goodGame: 'Гарна гра', niceShot: 'Гарний постріл', congrats: 'Вітаю', goodLuck: 'Удачі',
    haveFun: 'Розважайся', letsGo: 'Погнали', comeOn: 'Давай', kisses: 'Цілую', joking: 'Я жартую',
    cute: 'Милота', didIt: 'Ура',
  },
  bg: {
    hello: 'Здравей', goodMorning: 'Добро утро', goodAfternoon: 'Добър ден', goodEvening: 'Добър вечер',
    goodNight: 'Лека нощ', bye: 'Чао', thanks: 'Благодаря', please: 'Моля', youreWelcome: 'Няма защо',
    sorry: 'Извинявай', welcome: 'Добре дошли', yes: 'Да', no: 'Не', ok: 'Добре', ofCourse: 'Разбира се',
    notBad: 'Не е зле', bravo: 'Браво', great: 'Супер', wellDone: 'Браво', wellPlayed: 'Добре изиграно',
    goodGame: 'Добра игра', niceShot: 'Хубав удар', congrats: 'Поздравления', goodLuck: 'Успех',
    haveFun: 'Забавлявай се', letsGo: 'Хайде', comeOn: 'Хайде', kisses: 'Целувки', joking: 'Шегувам се',
    cute: 'Сладко', didIt: 'Ура',
  },
  bn: {
    hello: 'হ্যালো', goodMorning: 'সুপ্রভাত', goodAfternoon: 'শুভ অপরাহ্ন', goodEvening: 'শুভ সন্ধ্যা',
    goodNight: 'শুভ রাত্রি', bye: 'বিদায়', thanks: 'ধন্যবাদ', please: 'দয়া করে', youreWelcome: 'কোনো ব্যাপার না',
    sorry: 'দুঃখিত', welcome: 'স্বাগতম', yes: 'হ্যাঁ', no: 'না', ok: 'ঠিক আছে', ofCourse: 'অবশ্যই',
    notBad: 'খারাপ না', bravo: 'সাবাশ', great: 'দারুণ', wellDone: 'সাবাশ', wellPlayed: 'দারুণ খেলেছ',
    goodGame: 'ভালো খেলা', niceShot: 'দারুণ শট', congrats: 'অভিনন্দন', goodLuck: 'শুভকামনা',
    haveFun: 'মজা করো', letsGo: 'চলো যাই', comeOn: 'চলো', kisses: 'চুমু', joking: 'মজা করছি',
    cute: 'মিষ্টি', didIt: 'পেরেছি',
  },
  ta: {
    hello: 'வணக்கம்', goodMorning: 'காலை வணக்கம்', goodAfternoon: 'மதிய வணக்கம்', goodEvening: 'மாலை வணக்கம்',
    goodNight: 'இனிய இரவு', bye: 'போய் வருகிறேன்', thanks: 'நன்றி', please: 'தயவுசெய்து', youreWelcome: 'பரவாயில்லை',
    sorry: 'மன்னிக்கவும்', welcome: 'வரவேற்கிறோம்', yes: 'ஆம்', no: 'இல்லை', ok: 'சரி', ofCourse: 'நிச்சயமாக',
    notBad: 'மோசமில்லை', bravo: 'சபாஷ்', great: 'அருமை', wellDone: 'சபாஷ்', wellPlayed: 'நன்றாக விளையாடினாய்',
    goodGame: 'நல்ல ஆட்டம்', niceShot: 'நல்ல ஷாட்', congrats: 'வாழ்த்துகள்', goodLuck: 'நல்வாழ்த்துகள்',
    haveFun: 'மகிழுங்கள்', letsGo: 'போகலாம்', comeOn: 'வா', kisses: 'முத்தங்கள்', joking: 'சும்மா சொன்னேன்',
    cute: 'அழகு', didIt: 'சாதித்தோம்',
  },
  'zh-tw': {
    hello: '你好', goodMorning: '早安', goodAfternoon: '午安', goodEvening: '晚上好',
    goodNight: '晚安', bye: '再見', thanks: '謝謝', please: '拜託', youreWelcome: '不客氣',
    sorry: '對不起', welcome: '歡迎', yes: '是', no: '不', ok: '好的', ofCourse: '當然',
    notBad: '不錯', bravo: '太棒了', great: '太好了', wellDone: '幹得好', wellPlayed: '打得好',
    goodGame: '打得好', niceShot: '好球', congrats: '恭喜', goodLuck: '祝你好運',
    haveFun: '玩得開心', letsGo: '走吧', comeOn: '加油', kisses: '親親', joking: '我開玩笑的',
    cute: '可愛', didIt: '太好了',
  },
  yue: {
    hello: '你好', goodMorning: '早晨', goodAfternoon: '午安', goodEvening: '晚上好',
    goodNight: '早唞', bye: '拜拜', thanks: '多謝', please: '唔該', youreWelcome: '唔使客氣',
    sorry: '對唔住', welcome: '歡迎', yes: '係', no: '唔係', ok: '好啦', ofCourse: '梗係啦',
    notBad: '唔錯', bravo: '好嘢', great: '正', wellDone: '做得好', wellPlayed: '打得好',
    goodGame: '打得好', niceShot: '好波', congrats: '恭喜', goodLuck: '祝你好運',
    haveFun: '玩得開心啲', letsGo: '走啦', comeOn: '加油', kisses: '錫晒', joking: '講笑咋',
    cute: '好可愛', didIt: '得咗',
  },
};

for (const [key, concept] of Object.entries(KEY_CONCEPT)) {
  const row = OVERRIDES[key];
  if (!row) continue;
  for (const [lang, words] of Object.entries(CONCEPTS)) row[lang] ??= words[concept];
}

// ─── Latin targets, for the words Google gets wrong there too ──────────────
//
// The table was for non-Latin targets on the belief that "providers handle
// those fine". Measured 2026-10-10 on the free Google endpoint into en, fr,
// es, de, tr and pl: valeu, the Brazilian "thanks", came back as "it cost" in
// every one, fala ("hey") as "he speaks", yatta as "on the yacht", coucou as
// "cuckoo", forza as "force", and arigatou, konnichiwa, sugoi, kawaii,
// ganbatte and umai untouched. Only those rows, and never into the language
// the word is from.
type LatinConcept = 'thanks' | 'hello' | 'didIt' | 'great' | 'cute' | 'comeOn';

const LATIN_KEYS: Record<string, { concept: LatinConcept; from?: string }> = {
  'valeu': { concept: 'thanks', from: 'pt' },
  'fala': { concept: 'hello', from: 'pt' },
  'coucou': { concept: 'hello', from: 'fr' },
  'forza': { concept: 'comeOn', from: 'it' },
  'yatta': { concept: 'didIt' },
  'arigatou': { concept: 'thanks' },
  'konnichiwa': { concept: 'hello' },
  'sugoi': { concept: 'great' },
  'umai': { concept: 'great' },
  'kawaii': { concept: 'cute' },
  'ganbatte': { concept: 'comeOn' },
};

/* Order: thanks, hello, didIt, great, cute, comeOn. */
const LATIN_WORDS: Record<string, [string, string, string, string, string, string]> = {
  en: ['thanks', 'hi', 'we did it', 'amazing', 'cute', 'come on'],
  fr: ['merci', 'salut', "on l'a fait", 'génial', 'mignon', 'allez'],
  es: ['gracias', 'hola', 'lo logramos', 'increíble', 'qué lindo', 'vamos'],
  pt: ['obrigado', 'oi', 'conseguimos', 'incrível', 'fofo', 'vai'],
  de: ['danke', 'hi', 'geschafft', 'krass', 'süß', 'los'],
  it: ['grazie', 'ciao', "ce l'abbiamo fatta", 'fantastico', 'carino', 'forza'],
  nl: ['bedankt', 'hoi', 'gelukt', 'geweldig', 'schattig', 'kom op'],
  pl: ['dzięki', 'cześć', 'udało się', 'niesamowite', 'słodkie', 'dawaj'],
  sv: ['tack', 'hej', 'vi klarade det', 'grymt', 'gulligt', 'kom igen'],
  cs: ['díky', 'ahoj', 'dokázali jsme to', 'úžasné', 'roztomilé', 'do toho'],
  sk: ['vďaka', 'ahoj', 'dokázali sme to', 'úžasné', 'zlaté', 'do toho'],
  ro: ['mersi', 'salut', 'am reușit', 'super', 'drăguț', 'haide'],
  tr: ['teşekkürler', 'selam', 'başardık', 'harika', 'tatlı', 'hadi'],
  vi: ['cảm ơn', 'chào', 'làm được rồi', 'đỉnh quá', 'dễ thương', 'cố lên'],
  id: ['makasih', 'halo', 'berhasil', 'keren', 'lucu', 'ayo'],
  ms: ['terima kasih', 'hai', 'berjaya', 'hebat', 'comel', 'ayuh'],
  fi: ['kiitos', 'moi', 'onnistuimme', 'mahtavaa', 'söpö', 'tsemppiä'],
  no: ['takk', 'hei', 'vi klarte det', 'rått', 'søtt', 'kom igjen'],
  da: ['tak', 'hej', 'vi klarede det', 'vildt', 'sødt', 'kom så'],
  hu: ['köszi', 'szia', 'sikerült', 'durva', 'cuki', 'hajrá'],
  ca: ['gràcies', 'hola', 'ho hem aconseguit', 'increïble', 'que mono', 'som-hi'],
  sl: ['hvala', 'živjo', 'uspelo nam je', 'super', 'srčkano', 'dajmo'],
  et: ['aitäh', 'tere', 'saime hakkama', 'vinge', 'armas', 'lähme'],
  lt: ['ačiū', 'labas', 'pavyko', 'nuostabu', 'miela', 'pirmyn'],
  lv: ['paldies', 'sveiki', 'izdevās', 'forši', 'mīlīgi', 'aiziet'],
  tl: ['salamat', 'hi', 'nagawa natin', 'galing', 'cute', 'kaya mo yan'],
};
const LATIN_INDEX: Record<LatinConcept, number> = { thanks: 0, hello: 1, didIt: 2, great: 3, cute: 4, comeOn: 5 };

for (const [key, { concept, from }] of Object.entries(LATIN_KEYS)) {
  const row = OVERRIDES[key];
  if (!row) continue;
  for (const [lang, words] of Object.entries(LATIN_WORDS)) {
    const word = words[LATIN_INDEX[concept]];
    if (word && lang !== from) row[lang] ??= word;
  }
}

/**
 * Normalize an input string for override lookup: lowercase, strip accents,
 * collapse whitespace.
 */
function normalizeForLookup(text: string): string {
  return text
    .trim()
    .toLowerCase()
    // Strip common accents so "merci" matches "mercì" etc.
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

/** Runs of three or more of the same letter, shortened to `keep` letters. */
function collapseLetterRuns(text: string, keep: 1 | 2): string {
  return text.replace(/(\p{L})\1{2,}/gu, keep === 1 ? '$1' : '$1$1');
}

/**
 * Look up a semantic override for a short expression that providers are
 * known to transliterate.  Returns the correct translation or undefined.
 *
 * Tries the full target code first ('zh-tw'), then the base code ('zh').
 *
 * Chat rarely types the bare key: 'merci!', 'holaaa' and 'gracias!!' all missed
 * an exact lookup and went to the provider that mistranslates them. Edge
 * punctuation and symbols are set aside and put back around the answer, so the
 * emphasis survives; Spanish opening marks are dropped, they mean nothing in
 * another script. Elongation is tried at two letters before one, because 'good'
 * and 'kawaii' are keys and 'holaaa' is not 'holaa'. No table key carries edge
 * punctuation or a run of three, so the bare forms look up exactly as before.
 */
export function getSemanticOverride(
  text: string,
  targetLang: string,
): string | undefined {
  const edges = /^([\p{P}\p{S}\s]*)(.*?)([\p{P}\p{S}\s]*)$/su.exec(text.trim());
  const core = edges?.[2] ?? '';
  if (!core) return undefined;
  const target = targetLang.toLowerCase();
  const base = target.split('-')[0] ?? target;
  const find = (key: string): string | undefined => OVERRIDES[key]?.[target] ?? OVERRIDES[key]?.[base];
  const key = normalizeForLookup(core);
  const answer = find(key) ?? find(collapseLetterRuns(key, 2)) ?? find(collapseLetterRuns(key, 1));
  if (answer === undefined) return undefined;
  return `${(edges?.[1] ?? '').replace(/[¡¿]/g, '').trimStart()}${answer}${edges?.[3] ?? ''}`;
}

// ─── Context enhancement ────────────────────────────────────────────────────

/**
 * Returns an enhanced context string for DeepL when the input is short
 * (1-3 words) and targeting a non-Latin language.  The hint nudges DeepL
 * toward semantic translation.  DeepL's `context` parameter is free — it
 * is not billed and does not consume quota.
 */
export function enhanceContextForShortInput(
  text: string,
  targetLang: string,
  existingContext?: string,
): string | undefined {
  if (!NON_LATIN_TARGETS.has(targetLang.toLowerCase())) return existingContext;

  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount > 3) return existingContext;

  const hint =
    'This is a live chat message. Translate the meaning into the target language. ' +
    'Do not transliterate phonetically into katakana, hangul, or any phonetic script.';
  return existingContext ? `${existingContext}\n${hint}` : hint;
}
