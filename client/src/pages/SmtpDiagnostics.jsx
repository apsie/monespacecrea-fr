import React, { useEffect, useState } from 'react'
import { api, getApiBase } from '../api'

export default function SmtpDiagnostics() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [base, setBase] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const b = await getApiBase()
      setBase(b)
      const res = await api.get('/smtp/diagnostics')
      setData(res.data)
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="min-h-[80vh] sm:min-h-screen flex items-center justify-center px-4 py-10 animate-fade-in">
      <div className="w-full max-w-2xl bg-white/80 backdrop-blur border border-gray-200 rounded-2xl shadow-xl p-6 sm:p-8">
        <header className="text-center mb-4">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Diagnostics SMTP</h1>
          <p className="mt-1 text-sm text-gray-600">Exécute un ping SMTP et affiche le statut en JSON.</p>
        </header>
        <div className="flex items-center justify-between mb-3 text-sm text-gray-600">
          <div>API: <code className="text-gray-800">{base}</code></div>
          <button onClick={load} disabled={loading} className={`rounded-lg px-3 py-1.5 text-white ${loading ? 'bg-blue-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700'}`}>{loading ? 'Actualisation…' : 'Rafraîchir'}</button>
        </div>
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
        )}
        <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 overflow-auto max-h-[50vh]">
{JSON.stringify(data, null, 2) || 'Aucune donnée.'}
        </pre>
      </div>
    </div>
  )
}
