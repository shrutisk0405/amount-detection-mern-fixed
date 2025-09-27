// client/src/App.jsx
import React, { useState } from "react";
import UploadForm from "./components/UploadForm.jsx";
import Results from "./components/Results.jsx";

export default function App() {
  const [result, setResult] = useState(null);

  return (
    <div className="page" style={{ backgroundColor: "#000" }}>
      <header className="topbar">
        <div className="brand">
          <span className="logo">🧾</span>
          <div>
            <h1>Medical Bill Amount Extractor</h1>
            <p>OCR → Normalize → Classify → JSON</p>
          </div>
        </div>
        <a
          className="link"
          href="https://github.com/shrutisk0405/amount-detection-mern-fixed"
          target="_blank"
          rel="noreferrer"
          title="Open repo"
        >
          GitHub ↗
        </a>
      </header>

      <main className="container">
        <section className="grid">
          <div className="card">
            <h2 className="card-title">Try it out</h2>
            <p className="muted">
              Upload a bill image <strong>or</strong> paste raw text. We’ll send it to{" "}
              <code>/api/v1/process</code> and show the structured JSON.
            </p>
            <UploadForm onResult={setResult} />
          </div>

          <div className="card">
            <h2 className="card-title">Result</h2>
            <Results data={result} />
          </div>
        </section>
      </main>

      <footer className="footer">
        <span>Built for Problem Statement 8</span>
        <span className="dot">•</span>
        <span>Demo UI · React + Vite</span>
      </footer>
    </div>
  );
}
