import React, { useState } from 'react'
import axios from 'axios'

export default function UploadForm({ onResult }) {
  const [text, setText] = useState('Total: INR 1200 | Paid: 1000 | Due: 200')
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      let data

      if (file) {
        // 🚀 send as multipart with correct key = 'file'
        const form = new FormData()
        form.append('file', file)
        const res = await axios.post('http://localhost:5000/api/v1/process', form, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })
        data = res.data
      } else if (text.trim()) {
        // 🚀 send as JSON body if no file chosen
        const res = await axios.post('http://localhost:5000/api/v1/process',
          { text },
          { headers: { 'Content-Type': 'application/json' } }
        )
        data = res.data
      } else {
        setError('Please upload a file or enter text')
        setLoading(false)
        return
      }

      onResult(data)
    } catch (err) {
      setError(err?.response?.data?.message || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={4}
        placeholder="Paste bill text here..."
      />
      <input
        type="file"
        accept="image/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button disabled={loading}>
        {loading ? 'Processing...' : 'Submit'}
      </button>
      {error && <div style={{ color: 'crimson' }}>{error}</div>}
    </form>
  )
}
