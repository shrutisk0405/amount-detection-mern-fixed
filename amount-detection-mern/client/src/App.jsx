import React, { useState } from 'react'
import UploadForm from './components/UploadForm.jsx'
import Results from './components/Results.jsx'

export default function App() {
  const [result, setResult] = useState(null)
  return (
    <div style={{maxWidth: 900, margin: '40px auto', fontFamily: 'system-ui, sans-serif'}}>
      <h1>AI-Powered Amount Detection</h1>
      <p>Upload a bill image or paste text.</p>
      <UploadForm onResult={setResult} />
      <Results data={result} />
    </div>
  )
}
