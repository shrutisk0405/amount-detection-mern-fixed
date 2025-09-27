// Improved number extraction: supports plain long digits and grouped numbers
// Preclean OCR artifacts like '1mm' -> 'INR'
const percentRe = /\d+(?:\.\d+)?%/g;
// Matches either 1) grouped numbers with separators or 2) plain long digit sequences
const numberRe = /(?:\b\d{1,3}(?:[\s,]\d{3})+(?:\.\d+)?\b|\b\d+(?:\.\d+)?\b)/gim;

const currencyHints = [/INR/i, /₹/, /Rs\.?/i, /Rupee/i];

function preClean(text = "") {
  if (!text) return "";
  return text
    .replace(/\u00A0/g, ' ')
    .replace(/[\t\r]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/1mm/gi, 'INR');
}

export function extractTokens(text = "") {
  const cleaned = preClean(text);
  const tokens = [];
  if (!cleaned) return { tokens: [], currencyHint: "INR", confidence: 0.0 };

  const percents = cleaned.match(percentRe) || [];
  const numbers = cleaned.match(numberRe) || [];

  tokens.push(...numbers, ...percents);
  const confidence = tokens.length ? Math.min(0.6 + tokens.length * 0.05, 0.95) : 0.0;
  const currencyHint = currencyHints.some((re) => re.test(cleaned)) ? "INR" : "INR";
  return { tokens, currencyHint, confidence };
}
