const labelMatchers = [
  { type: "total_bill", patterns: [/grand\s*total/i, /total\s*bill/i, /total\b/i, /amount\s*payable/i] },
  { type: "paid", patterns: [/paid\b/i, /amount\s*paid/i, /received\b/i] },
  { type: "due", patterns: [/due\b/i, /balance\b/i, /outstanding\b/i, /to\s*pay/i] },
];

function findNearestLabel(text, number) {
  const idx = text.indexOf(String(number));
  if (idx === -1) return null;
  const window = 50;
  const left = Math.max(0, idx - window);
  const right = Math.min(text.length, idx + String(number).length + window);
  const snippet = text.slice(left, right);
  for (const lm of labelMatchers) {
    for (const p of lm.patterns) {
      if (p.test(snippet)) return lm.type;
    }
  }
  return null;
}

export function classifyByContext(text = "", numbers = []) {
  const amounts = [];
  const assigned = new Set();
  for (const n of numbers) {
    const label = findNearestLabel(text, n);
    if (label && !assigned.has(label)) {
      amounts.push({ type: label, value: n });
      assigned.add(label);
    }
  }
  const remaining = numbers.filter(n => !amounts.find(a => a.value === n));
  if (remaining.length && !assigned.has("total_bill")) {
    amounts.push({ type: "total_bill", value: Math.max(...remaining) });
    assigned.add("total_bill");
  }
  if (remaining.length && !assigned.has("due")) {
    const min = Math.min(...remaining);
    if (!amounts.find(a => a.value === min)) amounts.push({ type: "due", value: min });
    assigned.add("due");
  }
  const confidence = amounts.length ? 0.8 : 0.0;
  return { amounts, confidence };
}
