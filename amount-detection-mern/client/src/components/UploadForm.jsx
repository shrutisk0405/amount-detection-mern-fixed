// client/src/components/UploadForm.jsx
import React, { useCallback, useMemo, useRef, useState } from "react";

const SAMPLE_TEXT = "Total: INR 1200 | Paid: 1000 | Due: 200 | Discount: 10%";
// Use .env: VITE_API_BASE=http://localhost:5000/api/v1  (or rely on Vite proxy and keep "/api/v1")
const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, "") ||
  "http://localhost:5000/api/v1";

export default function UploadForm({ onResult }) {
  const [tab, setTab] = useState("text"); // 'text' | 'image'
  const [text, setText] = useState(SAMPLE_TEXT);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const fileInputRef = useRef(null);

  const canSubmit = useMemo(
    () => (tab === "text" ? text.trim().length > 0 : !!file),
    [tab, text, file]
  );

  const onChooseFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      setErr("Please select an image file (png/jpg).");
      return;
    }
    setErr("");
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const onDrop = useCallback((e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("image/")) {
      setErr("");
      setFile(f);
      setPreview(URL.createObjectURL(f));
      setTab("image");
    } else {
      setErr("Drop a valid image file (png/jpg).");
    }
  }, []);

  const onDragOver = (e) => e.preventDefault();

  const clearFile = () => {
    setFile(null);
    setPreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const copySample = () => setText(SAMPLE_TEXT);

  async function parseSafe(res) {
    const ct = res.headers.get("content-type") || "";
    const raw = await res.text(); // always read as text first
    let data = null;

    if (ct.includes("application/json") && raw) {
      try { data = JSON.parse(raw); } catch { /* fallthrough */ }
    }

    if (!res.ok) {
      // prefer JSON error message if present, else raw text, else status
      const msg = (data && (data.message || data.error)) || raw || `HTTP ${res.status} ${res.statusText}`;
      throw new Error(msg);
    }

    if (!data) {
      // server returned empty or non-JSON body
      throw new Error("Empty/invalid JSON response from server.");
    }

    return data;
  }

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit || loading) return;

    setLoading(true);
    setErr("");
    onResult?.(null);

    try {
      let res;

      if (tab === "image" && file) {
        const fd = new FormData();
        fd.append("file", file); // key MUST be 'file' for the backend
        res = await fetch(`${API_BASE}/process`, { method: "POST", body: fd });
      } else {
        res = await fetch(`${API_BASE}/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
      }

      const data = await parseSafe(res);
      onResult?.(data);
    } catch (e) {
      setErr(e.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="form">
      {/* Tabs */}
      <div className="tabs">
        <button
          type="button"
          className={`tab ${tab === "text" ? "active" : ""}`}
          onClick={() => setTab("text")}
        >
          ✍️ Paste Text
        </button>
        <button
          type="button"
          className={`tab ${tab === "image" ? "active" : ""}`}
          onClick={() => setTab("image")}
        >
          🖼️ Upload Image
        </button>
      </div>

      {/* Panels */}
      {tab === "text" ? (
        <div className="panel">
          <label className="label">Bill Text</label>
          <textarea
            className="textarea"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste bill/receipt text here…"
          />
          <div className="row">
            <button type="button" className="btn ghost" onClick={copySample}>
              Use sample
            </button>
            <span className="flex-spacer" />
            <span className="hint">Endpoint: <code>{API_BASE}/process</code></span>
          </div>
        </div>
      ) : (
        <div className="panel">
          <label className="label">Bill Image</label>

          <div
            className={`dropzone ${file ? "has-file" : ""}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            {preview ? (
              <img src={preview} alt="preview" className="preview" />
            ) : (
              <div className="dropzone-inner">
                <span className="drop-icon">⬆️</span>
                <p>Drag & drop image here, or click to choose</p>
                <p className="muted">PNG / JPG</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="file-input"
              onChange={onChooseFile}
            />
          </div>

          {file && (
            <div className="filebar">
              <div className="filemeta">
                <strong>{file.name}</strong>
                <span className="muted">
                  {(file.size / 1024).toFixed(1)} KB · {file.type}
                </span>
              </div>
              <button type="button" className="btn danger ghost" onClick={clearFile}>
                Remove
              </button>
            </div>
          )}
        </div>
      )}

      {/* Errors */}
      {err && <div className="alert error">⚠️ {err}</div>}

      {/* Actions */}
      <div className="actions">
        <button type="submit" className="btn primary" disabled={!canSubmit || loading}>
          {loading ? <span className="spinner" aria-hidden /> : "Submit"}
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            setErr("");
            setText(SAMPLE_TEXT);
            clearFile();
            onResult?.(null);
          }}
        >
          Reset
        </button>
      </div>
    </form>
  );
}
