function fixOcrDigits(tok) {
  return tok
    .replace(/1mm/gi, 'INR')
    .replace(/O/g, '0')
    .replace(/o/g, '0')
    .replace(/l/g, '1')
    .replace(/I/g, '1')
    .replace(/[\u00A0\s,]/g, '');
}

export function normalizeNumbers(tokens = []) {
  const numbers = [];
  for (const t of tokens) {
    if (/%$/.test(t)) continue;
    const cleaned = fixOcrDigits(String(t));
    const numeric = cleaned.match(/\d+(?:\.\d+)?/);
    if (numeric) {
      const val = Number(numeric[0]);
      if (!Number.isNaN(val)) numbers.push(Math.round(val));
    }
  }
  const seen = new Set();
  const uniq = [];
  for (const n of numbers) {
    if (!seen.has(n)) { seen.add(n); uniq.push(n); }
  }
  const confidence = uniq.length ? Math.min(0.7 + uniq.length * 0.05, 0.98) : 0.0;
  return { numbers: uniq, confidence };
}
