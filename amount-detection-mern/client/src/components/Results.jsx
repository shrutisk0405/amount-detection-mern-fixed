// client/src/components/Results.jsx
import React from "react";

export default function Results({ data }) {
  if (!data) {
    return (
      <div className="empty">
        <p className="muted">
          No output yet. Submit a request to see structured JSON here.
        </p>
      </div>
    );
  }

  const pretty = JSON.stringify(data, null, 2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pretty);
    } catch {
      // ignore
    }
  };

  return (
    <div className="result">
      {/* Quick summary chips if present */}
      <div className="chips">
        {data.currency && <span className="chip">Currency: {data.currency}</span>}
        {Array.isArray(data.amounts) &&
          data.amounts.slice(0, 3).map((a, i) => (
            <span className={`chip tag-${a.type}`} key={i}>
              {a.type.replace("_", " ")}: <strong>{a.value}</strong>
            </span>
          ))}
        {data.status && <span className="chip muted">{data.status}</span>}
      </div>

      <div className="codewrap">
        <pre className="code"><code>{pretty}</code></pre>
        <button className="btn small ghost copybtn" onClick={copy}>
          Copy JSON
        </button>
      </div>
    </div>
  );
}
