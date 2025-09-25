import React, { useEffect, useMemo, useRef, useState } from 'react'
import { api, getApiBase } from '../api'
import DatePicker, { registerLocale } from 'react-datepicker'
import fr from 'date-fns/locale/fr'
import 'react-datepicker/dist/react-datepicker.css'
registerLocale('fr', fr)

const ALLOWED_EXT = ['.pdf', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.zip']

export default function RequiredDocs() {
  const [catalog, setCatalog] = useState([])
  const [latest, setLatest] = useState({}) // type -> { uploadDate, fileName }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState({}) // type -> boolean
  const [openCats, setOpenCats] = useState(() => new Set()) // opened category names
  const inputsRef = useRef({}) // type -> input
  const [monthYearPick, setMonthYearPick] = useState({}) // doc -> Date|null
  const [quarterYearPick, setQuarterYearPick] = useState({}) // doc -> Date|null

  // Helpers for robust comparisons (accents, curly quotes) and shared period labels
  const norm = (s) => (s || '')
    .toString()
    .normalize('NFD')
    .replace(/\p{Diacritic}+/gu, '')
    .replace(/[’‘`´]/g, "'")
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
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
  // Note: In the server catalog it's "affaire" (singular)
  const TRIM_DOC_N = norm("Déclaration trimestrielle de chiffre d'affaire")

  // Dynamic period generation via JS (no hard-coded <option> tags)
  // Configure the range here: from START_YEAR up to current year + FUTURE_YEARS
  const START_YEAR = 2000
  const FUTURE_YEARS = 25
  const getYears = () => {
    const now = new Date().getFullYear()
    const max = now + FUTURE_YEARS
    const arr = []
    for (let y = START_YEAR; y <= max; y++) arr.push(y)
    return arr
  }
  const getMonths = () => (['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'])
  const getTrimesters = () => (['1er trimestre','2ème trimestre','3ème trimestre','4ème trimestre'])
  const QUARTER_LABELS = ['1er trimestre','2ème trimestre','3ème trimestre','4ème trimestre']

  const flatItems = useMemo(() => {
    const list = []
    const years = getYears()
    for (const cat of catalog) {
      // Exclude 'Livrables' completely from the status table as well
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
            getMonths().forEach(m => list.push({ category: cat.category, type: `${doc} ${m}` }))
            continue
          }
          if (docN === TRIM_DOC_N) {
            getTrimesters().forEach(t => list.push({ category: cat.category, type: `${doc} ${t}` }))
            continue
          }
        }
        list.push({ category: cat.category, type: doc })
      }
    }
    return list
  }, [catalog])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const [cRes, sRes] = await Promise.all([
        api.get('/documents/catalog'),
        api.get('/documents/my-latest')
      ])
      setCatalog(cRes.data.catalog || [])
      const m = {}
      for (const d of (sRes.data.items || [])) {
        m[d.type] = { uploadDate: d.uploadDate, fileName: d.fileName }
      }
      setLatest(m)
    } catch (e) {
      setError('Impossible de charger le catalogue des documents.')
    } finally {
      setLoading(false)
    }
  }

  const refreshLatest = async () => {
    try {
      const sRes = await api.get('/documents/my-latest')
      const m = {}
      for (const d of (sRes.data.items || [])) {
        m[d.type] = { uploadDate: d.uploadDate, fileName: d.fileName }
      }
      setLatest(m)
    } catch {}
  }

  useEffect(() => { fetchData() }, [])

  const toggleCat = (category) => {
    setOpenCats(prev => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const onPick = (type) => {
    if (!inputsRef.current[type]) return
    inputsRef.current[type].click()
  }

  const onFileChange = async (type, ev) => {
    const f = ev.target.files?.[0]
    ev.target.value = '' // reset
    if (!f) return
    const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase()
    if (!ALLOWED_EXT.includes(ext)) {
      alert('Extension non autorisée. Autorisés: ' + ALLOWED_EXT.join(', '))
      return
    }
    try {
      setBusy(x => ({ ...x, [type]: true }))
      const form = new FormData()
      form.append('file', f)
      const res = await api.post(`/upload/${encodeURIComponent(type)}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000
      })
      const doc = res.data?.document
      if (doc) {
        // Optimistic update + server refresh to normalize keys
        setLatest(prev => ({ ...prev, [type]: { uploadDate: doc.uploadDate, fileName: doc.fileName } }))
        refreshLatest()
      }
    } catch (e) {
      const msg = e.response?.data?.message || e.message || 'Erreur lors du téléversement.'
      alert(msg)
    } finally {
      setBusy(x => ({ ...x, [type]: false }))
    }
  }

  // Generic handler for dynamic (periodized) selects: typeKey comes from input dataset
  const onFileChangeDynamic = async (ev) => {
    const type = ev.target?.dataset?.typeKey || ''
    if (!type) return
    const f = ev.target.files?.[0]
    ev.target.value = ''
    if (!f) return
    const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase()
    if (!ALLOWED_EXT.includes(ext)) {
      alert('Extension non autorisée. Autorisés: ' + ALLOWED_EXT.join(', '))
      return
    }
    try {
      setBusy(x => ({ ...x, [type]: true }))
      const form = new FormData()
      form.append('file', f)
      const res = await api.post(`/upload/${encodeURIComponent(type)}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000
      })
      const doc = res.data?.document
      if (doc) {
        // Optimistic update + server refresh to normalize keys
        setLatest(prev => ({ ...prev, [type]: { uploadDate: doc.uploadDate, fileName: doc.fileName } }))
        refreshLatest()
      }
    } catch (e) {
      const msg = e.response?.data?.message || e.message || 'Erreur lors du téléversement.'
      alert(msg)
    } finally {
      setBusy(x => ({ ...x, [type]: false }))
    }
  }

  const buttonCls = (uploaded, isBusy) => {
    const base = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white shadow-sm transition disabled:opacity-70 disabled:cursor-not-allowed'
    if (isBusy) return `${base} bg-blue-400`
    return uploaded ? `${base} bg-green-500 hover:bg-green-600` : `${base} bg-blue-500 hover:bg-blue-600`
  }

  const clearStatus = async (typeKey) => {
    try {
      // Try query param first for simplicity
      await api.delete(`/typed-documents`, { params: { type: typeKey } })
      setLatest(prev => {
        const cp = { ...prev }
        delete cp[typeKey]
        return cp
      })
      refreshLatest()
    } catch (e) {
      const msg = e.response?.data?.message || e.message || 'Impossible de supprimer le statut.'
      alert(msg)
    }
  }

  // --- Uploads table (history) ---
  const [uploads, setUploads] = useState([])
  const [qType, setQType] = useState('')
  const [qName, setQName] = useState('')
  const [qUser, setQUser] = useState('')
  const [sortKey, setSortKey] = useState('uploadDate')
  const [sortDir, setSortDir] = useState('desc')
  const [apiBase, setApiBase] = useState('')

  useEffect(() => {
    let mounted = true
    getApiBase().then((b) => { if (mounted) setApiBase(b) })
    return () => { mounted = false }
  }, [])

  const fetchUploads = async () => {
    try {
      const res = await api.get('/documents/my-uploads')
      setUploads(res.data.items || [])
    } catch (e) {
      // silent
    }
  }

  useEffect(() => { fetchUploads() }, [])

  // Re-fetch after each upload/delete to keep table fresh
  useEffect(() => { fetchUploads() }, [latest])

  const filteredSorted = useMemo(() => {
    const qt = qType.trim().toLowerCase()
    const qn = qName.trim().toLowerCase()
    const qu = qUser.trim().toLowerCase()
    const data = uploads.filter(u => {
      const t = (u.type || '').toLowerCase()
      const n = (u.fileName || '').toLowerCase()
      const by = (u.userName || u.user || '').toString().toLowerCase()
      return (!qt || t.includes(qt)) && (!qn || n.includes(qn)) && (!qu || by.includes(qu))
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
  }, [uploads, qType, qName, qUser, sortKey, sortDir])

  const hdrBtn = (key, label) => (
    <button
      type="button"
      onClick={() => setSortKey(prev => (prev === key ? key : key)) || setSortDir(prev => (sortKey === key ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'))}
      className="inline-flex items-center gap-1 hover:underline"
    >
      <span>{label}</span>
      {sortKey === key && <span className="text-xs">{sortDir === 'asc' ? '▲' : '▼'}</span>}
    </button>
  )

  return (
    <div className="min-h-[80vh] sm:min-h-screen px-6 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Pièces attendues</h1>
        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
            <span>❌</span>
            <div className="text-sm">{error}</div>
          </div>
        )}
        {loading ? (
          <div className="mt-6 text-gray-500">Chargement…</div>
        ) : (
          <div className="mt-6">
            {/* Pièces attendues (accordéon) */}
            <div className="space-y-4">
              {catalog
                .filter(cat => cat.category !== 'Livrables')
                .map(cat => {
                const isOpen = openCats.has(cat.category)
                const isDeclCat = norm(cat.category) === DECL_CAT_N
                // Build matching helpers: for declarations we accept any period match ("doc ...")
                const hasUploadForDoc = (doc) => {
                  if (!isDeclCat) return !!latest[doc]
                  const docN = norm(doc)
                  return Object.keys(latest).some((k) => {
                    const kN = norm(k)
                    return kN === docN || kN.startsWith(docN + ' ')
                  })
                }
                const requiredDocs = [...cat.items]
                const uploadedDocs = cat.items.filter((doc) => hasUploadForDoc(doc))
                // Debug: compare required vs uploaded for this category
                try { console.log('Category:', cat.category, 'requiredDocs:', requiredDocs, 'uploadedDocs:', uploadedDocs) } catch {}
                // New rule: section becomes green if at least one document of the section is uploaded
                const hasAnyUploaded = uploadedDocs.length > 0
                const catBtnCls = hasAnyUploaded
                  ? 'bg-green-500 hover:bg-green-600'
                  : (isOpen ? 'bg-blue-700' : 'bg-blue-600 hover:bg-blue-700')
                return (
                  <section key={cat.category} className="">
                    <button
                      type="button"
                      onClick={() => toggleCat(cat.category)}
                      className={`inline-flex items-center gap-2 px-6 py-3 w-64 mb-2 text-white text-sm font-medium rounded-lg shadow-sm transition ${catBtnCls}`}
                      aria-expanded={isOpen}
                      aria-controls={`panel-${cat.category}`}
                    >
                      {hasAnyUploaded && <span aria-hidden>✔</span>}
                      <span>{cat.category}</span>
                      <span className="text-xs opacity-90">{isOpen ? '▲' : '▼'}</span>
                    </button>

                    {isOpen && (
                      <div id={`panel-${cat.category}`} className="mt-2 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="divide-y">
                          {cat.items.map((doc) => {
                            const s = latest[doc]
                            const isDeclCat = norm(cat.category) === DECL_CAT_N

                            if (isDeclCat && YEAR_DOCS_N.has(norm(doc))) {
                              return (
                                <div key={doc} className="px-4 py-3">
                                  <div className="font-medium text-gray-800">{doc}</div>
                                  <div className="mt-2 flex items-center gap-3">
                                    <select
                                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      defaultValue=""
                                      onChange={(e) => {
                                        const y = e.target.value
                                        if (!y) return
                                        const inputKey = `${doc}__dyn`
                                        const typeKey = `${doc} ${y}`
                                        const el = inputsRef.current[inputKey]
                                        if (el) { el.dataset.typeKey = typeKey; el.click() }
                                        e.target.value = ''
                                      }}
                                    >
                                      <option value="" disabled>Année</option>
                                      {getYears().map((y) => (<option key={y} value={y}>{y}</option>))}
                                    </select>
                                    {/* Single hidden input used for any selected year */}
                                    <input
                                      type="file"
                                      accept={ALLOWED_EXT.join(',')}
                                      ref={(el) => { if (el) inputsRef.current[`${doc}__dyn`] = el }}
                                      className="hidden"
                                      onChange={onFileChangeDynamic}
                                    />
                                  </div>
                                </div>
                              )
                            }

                            if (isDeclCat && norm(doc) === MONTHLY_DOC_N) {
                              return (
                                <div key={doc} className="px-4 py-3">
                                  <div className="font-medium text-gray-800">{doc}</div>
                                  <div className="mt-2 flex items-center gap-3">
                                    <DatePicker
                                      selected={monthYearPick[doc] || null}
                                      onChange={(date) => {
                                        if (!date) return
                                        const monthName = date.toLocaleDateString('fr-FR', { month: 'long' })
                                        const cap = monthName.charAt(0).toUpperCase() + monthName.slice(1)
                                        const year = date.getFullYear()
                                        const inputKey = `${doc}__dyn`
                                        const typeKey = `${doc} ${cap} ${year}`
                                        const el = inputsRef.current[inputKey]
                                        if (el) { el.dataset.typeKey = typeKey; el.click() }
                                        setMonthYearPick((prev) => ({ ...prev, [doc]: null }))
                                      }}
                                      showMonthYearPicker
                                      dateFormat="MMMM yyyy"
                                      placeholderText="Mois / Année"
                                      locale="fr"
                                      minDate={new Date(START_YEAR, 0, 1)}
                                      maxDate={new Date(new Date().getFullYear() + FUTURE_YEARS, 11, 31)}
                                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <input
                                      type="file"
                                      accept={ALLOWED_EXT.join(',')}
                                      ref={(el) => { if (el) inputsRef.current[`${doc}__dyn`] = el }}
                                      className="hidden"
                                      onChange={onFileChangeDynamic}
                                    />
                                  </div>
                                </div>
                              )
                            }

                            if (isDeclCat && norm(doc) === TRIM_DOC_N) {
                              return (
                                <div key={doc} className="px-4 py-3">
                                  <div className="font-medium text-gray-800">{doc}</div>
                                  <div className="mt-2 flex items-center gap-3 flex-wrap">
                                    <DatePicker
                                      selected={quarterYearPick[doc] || null}
                                      onChange={(date) => setQuarterYearPick((prev) => ({ ...prev, [doc]: date }))}
                                      showYearPicker
                                      dateFormat="yyyy"
                                      placeholderText="Année"
                                      locale="fr"
                                      minDate={new Date(START_YEAR, 0, 1)}
                                      maxDate={new Date(new Date().getFullYear() + FUTURE_YEARS, 11, 31)}
                                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <div className="inline-flex items-center gap-2">
                                      {QUARTER_LABELS.map((label, idx) => (
                                        <button
                                          key={label}
                                          type="button"
                                          disabled={!quarterYearPick[doc]}
                                          onClick={() => {
                                            const date = quarterYearPick[doc]
                                            if (!date) return
                                            const year = date.getFullYear()
                                            const inputKey = `${doc}__dyn`
                                            const typeKey = `${doc} ${label} ${year}`
                                            const el = inputsRef.current[inputKey]
                                            if (el) { el.dataset.typeKey = typeKey; el.click() }
                                            setQuarterYearPick((prev) => ({ ...prev, [doc]: null }))
                                          }}
                                          className={`rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm transition ${
                                            quarterYearPick[doc] ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-600 cursor-not-allowed'
                                          }`}
                                        >
                                          {`Q${idx + 1}`}
                                        </button>
                                      ))}
                                    </div>
                                    <input
                                      type="file"
                                      accept={ALLOWED_EXT.join(',')}
                                      ref={(el) => { if (el) inputsRef.current[`${doc}__dyn`] = el }}
                                      className="hidden"
                                      onChange={onFileChangeDynamic}
                                    />
                                  </div>
                                </div>
                              )
                            }

                            // default rendering for other documents
                            return (
                              <div key={doc} className="flex items-center justify-between px-4 py-3 gap-3">
                                <div className="min-w-0">
                                  <div className="font-medium text-gray-800 truncate">{doc}</div>
                                  <div className="text-xs text-gray-500">Extensions: {ALLOWED_EXT.join(', ')}</div>
                                  <div className="text-xs text-gray-500 mt-0.5">Dernier statut: {s ? `Uploadé le ${new Date(s.uploadDate).toLocaleString()} (${s.fileName})` : 'Non fourni'}</div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <input
                                    type="file"
                                    accept={ALLOWED_EXT.join(',')}
                                    ref={(el) => { if (el) inputsRef.current[doc] = el }}
                                    className="hidden"
                                    onChange={(e) => onFileChange(doc, e)}
                                  />
                                  {(() => {
                                    const uploaded = !!latest[doc]
                                    const isBusy = !!busy[doc]
                                    return (
                                      <button
                                        onClick={() => onPick(doc)}
                                        disabled={isBusy}
                                        className={buttonCls(uploaded, isBusy)}
                                      >
                                        {uploaded && <span aria-hidden>✔</span>}
                                        <span>{uploaded ? 'Téléversé' : 'Téléverser'}</span>
                                      </button>
                                    )
                                  })()}
                                  {latest[doc] && (
                                    <button type="button" onClick={() => clearStatus(doc)} className="text-xs text-gray-600 hover:text-gray-800 underline">Retirer</button>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </section>
                )
              })}
            </div>
          </div>
        )}

        {/* --- Uploads table (history) --- */}
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Historique des téléversements</h2>

          {/* Filters and search */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:gap-4">
            <div className="flex-1 min-w-0">
              <input
                type="text"
                placeholder="Filtrer par type..."
                value={qType}
                onChange={(e) => setQType(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1 min-w-0">
              <input
                type="text"
                placeholder="Filtrer par nom de fichier..."
                value={qName}
                onChange={(e) => setQName(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1 min-w-0">
              <input
                type="text"
                placeholder="Filtrer par utilisateur..."
                value={qUser}
                onChange={(e) => setQUser(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Table controls (sort by) */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:gap-4">
            <div className="flex-1 min-w-0">
              <span className="text-sm text-gray-500 mr-2">Trier par:</span>
              <button
                onClick={() => setSortKey('uploadDate')}
                className={`text-sm font-medium ${sortKey === 'uploadDate' ? 'text-blue-600' : 'text-gray-700 hover:text-gray-900'}`}
              >
                Date de téléversement
              </button>
              <span className="text-sm text-gray-500 mx-2">|</span>
              <button
                onClick={() => setSortKey('type')}
                className={`text-sm font-medium ${sortKey === 'type' ? 'text-blue-600' : 'text-gray-700 hover:text-gray-900'}`}
              >
                Type de document
              </button>
              <span className="text-sm text-gray-500 mx-2">|</span>
              <button
                onClick={() => setSortKey('fileName')}
                className={`text-sm font-medium ${sortKey === 'fileName' ? 'text-blue-600' : 'text-gray-700 hover:text-gray-900'}`}
              >
                Nom de fichier
              </button>
              <span className="text-sm text-gray-500 mx-2">|</span>
              <button
                onClick={() => setSortKey('userName')}
                className={`text-sm font-medium ${sortKey === 'userName' ? 'text-blue-600' : 'text-gray-700 hover:text-gray-900'}`}
              >
                Utilisateur
              </button>
            </div>
            <div className="flex-shrink-0">
              <button
                onClick={fetchUploads}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
              >
                <span>Rafraîchir</span>
              </button>
            </div>
          </div>

          {/* Uploads table */}
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="divide-y divide-gray-200">
              {/* Table header */}
              <div className="bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-600 uppercase">
                <div className="grid grid-cols-5 gap-4">
                  <div className="flex items-center gap-2">{hdrBtn('type', 'Type')}</div>
                  <div className="flex items-center gap-2">{hdrBtn('fileName', 'Nom')}</div>
                  <div className="flex items-center gap-2">{hdrBtn('uploadDate', 'Date')}</div>
                  <div className="flex items-center gap-2">{hdrBtn('userName', 'Par')}</div>
                  <div className="flex items-center justify-end">Action</div>
                </div>
              </div>

              {/* Table body */}
              <div className="divide-y divide-gray-100">
                {filteredSorted.length === 0 ? (
                  <div className="px-4 py-3 text-center text-sm text-gray-500">
                    Aucune donnée trouvée.
                  </div>
                ) : (
                  filteredSorted.map((u, idx) => (
                    <div key={u._id || `${u.type}-${u.fileName}-${u.uploadDate}`} className={`grid grid-cols-5 gap-4 px-4 py-3 text-sm ${idx % 2 ? 'bg-gray-50/50' : ''}`}>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-gray-800">{u.type}</div>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-gray-700">{u.fileName}</div>
                      </div>
                      <div className="whitespace-nowrap text-gray-700">{new Date(u.uploadDate).toLocaleString()}</div>
                      <div className="whitespace-nowrap text-gray-700">{u.userName || u.user}</div>
                      <div className="flex items-center justify-end">
                        {u.filePath ? (
                          <a
                            href={`${apiBase}${u.filePath}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-white text-xs font-medium shadow-sm transition hover:bg-blue-700"
                          >
                            Télécharger
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Append the history table at bottom of page (below default export render)
