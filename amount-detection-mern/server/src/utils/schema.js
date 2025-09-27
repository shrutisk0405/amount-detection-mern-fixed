import Ajv from "ajv";

const ajv = new Ajv({ allErrors: true, strict: false });

export function validateOrThrow(schema, data) {
  const validate = ajv.compile(schema);
  const ok = validate(data);
  if (!ok) {
    const msg = (validate.errors || []).map(e => `${e.instancePath} ${e.message}`).join("; ");
    throw new Error(`Schema validation failed: ${msg}`);
  }
  return true;
}

export function cleanSource(text = "") {
  return (text || "").replace(/\s+/g, ' ').trim();
}
