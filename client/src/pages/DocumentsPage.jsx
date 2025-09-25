import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../api'

export default function DocumentsPage () {
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null) // full doc in modal

  const pages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit])

  const fetchDocs = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.get('/documents', { params: { page, limit, q } })
      setItems(res.data.items || [])
      setTotal(res.data.total || 0)
    } catch (e) {
      setError("Impossible de charger les documents.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDocs() }, [page, limit])

  const toCsv = (rows) => {
    const headers = ['fileName','fileType','fileSize','uploadDate','content']
    const esc = (v) => {
      const s = (v === null || v === undefined) ? '' : String(v)
      const needs = /[",\n]/.test(s)
      const out = s.replace(/"/g, '""')
      return needs ? `"${out}"` : out
    }
    const lines = [headers.join(',')]
    for (const r of rows) {
      const row = [r.fileName, r.fileType, r.fileSize, r.uploadDate ? new Date(r.uploadDate).toISOString() : '', r.content]
      lines.push(row.map(esc).join(','))
    }
    return lines.join('\n')
  }

  const exportCsv = () => {
    const csv = toCsv(items)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'documents.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-[80vh] sm:min-h-screen flex items-start justify-center px-4 py-8">
      <div className="w-full max-w-5xl bg-white/80 backdrop-blur border border-gray-200 rounded-2xl shadow-xl p-6 sm:p-8">
        <header className="flex items-center justify-between gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Documents</h1>
          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Recherche..."
              className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 shadow-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={() => { setPage(1); fetchDocs() }} className="rounded-lg px-4 py-2.5 bg-blue-600 text-white hover:bg-blue-700">Rechercher</button>
            <button onClick={exportCsv} className="rounded-lg px-4 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700">Exporter CSV</button>
          </div>
        </header>

        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
            <span>❌</span>
            <div className="text-sm">{error}</div>
          </div>
        )}

        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-700">
                <th className="px-3 py-2 text-left">Nom du fichier</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Taille</th>
                <th className="px-3 py-2 text-left">Date</th>
                <th className="px-3 py-2 text-left">Contenu</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="px-3 py-6 text-center text-gray-500">Chargement…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan="5" className="px-3 py-6 text-center text-gray-500">Aucun document.</td></tr>
              ) : (
                items.map(doc => (
                  <tr key={doc._id} className="border-t align-top">
                    <td className="px-3 py-2">{doc.fileName}</td>
                    <td className="px-3 py-2">{doc.fileType}</td>
                    <td className="px-3 py-2">{(doc.fileSize || 0).toLocaleString('fr-FR')} o</td>
                    <td className="px-3 py-2">{doc.uploadDate ? new Date(doc.uploadDate).toLocaleString() : '-'}</td>
                    <td className="px-3 py-2 max-w-[28rem] whitespace-pre-wrap break-words">
                      {doc.content ? String(doc.content).slice(0, 800) : '-'}
                      {doc.content && String(doc.content).length > 800 && (
                        <>
                          <span className="text-gray-400"> …</span>{' '}
                          <button onClick={() => setSelected(doc)} className="text-blue-600 underline">Afficher tout</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">Total: {total} • Page {page}/{pages}</div>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="rounded-lg px-3 py-1.5 bg-gray-200 hover:bg-gray-300 disabled:opacity-50">Précédent</button>
            <button disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))} className="rounded-lg px-3 py-1.5 bg-gray-200 hover:bg-gray-300 disabled:opacity-50">Suivant</button>
            <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }} className="rounded-lg border border-gray-300 px-2 py-1.5">
              {[10,20,50,100].map(n => <option key={n} value={n}>{n}/page</option>)}
            </select>
          </div>
        </div>
      </div>
      {/* Modal full content */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-xl border border-gray-200">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="font-semibold text-gray-800 truncate">{selected.fileName}</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { navigator.clipboard?.writeText(String(selected.content || '')) }}
                  className="rounded-lg px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800"
                >Copier</button>
                <button onClick={() => setSelected(null)} className="rounded-lg px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100">Fermer</button>
              </div>
            </div>
            <div className="p-4 overflow-auto">
              <pre className="whitespace-pre-wrap break-words text-sm text-gray-800">{String(selected.content || '-')}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
