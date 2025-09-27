# MERN – AI-Powered Amount Detection (Problem Statement 8)

Implements the pipeline **Extract → Normalize → Classify → Process** with OCR, guardrails, JSON schema validation, and a small React UI.

## Run
### Server
```bash
cd server
npm install
npm run dev
```
### Client
```bash
cd client
npm install
npm run dev
```

## API
- `POST /api/v1/extract`  (form-data: `text` or `image`) → `raw_tokens`, `currency_hint`, `confidence`
- `POST /api/v1/normalize` (json: `{ "tokens": [...] }`) → `normalized_amounts`, `normalization_confidence`
- `POST /api/v1/classify` (json: `{ "text": "...", "numbers": [ ... ] }`) → labeled `amounts`, `confidence`
- `POST /api/v1/process`   (form-data: `text` or `image`) → Final `currency`, labeled `amounts` with `source`, `status:"ok"`

## Curl
```bash
curl -X POST http://localhost:5000/api/v1/process -F "text=Total: INR 1200 | Paid: 1000 | Due: 200"
curl -X POST http://localhost:5000/api/v1/extract -F "text=Total: INR 1200 | Paid: 1000 | Due: 200 | Discount: 10%"
curl -X POST http://localhost:5000/api/v1/normalize -H "Content-Type: application/json" -d "{ \"tokens\": [\"1200\",\"1000\",\"200\",\"10%\"] }"
curl -X POST http://localhost:5000/api/v1/classify -H "Content-Type: application/json" -d "{ \"text\": \"Total: INR 1200 | Paid: 1000 | Due: 200\", \"numbers\": [1200,1000,200] }"
```

## Postman
Import `AmountDetection.postman_collection.json` in this folder.

## VS Code REST
Open `server/tests/api.http` and click **Send Request** for each block.

## Notes
- OCR: `tesseract.js` (first OCR call downloads language data).
- JSON Schemas: `src/schemas/` and validated via `Ajv` before returning responses.
- Guardrails: `no_amounts_found`, `needs_clarification` with clear reasons/messages.
