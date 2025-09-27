import React from 'react'
export default function Results({ data }) {
  if (!data) return null
  return (
    <pre style={{background:'#111', color:'#0f0', padding: 16, borderRadius: 8, marginTop: 16}}>
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}
