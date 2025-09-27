import express from "express";
import Tesseract from "tesseract.js";

import { extractStep, normalizeStep, classifyStep, processPipeline } from "../services/pipeline.js";
import { validateInputPresence } from "../middlewares/validate.js";

const router = express.Router();

function cleanOcrText(text) {
  return text
    .replace(/1mm/gi, "INR")   // fix INR misread
    .replace(/[\r\n]+/g, "\n") // normalize line breaks
    .replace(/[\r\n]+/g, " ")
    .trim();
}


router.post("/extract", async (req, res) => {
  console.log("req.body:", req.body);
console.log("req.files:", req.files);

  try {
    let textInput = "";

    // Case 1: Image uploaded
    if (req.files && req.files.file) {
      const imageFile = req.files.file;
      const { data: { text } } = await Tesseract.recognize(imageFile.data, "eng");

      // Apply cleaning (fix common OCR issues)
      textInput = cleanOcrText(text);
    } 
    // Case 2: Plain text provided
    else if (req.body.text) {
      textInput = req.body.text;
    } 
    else {
      return res.status(400).json({
        status: "invalid_request",
        message: "No text or file uploaded"
      });
    }

    // 🔗 Run extraction step using cleaned/normalized text
    const { data } = await extractStep({ body: { text: textInput } });

    return res.json({
      status: "ok",
      cleanedText: textInput,
      ...data
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});


router.post("/normalize", async (req, res) => {
  try {
    let tokens = [];

    // Case 1: Image upload → OCR → extract tokens
    if (req.files && req.files.file) {
      const imageFile = req.files.file;
      const { data: { text } } = await Tesseract.recognize(imageFile.data, "eng");

      // clean and extract tokens
      const cleaned = cleanOcrText(text);
      const { data: extracted } = await extractStep({ body: { text: cleaned } });

      tokens = extracted.raw_tokens || [];
    }
    // Case 2: Tokens[] provided in JSON
    else if (Array.isArray(req.body.tokens)) {
      tokens = req.body.tokens;
    } else {
      return res.status(400).json({
        status: "invalid_request",
        message: "tokens[] required or file upload"
      });
    }

    // Run normalization step
    const { data } = await normalizeStep(tokens);
    return res.json(data);

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});


router.post("/classify", async (req, res) => {
  try {
    const { text, numbers } = req.body;
    if (typeof text !== "string" || !Array.isArray(numbers)) {
      return res.status(400).json({ status: "invalid_request", message: "text and numbers[] required" });
    }
    const { data } = await classifyStep(text, numbers);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ status: "error", message: err.message });
  }
});


// ---- NEW /process that accepts both text + image ----
router.post("/process", async (req, res) => {
  try {
    let inputText = "";

    // Case 1: Image upload
    if (req.files && req.files.file) {
      const imageFile = req.files.file;
      const { data: { text } } = await Tesseract.recognize(imageFile.data, "eng");
      inputText = cleanOcrText(text);
    }
    // Case 2: Raw text input
    else if (req.body.text) {
      inputText = req.body.text.trim();
    } else {
      return res.status(400).json({
        status: "invalid_request",
        message: "No text or file uploaded"
      });
    }

    // 🔗 Run your pipeline on the unified text
    const { data } = await processPipeline({ body: { text: inputText } });

    return res.json({
      ...data,              // final structured JSON
      cleanedText: inputText // optional, for debugging
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: "error", message: err.message });
  }
});

// OCR upload (image → text)
router.post("/ocr", async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ status: "invalid_request", message: "No file uploaded" });
    }

    const imageFile = req.files.file;

    const { data: { text } } = await Tesseract.recognize(imageFile.data, "eng");

    // Clean OCR output
    const cleanedText = cleanOcrText(text);

    // ✅ Pass cleaned text into your existing pipeline
    const { data } = await processPipeline({ body: { text: cleanedText } });

    return res.json({
      status: "ok",
      cleanedText,        // optional debug
      pipelineResult: data
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: "error", message: err.message });
  }
});




export default router;
