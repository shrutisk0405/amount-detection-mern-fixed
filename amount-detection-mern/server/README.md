# Amount Detection Server (Express)

## Run
```bash
cd server
npm install
npm run dev
```

## Endpoints
- `POST /api/v1/extract` (form-data: `text` or `image`) → `raw_tokens`, `currency_hint`, `confidence`
- `POST /api/v1/normalize` (json: `{ "tokens": [...] }`) → `normalized_amounts`, `normalization_confidence`
- `POST /api/v1/classify` (json: `{ "text": "...", "numbers": [ ... ] }`) → `amounts`, `confidence`
- `POST /api/v1/process` (form-data: `text` or `image`) → final `currency`, labeled `amounts` with `source`, `status:"ok"`

## Testing
- Use cURL commands in root README or VS Code file `tests/api.http`.
- Import Postman collection from project root.

## Notes
- Uses `tesseract.js` for OCR (first image call may download language data).
- Uses `Ajv` to validate outgoing JSON against schemas in `src/schemas/`.
