// server/services/pipeline.js

import { ocrFromRequest } from "./ocr.js";
import { extractTokens } from "./extract.js";
import { normalizeNumbers } from "./normalize.js";
import { classifyByContext } from "./classify.js"; // kept import in case other callers still use it
import { validateOrThrow, cleanSource } from "../utils/schema.js";

import extractSchema from "../schemas/extract.schema.json" assert { type: "json" };
import normalizeSchema from "../schemas/normalize.schema.json" assert { type: "json" };
import classifySchema from "../schemas/classify.schema.json" assert { type: "json" };
import processSchema from "../schemas/process.schema.json" assert { type: "json" };

/* --------------------------- STEP 1: EXTRACT --------------------------- */

export async function extractStep(req) {
  const rawText = await ocrFromRequest(req); // handles text OR file
  const { tokens, currencyHint, confidence } = extractTokens(rawText);

  if (!tokens || !tokens.length) {
    return { data: { status: "no_amounts_found", reason: "document too noisy" } };
  }

  const payload = { raw_tokens: tokens, currency_hint: currencyHint, confidence };
  try { validateOrThrow(extractSchema, payload); } catch (e) { /* optionally log */ }
  return { data: payload };
}

/* ------------------------- STEP 2: NORMALIZE --------------------------- */
/* Keeps your improved OCR fixes. Returns { normalized_amounts, normalization_confidence } */

export async function normalizeStep(tokens = []) {
  const looksLikePercent = (t) => /%/.test(t);
  const stripCurrency = (t) => t.replace(/(?:₹|rs\.?|inr)/gi, "");
  const stripSeparators = (t) => t.replace(/[,\s]/g, "");

  const fixOcrDigitConfusions = (t) => {
    // Only when adjacent to digits:
    t = t.replace(/(?<=\d)[Oo]|[Oo](?=\d)/g, "0"); // O/o -> 0
    t = t.replace(/(?<=\d)[Il]|[Il](?=\d)/g, "1"); // I/l -> 1
    t = t.replace(/(?<=\d)S|S(?=\d)/g, "5");      // S -> 5
    t = t.replace(/(?<=\d)B|B(?=\d)/g, "8");      // B -> 8
    t = t.replace(/[–—]/g, "-");                  // unicode dashes
    return t;
  };

  const normalized = [];
  let changedCount = 0;

  for (let raw of tokens) {
    if (typeof raw !== "string") continue;
    if (looksLikePercent(raw)) continue; // skip % tokens

    let t = stripCurrency(raw);
    const beforeFix = t;
    t = fixOcrDigitConfusions(t);
    if (t !== beforeFix) changedCount++;

    t = stripSeparators(t);
    const m = t.match(/^-?\d+(?:\.\d+)?$/);
    if (!m) continue;

    const num = Number(m[0]);
    if (!Number.isFinite(num)) continue;

    normalized.push(num);
  }

  const touched = tokens.length ? (changedCount / tokens.length) : 0;
  const normalization_confidence = Number((0.9 - 0.4 * touched).toFixed(2)); // ~0.5..0.9

  const payload = { normalized_amounts: normalized, normalization_confidence };
  try { validateOrThrow(normalizeSchema, payload); } catch (e) { /* optionally log */ }
  return { data: payload };
}

/* ---------------------- STEP 3: CLASSIFY (context) --------------------- */
/* Uses proximity windows + keyword scoring; skips numbers not present in text.
   Produces per-amount provenance snippets (source). */

export async function classifyStep(text = "", numbers = []) {
  const raw = String(text || "");
  const lower = raw.toLowerCase();

  const KW = {
    total: [
      "total", "grand total", "net amount", "amount payable",
      "total amount", "bill amount", "final amount", "net payable"
    ],
    paid: [
      "paid", "amount received", "payment received", "received",
      "advance", "deposit"
    ],
    due: [
      "due", "balance", "to pay", "outstanding",
      "remaining", "payable", "arrears", "balance due"
    ],
    negative: ["tax", "cgst", "sgst", "igst", "discount", "round off", "roundoff", "round-off"]
  };

  const WINDOW = 36;

  function findNumberIndex(num) {
    const asStr = String(num);
    return lower.indexOf(asStr); // -1 if not found
  }

  function snippetAround(idx, len) {
    if (idx < 0) return `text: '${raw.slice(0, 48).trim().replace(/\s+/g, " ")}'`;
    const start = Math.max(0, idx - WINDOW);
    const end = Math.min(raw.length, idx + len + WINDOW);
    const snip = raw.slice(start, end).trim().replace(/\s+/g, " ");
    return `text: '${snip}'`;
  }

  function scoreContext(ctxLower) {
    const score = { total_bill: 0, paid: 0, due: 0 };

    function addScore(list, key) {
      for (const kw of list) {
        const i = ctxLower.indexOf(kw);
        if (i !== -1) {
          const bonus = /:/.test(ctxLower.slice(i, i + kw.length + 3)) ? 1 : 0; // "Paid: 1000"
          const center = Math.floor(ctxLower.length / 2);
          const dist = Math.abs(i - center);
          const proximity = dist <= 8 ? 2 : dist <= 16 ? 1 : 0;
          score[key] += 1 + bonus + proximity;
        }
      }
    }

    addScore(KW.total, "total_bill");
    addScore(KW.paid, "paid");
    addScore(KW.due, "due");

    for (const neg of KW.negative) {
      if (ctxLower.includes(neg)) {
        score.total_bill = Math.max(0, score.total_bill - 1);
        score.paid       = Math.max(0, score.paid - 1);
        score.due        = Math.max(0, score.due - 1);
      }
    }

    return score;
  }

  const candidates = [];

  for (const num of numbers) {
    const asStr = String(num);
    const idx = findNumberIndex(asStr);

    // Skip numbers NOT present in text
    if (idx === -1) continue;

    const ctx = raw.slice(
      Math.max(0, idx - WINDOW),
      Math.min(raw.length, idx + asStr.length + WINDOW)
    );

    const ctxLower = ctx.toLowerCase();
    const labelScore = scoreContext(ctxLower);

    // Additional light hints
    if (/paid[^0-9]{0,12}\b/.test(ctxLower)) labelScore.paid += 1;
    if (/total[^0-9]{0,12}\b/.test(ctxLower)) labelScore.total_bill += 1;
    if (/\bdue[^0-9]{0,12}\b/.test(ctxLower)) labelScore.due += 1;

    let bestType = "total_bill";
    let bestScore = -1;
    for (const [k, v] of Object.entries(labelScore)) {
      if (v > bestScore) { bestScore = v; bestType = k; }
    }
    if (bestScore <= 0) bestType = "total_bill";

    const source = snippetAround(idx, asStr.length);
    candidates.push({ type: bestType, value: num, score: bestScore, source, idx });
  }

  function bestOf(type, tieBreaker) {
    const list = candidates.filter(c => c.type === type);
    if (!list.length) return null;
    list.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return tieBreaker ? tieBreaker(a, b) : 0;
    });
    return list[0];
  }

  const bestTotal = bestOf("total_bill", (a, b) => b.value - a.value); // prefer bigger total
  const bestPaid  = bestOf("paid",       (a, b) => b.score - a.score);
  let   bestDue   = bestOf("due",        (a, b) => a.value - b.value); // prefer smaller due

  // Derive missing fields if two are known
  if (!bestPaid && bestTotal && bestDue) {
    const pv = Math.max(0, Number((bestTotal.value - bestDue.value).toFixed(2)));
    if (pv > 0 && pv <= bestTotal.value) {
      candidates.push({ type: "paid", value: pv, score: 1, source: "derived: total - due" });
    }
  }
  if (!bestDue && bestTotal && bestPaid) {
    const dv = Math.max(0, Number((bestTotal.value - bestPaid.value).toFixed(2)));
    candidates.push({ type: "due", value: dv, score: 1, source: "derived: total - paid" });
  }

  // Final selection after possible derivations
  const finalTotal = bestOf("total_bill", (a, b) => b.value - a.value);
  const finalPaid  = bestOf("paid",       (a, b) => b.score - a.score);
  const finalDue   = bestOf("due",        (a, b) => a.value - b.value);

  const amounts = [];
  if (finalTotal) amounts.push({ type: "total_bill", value: finalTotal.value, source: finalTotal.source });
  if (finalPaid)  amounts.push({ type: "paid",       value: finalPaid.value,  source: finalPaid.source });
  if (finalDue)   amounts.push({ type: "due",        value: finalDue.value,   source: finalDue.source });

  // Confidence: coverage + presence of explicit keywords in full text
  const coverage = numbers.length ? (amounts.length / Math.min(3, numbers.length)) : 0;
  const hasKw = (kws) => kws.some(kw => lower.includes(kw));
  const kwBonus =
    (hasKw(KW.total) ? 0.05 : 0) +
    (hasKw(KW.paid)  ? 0.05 : 0) +
    (hasKw(KW.due)   ? 0.05 : 0);

  const confidence = Number((0.7 + 0.2 * coverage + kwBonus).toFixed(2));

  const payload = { amounts, confidence };
  try { validateOrThrow(classifySchema, payload); } catch (e) { /* optionally log */ }
  return { data: payload };
}

/* --------------------------- STEP 4: PROCESS --------------------------- */
/* Full pipeline: OCR/text -> extract -> normalize -> classify
   Preserves per-number provenance from classifyStep. */

export async function processPipeline(req) {
  const rawText = await ocrFromRequest(req);            // text OR file
  const { tokens, currencyHint } = extractTokens(rawText);

  if (!tokens || !tokens.length) {
    return { data: { status: "no_amounts_found", reason: "document too noisy" } };
    // You could also fallback to "needs_clarification" here if desired.
  }

  // You already have a normalizeNumbers() module used elsewhere; keep it for consistency.
  const { numbers } = normalizeNumbers(tokens);

  // Use our classifyStep (with provenance + skip-not-in-text) for accuracy.
  const cls = await classifyStep(rawText, numbers);
  const amounts = cls?.data?.amounts || [];

  if (!amounts.length) {
    return { data: { status: "needs_clarification", message: "Could not classify amounts" } };
  }

  const payload = {
    currency: currencyHint || "INR",
    amounts: amounts.map(a => ({
      type: a.type,
      value: a.value,
      // Prefer per-number snippet; fallback to a safe slice
      source: a.source || `text: '${cleanSource(rawText).slice(0, 160)}'`
    })),
    status: "ok"
  };

  try { validateOrThrow(processSchema, payload); } catch (e) { /* optionally log */ }
  return { data: payload };
}
