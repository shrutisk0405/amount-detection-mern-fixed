export function validateInputPresence(req, res, next) {
  const hasFile = !!(req.files && (req.files.image || req.files.file));
  const hasText = typeof req.body.text === "string" && req.body.text.trim().length > 0;
  if (!hasFile && !hasText) {
    return res.status(400).json({ status: "invalid_request", message: "Provide 'text' or 'image' file" });
  }
  next();
}
