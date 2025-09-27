
# AI-Powered Amount Detection In Medical Documents 

Extract **financial amounts** from typed/scanned medical bills, fix **OCR errors**, **normalize** digits, **classify** by context (total/paid/due), and return **structured JSON with provenance**.

> **Focus Area:** OCR → Numeric Normalization → Context Classification  
> **Problem Statement 8** (intern-friendly, demo-ready)

---

## ✨ Features

- **Single API** accepts **text or image** (PNG/JPG).
- **OCR** with `tesseract.js` (defaults to `eng`, can use `eng+hin`).
- **Numeric normalization** (OCR fixes: O→0, l/I→1, S→5, B→8; strip ₹/INR/RS; commas/spaces).
- **Context classification** with proximity keyword scoring (Total / Paid / Due).
- **Per-amount provenance** (`source`: local text snippet around each value).
- **Guardrails** for noisy docs / invalid inputs.
- **Step endpoints** for debugging each phase.
- **React + Vite** frontend demo (text/file upload).

---

## 🧱 Project Structure

```
/client
├─ index.html
└─ src/
	 ├─ main.jsx
	 ├─ App.jsx
	 └─ components/
			├─ UploadForm.jsx
			└─ Results.jsx

/server
└─ src/
	 ├─ index.js # Express app (file upload middleware mounted ONCE)
	 ├─ routes/
	 │  └─ amount.js # /api/v1 routes: extract/normalize/classify/process
	 ├─ services/
	 │  ├─ pipeline.js # extractStep, normalizeStep, classifyStep, processPipeline
	 │  ├─ ocr.js # ocrFromRequest(req): text OR image
	 │  ├─ extract.js # extractTokens(rawText)
	 │  ├─ normalize.js # normalizeNumbers(tokens) (compat)
	 │  └─ classify.js # classifyByContext(text, numbers) (compat)
	 ├─ utils/
	 │  └─ schema.js # validateOrThrow, cleanSource
	 └─ schemas/
			├─ extract.schema.json
			├─ normalize.schema.json
			├─ classify.schema.json
			└─ process.schema.json
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js **18+**
- npm **9+**

### 1) Install

```bash
# from project root
cd server && npm install
cd ../client && npm install
```

### 2) Server configuration
`server/src/index.js` must mount file upload ONCE:

```js
import express from "express";
import cors from "cors";
import fileUpload from "express-fileupload";
import dotenv from "dotenv";
import amountRouter from "./routes/amount.js";

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// IMPORTANT: mount express-fileupload only once
app.use(fileUpload({
	useTempFiles: false,
	createParentPath: true
}));

app.get("/", (_req, res) => {
	res.json({ ok: true, service: "AI-Powered Amount Detection" });
});

app.use("/api/v1", amountRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
```
If you ever see `Error: Unexpected end of form`, you likely mounted `fileUpload()` twice. Remove duplicates.

### 3) Run dev servers

```bash
# terminal 1
cd server
npm run dev         # http://localhost:5000

# terminal 2
cd client
npm run dev         # Vite at http://localhost:5173
```

(Optional) Add a proxy to `client/vite.config.js` so you can call `/api` without CORS hassles:

```js
// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
	plugins: [react()],
	server: {
		proxy: {
			'/api': {
				target: 'http://localhost:5000',
				changeOrigin: true
			}
		}
	}
})
```

---

## 🌐 API Endpoints

Base URL: `http://localhost:5000/api/v1`

### Health

```http
GET /
→ { "ok": true, "service": "AI-Powered Amount Detection" }
```

### Step 1 — Extract (Text or Image)

```http
POST /extract
```
Text (JSON):
```json
{ "text": "Total: INR 1200 | Paid: 1000 | Due: 200 | Discount: 10%" }
```
Image (multipart/form-data):
- key: `file` (File) → sample_bill.png

Example response
```json
{
	"status": "ok",
	"cleanedText": "Total: INR 1200 Paid: 1000 Due: 200 Discount: 10%",
	"raw_tokens": ["1200","1000","200","10%"],
	"currency_hint": "INR",
	"confidence": 0.74
}
```
Guardrail
```json
{ "status": "no_amounts_found", "reason": "document too noisy" }
```

### Step 2 — Normalize

```http
POST /normalize
```
JSON tokens:
```json
{ "tokens": ["l200","1000","200","10%"] }
```
or Image (multipart/form-data):
- key: `file` (File)

Example response
```json
{
	"normalized_amounts": [1200, 1000, 200],
	"normalization_confidence": 0.82
}
```

### Step 3 — Classify by Context

```http
POST /classify
```
Body (JSON):
```json
{
	"text": "Total: INR 1200 | Paid: 1000 | Due: 200",
	"numbers": [1200, 1000, 200]
}
```
Numbers must occur in text; non-occurring values are skipped to prevent mislabeling.

Example response
```json
{
	"amounts": [
		{ "type": "total_bill", "value": 1200, "source": "text: 'Total: INR 1200'" },
		{ "type": "paid",       "value": 1000, "source": "text: 'Paid: 1000'" },
		{ "type": "due",        "value": 200,  "source": "text: 'Due: 200'" }
	],
	"confidence": 0.80
}
```

### Step 4 — Process (Full pipeline: OCR → Extract → Normalize → Classify)

```http
POST /process
```
JSON:
```json
{ "text": "Total: INR 1200 | Paid: 1000 | Due: 200" }
```

- key: `file` (File) → bill image

Example response
```json
{
	"currency": "INR",
	"amounts": [
		{ "type": "total_bill", "value": 1200, "source": "text: 'Total: INR 1200'" },
		{ "type": "paid",       "value": 1000, "source": "text: 'Paid: 1000'" },
		{ "type": "due",        "value": 200,  "source": "text: 'Due: 200'" }
	],
	"status": "ok"
}
```

---

## Sample cURL Commands

### Extract (Text)
```bash
curl -s -X POST http://localhost:5000/api/v1/extract \
	-H "Content-Type: application/json" \
	-d '{"text":"Total: INR 1200 | Paid: 1000 | Due: 200 | Discount: 10%"}'
```

### Extract (Image)
```bash
curl -s -X POST http://localhost:5000/api/v1/extract \
	-F "file=@./sample_bill.png"
```

### Normalize (Tokens)
```bash
curl -s -X POST http://localhost:5000/api/v1/normalize \
	-H "Content-Type: application/json" \
	-d '{"tokens":["l200","1000","200","10%"]}'
```

### Classify
```bash
curl -s -X POST http://localhost:5000/api/v1/classify \
	-H "Content-Type: application/json" \
	-d '{"text":"Total: INR 1200 | Paid: 1000 | Due: 200","numbers":[1200,1000,200]}'
```

### Process (Text)
```bash
curl -s -X POST http://localhost:5000/api/v1/process \
	-H "Content-Type: application/json" \
	-d '{"text":"Total: INR 1200 | Paid: 1000 | Due: 200"}'
```

### Process (Image)
```bash
curl -s -X POST http://localhost:5000/api/v1/process \
	-F "file=@./sample_bill.png"
```

---

## 🧪 Postman Cheat-Sheet

Create a collection with:
- Extract (Text) – POST /extract (raw JSON)
- Extract (Image) – POST /extract (form-data file)
- Normalize (Tokens) – POST /normalize (raw JSON)
- Normalize (Image) – POST /normalize (form-data file)
- Classify – POST /classify (raw JSON: text, numbers[])
- Process (Text) – POST /process (raw JSON: text)
- Process (Image) – POST /process (form-data file)

**Important:** for images the form-data key is exactly `file`.

---

## 🖥 Frontend (React) Integration

`client/src/components/UploadForm.jsx` (pattern):

If a file is selected → send FormData with key `file` (no JSON headers).

Else if text is present → send JSON `{ text }`.

```jsx
// sketch (your code already follows this pattern)
if (file) {
	const fd = new FormData();
	fd.append("file", file);
	await fetch("/api/v1/process", { method: "POST", body: fd });
} else if (text.trim()) {
	await fetch("/api/v1/process", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ text })
	});
}
```

**Common mistakes to avoid**

- ❌ `form.append('image', file)` → should be `file`.
- ❌ `JSON.stringify(FormData)` → never stringify FormData.
- ❌ Setting `Content-Type: application/json` when uploading FormData.

---

## 🧠 How the Pipeline Works

**OCR / Input**
- `ocrFromRequest(req)`: If `req.files.file` → OCR with Tesseract (eng or eng+hin), then clean. Else if `req.body.text` → use text.

**Extract tokens**
- `extractTokens(text)` → returns: `raw_tokens[]` (e.g., ["1200","1000","200","10%"]), `currency_hint` (e.g., INR), `confidence` (heuristic)

**Normalize**
- Fix OCR digit confusions (O→0, l/I→1, S→5, B→8).
- Strip currency marks and separators.
- Output `normalized_amounts[]` + `normalization_confidence`.

**Classify**
- Proximity keyword scoring in a window around each number.
- Skips numbers not present in text (prevents mismatches).
- Produces per-number source snippets.

**Final**
- `currency` (fallback to INR).
- `amounts[]` with { type, value, source }.
- `status: "ok"`.

---

## 🛡 Guardrails & Error Modes

```json
{"status":"no_amounts_found","reason":"document too noisy"}
```
```json
{"status":"needs_clarification","message":"Could not classify amounts"}
```
Optional (strict) for /classify:
```json
{"status":"invalid_numbers","reason":"One or more numbers not found in text"}
```

---

## 🔧 Troubleshooting

**Postman works, frontend says “No text or file uploaded”**
- Frontend must send multipart/form-data with key `file`.
- Check server logs:

```js
console.log("req.body:", req.body);
console.log("req.files:", req.files);
```

**Unexpected end of form (busboy)**
- You mounted express-fileupload twice. Keep only:

```js
app.use(fileUpload({ useTempFiles: false, createParentPath: true }));
```

**Paid not detected / wrong labels**
- Classifier now uses proximity + skips numbers not in text. Ensure you pass numbers from normalize output for consistency.

---

## ⚙️ Tuning & Extensions

- **Languages:** `Tesseract.recognize(buf, "eng+hin")` for bilingual docs.
- **Confidence:** propagate from steps; adjust keyword sets for your org.
- **Persistence:** store results in MongoDB for history/audit.
- **Security:** validate mimetypes, max file size, and rate limit if exposed publicly.

---

## 📜 Scripts

**Server**
- `npm run dev` – dev server (nodemon if configured)
- `npm start` – production start

**Client**
- `npm run dev` – Vite dev server
- `npm run build` – build static assets
