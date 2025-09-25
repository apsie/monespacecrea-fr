import React, { useEffect, useMemo, useState } from 'react'
import { api, getApiBase } from '../api'

export default function Profile() {
  const [me, setMe] = useState(null)
  const [catalog, setCatalog] = useState([])
  const [latest, setLatest] = useState({}) // type -> { uploadDate, fileName, filePath }
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [apiBase, setApiBase] = useState('')
  const [activeTab, setActiveTab] = useState('status') // 'status' | 'uploads'
  const [uploads, setUploads] = useState([])
  const [qType, setQType] = useState('')
  const [qName, setQName] = useState('')
  const [sortKey, setSortKey] = useState('uploadDate')
  const [sortDir, setSortDir] = useState('desc')
  const [statusQ, setStatusQ] = useState('')

  // Helpers and constants synced with RequiredDocs logic
  const norm = (s) => (s || '')
    .toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    .replace(/[’‘`´]/g, "'")
    .toLowerCase()
    .trim()
  const DECL_CAT_N = norm('Déclarations / Attestations')
  const YEAR_DOCS_N = new Set([
    norm('Attestation fiscale'),
    norm("Attestation de chiffre d’affaires"),
    norm('Attestation de versement CFP'),
    norm('Bilan / Liasse fiscale')
  ])
  const MONTHLY_DOC_N = norm("Déclaration mensuelle de chiffre d’affaires")
  const TRIM_DOC_N = norm("Déclaration trimestrielle de chiffre d'affaire")
  const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
  const TRIMESTRES = ['1er trimestre','2ème trimestre','3ème trimestre','4ème trimestre']

  useEffect(() => {
    let mounted = true
    const run = async () => {
      setLoading(true)
      setErr('')
      try {
        const [uRes, cRes, sRes, base] = await Promise.all([
          api.get('/me'),
          api.get('/documents/catalog'),
          api.get('/documents/my-latest'),
          getApiBase()
        ])
        if (!mounted) return
        setMe(uRes.data.user)
        const cat = cRes.data.catalog || []
        setCatalog(cat)
        const m = {}
        for (const d of (sRes.data.items || [])) {
          m[d.type] = { uploadDate: d.uploadDate, fileName: d.fileName, filePath: d.filePath }
        }
        setLatest(m)
        setApiBase(base)
      } catch (e) {
        if (!mounted) return
        setErr("Impossible de charger le profil")
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [])

  // Fetch user's uploads for the second tab
  useEffect(() => {
    let mounted = true
    const run = async () => {
      if (activeTab !== 'uploads') return
      try {
        const res = await api.get('/documents/my-uploads')
        if (!mounted) return
        setUploads(res.data.items || [])
      } catch {}
    }
    run()
    return () => { mounted = false }
  }, [activeTab, latest])

  const flatItems = useMemo(() => {
    const list = []
    // Show a recent 3-year window for annual docs in profile (compact view)
    const currentYear = new Date().getFullYear()
    const years = [currentYear - 2, currentYear - 1, currentYear]
    for (const cat of catalog) {
      if (norm(cat.category) === norm('Livrables')) continue
      const isDecl = norm(cat.category) === DECL_CAT_N
      for (const doc of cat.items) {
        if (isDecl) {
          const docN = norm(doc)
          if (YEAR_DOCS_N.has(docN)) {
            years.forEach(y => list.push({ category: cat.category, type: `${doc} ${y}` }))
            continue
          }
          if (docN === MONTHLY_DOC_N) {
            MONTHS.forEach(m => list.push({ category: cat.category, type: `${doc} ${m}` }))
            continue
          }
          if (docN === TRIM_DOC_N) {
            TRIMESTRES.forEach(t => list.push({ category: cat.category, type: `${doc} ${t}` }))
            continue
          }
        }
        list.push({ category: cat.category, type: doc })
      }
    }
    // Optional filter by type
    const q = statusQ.trim().toLowerCase()
    const filtered = q ? list.filter(it => it.type.toLowerCase().includes(q)) : list
    return filtered
  }, [catalog, statusQ])

  const uploadsFilteredSorted = useMemo(() => {
    const qt = qType.trim().toLowerCase()
    const qn = qName.trim().toLowerCase()
    const data = uploads.filter(u => {
      const t = (u.type || '').toLowerCase()
      const n = (u.fileName || '').toLowerCase()
      return (!qt || t.includes(qt)) && (!qn || n.includes(qn))
    })
    const dir = sortDir === 'asc' ? 1 : -1
    const sorted = [...data].sort((a, b) => {
      const va = sortKey === 'uploadDate' ? new Date(a.uploadDate || 0).getTime() : (a[sortKey] || '').toString().toLowerCase()
      const vb = sortKey === 'uploadDate' ? new Date(b.uploadDate || 0).getTime() : (b[sortKey] || '').toString().toLowerCase()
      if (va < vb) return -1 * dir
      if (va > vb) return 1 * dir
      return 0
    })
    return sorted
  }, [uploads, qType, qName, sortKey, sortDir])

  // UI helpers for avatar/role
  const initials = (full) => {
    if (!full) return 'U'
    const parts = full.split(/\s+/).filter(Boolean)
    const a = parts[0]?.[0] || ''
    const b = parts[1]?.[0] || ''
    return (a + b).toUpperCase() || full[0]?.toUpperCase() || 'U'
  }
  const roleBadge = (role) => {
    const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold'
    if (role === 'admin') return <span className={`${base} bg-red-100 text-red-700`}>admin</span>
    if (role === 'user') return <span className={`${base} bg-emerald-100 text-emerald-700`}>user</span>
    return role ? <span className={`${base} bg-gray-100 text-gray-700`}>{role}</span> : null
  }

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto">
      {/* Section title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Profil utilisateur</h1>
        <div className="mt-2 h-px bg-gradient-to-r from-gray-200 via-gray-100 to-transparent" />
      </div>

      {loading && <div className="mt-4 text-gray-500">Chargement…</div>}
      {err && <div className="mt-4 text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{err}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: user card */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          {me ? (
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xl font-bold">
                {initials(me.name)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center flex-wrap gap-2">
                  <div className="text-xl font-semibold text-gray-900 truncate">{me.name}</div>
                  {roleBadge(me.role)}
                </div>
                <div className="mt-3 space-y-1 text-sm text-gray-800">
                  {me.email && (
                    <div className="flex items-center gap-2">
                      <span>📧</span>
                      <span className="truncate">{me.email}</span>
                    </div>
                  )}
                  {me.username && (
                    <div className="flex items-center gap-2">
                      <span>👤</span>
                      <span className="truncate">{me.username}</span>
                    </div>
                  )}
                  {me.createdAt && (
                    <div className="flex items-center gap-2">
                      <span>📅</span>
                      <span className="truncate">{new Date(me.createdAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Aucune information utilisateur.</div>
          )}
        </section>

        {/* Right: tabs with Status vs Uploads */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => setActiveTab('status')}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${activeTab === 'status' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
            >
              Statut par type
            </button>
            <button
              onClick={() => setActiveTab('uploads')}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${activeTab === 'uploads' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
            >
              Mes téléversements
            </button>
          </div>

          {activeTab === 'status' ? (
            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <input
                  value={statusQ}
                  onChange={(e) => setStatusQ(e.target.value)}
                  placeholder="Filtrer par type…"
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="text-xs text-gray-600 whitespace-nowrap">
                  {(() => {
                    const total = flatItems.length
                    const provided = flatItems.filter(it => !!latest[it.type]).length
                    return <span>{provided}/{total} fournis</span>
                  })()}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-700">
                      <th className="px-3 py-2 text-left">Document</th>
                      <th className="px-3 py-2 text-left">Statut</th>
                      <th className="px-3 py-2 text-left">Dernier upload</th>
                      <th className="px-3 py-2 text-left">Télécharger</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flatItems.map((it, idx) => {
                      const s = latest[it.type]
                      const ok = !!s
                      const when = s?.uploadDate || s?.uploadedAt
                      const whenStr = when ? new Date(when).toLocaleString() : '—'
                      let url = s?.filePath || ''
                      if (url && url.startsWith('/uploads')) url = `${apiBase}${url}`
                      return (
                        <tr key={it.type} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2 text-gray-900">{it.type}</td>
                          <td className="px-3 py-2">
                            {ok ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">✅ Fournis</span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">❌ Non fourni</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-700">{whenStr}</td>
                          <td className="px-3 py-2">
                            {ok && url ? (
                              <a
                                className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700"
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <span>⬇️</span>
                                <span>Télécharger</span>
                              </a>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {!flatItems.length && (
                      <tr>
                        <td colSpan="4" className="px-3 py-4 text-center text-gray-500">Aucun élément.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  value={qType}
                  onChange={(e) => setQType(e.target.value)}
                  placeholder="Filtrer par type…"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  value={qName}
                  onChange={(e) => setQName(e.target.value)}
                  placeholder="Filtrer par nom de fichier…"
                  className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Trier:</span>
                  <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
                    <option value="uploadDate">Date</option>
                    <option value="type">Type</option>
                    <option value="fileName">Nom</option>
                  </select>
                  <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm">{sortDir === 'asc' ? 'Asc' : 'Desc'}</button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-700">
                      <th className="px-3 py-2 text-left">Type</th>
                      <th className="px-3 py-2 text-left">Nom</th>
                      <th className="px-3 py-2 text-left">Date</th>
                      <th className="px-3 py-2 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadsFilteredSorted.map((u, idx) => {
                      let url = u?.filePath || ''
                      if (url && url.startsWith('/uploads')) url = `${apiBase}${url}`
                      return (
                        <tr key={u._id || `${u.type}-${u.fileName}-${u.uploadDate}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-3 py-2 text-gray-900">{u.type}</td>
                          <td className="px-3 py-2 text-gray-700">{u.fileName}</td>
                          <td className="px-3 py-2 text-gray-700">{new Date(u.uploadDate).toLocaleString()}</td>
                          <td className="px-3 py-2">
                            {url ? (
                              <a
                                className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700"
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Télécharger
                              </a>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {!uploadsFilteredSorted.length && (
                      <tr>
                        <td colSpan="4" className="px-3 py-4 text-center text-gray-500">Aucun téléversement.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
