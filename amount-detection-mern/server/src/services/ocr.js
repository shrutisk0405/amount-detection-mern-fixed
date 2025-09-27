import Tesseract from "tesseract.js";

function bufToBase64(buf) {
  if (Buffer.isBuffer(buf)) return buf.toString("base64");
  if (buf && buf.data) return Buffer.from(buf.data).toString("base64");
  return "";
}

export async function ocrFromRequest(req) {
  if (typeof req.body.text === "string" && req.body.text.trim().length > 0) {
    return req.body.text;
  }
  try {
    const file = (req.files && (req.files.image || req.files.file)) || null;
    if (!file) return "";
    const base64 = bufToBase64(file.data);
    const { data: { text } } = await Tesseract.recognize(Buffer.from(base64, "base64"), process.env.OCR_LANG || "eng");
    return (text || "").trim();
  } catch (e) {
    return "";
  }
}
