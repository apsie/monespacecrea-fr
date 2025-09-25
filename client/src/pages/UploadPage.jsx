import React, { useCallback, useEffect, useRef, useState } from 'react'
import { api, getApiBase } from '../api'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_EXT = ['.pdf', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.zip']

function humanSize (bytes) {
  const units = ['o', 'Ko', 'Mo', 'Go']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(1)} ${units[i]}`
}

export default function UploadPage () {
  const [selected, setSelected] = useState([]) // { id, file, progress, status, response, error }
  const [progress, setProgress] = useState(0) // overall progress
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [uploaded, setUploaded] = useState(null)
  const [files, setFiles] = useState([])
  const [feedback, setFeedback] = useState('')
  const [feedbackType, setFeedbackType] = useState('info') // 'success' | 'error' | 'info'
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const inputRef = useRef()
  const [isDragging, setIsDragging] = useState(false)
  const [apiBase, setApiBase] = useState('')
  useEffect(() => {
    let mounted = true
    getApiBase().then((b) => { if (mounted) setApiBase(b) })
    return () => { mounted = false }
  }, [])

  const fileKind = (f) => {
    const type = (f?.type || '').toLowerCase()
    const name = (f?.name || '').toLowerCase()
    if (type.startsWith('image/') || name.match(/\.(png|jpe?g|gif|webp|bmp)$/)) return 'image'
    if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf'
    return 'other'
  }

  const validateFile = (f) => {
    if (!f) return 'Aucun fichier sélectionné.'
    const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase()
    if (!ALLOWED_EXT.includes(ext)) {
      return 'Type de fichier non autorisé (.pdf, .docx, .txt, .jpg, .png, .zip)'
    }
    if (f.size > MAX_SIZE) {
      return 'Fichier trop volumineux (max 10 Mo)'
    }
    return null
  }

  const onFiles = useCallback((fileList) => {
    if (!fileList || fileList.length === 0) return
    let anyError = ''
    const toAdd = []
    const existingKeys = new Set(selected.map(s => s.id))
    for (const f of Array.from(fileList)) {
      const err = validateFile(f)
      if (err) {
        anyError = err
        continue
      }
      const id = `${f.name}-${f.size}-${f.lastModified}`
      if (existingKeys.has(id)) continue
      const previewUrl = URL.createObjectURL(f)
      toAdd.push({ id, file: f, progress: 0, status: 'pending', response: null, error: '', previewUrl, kind: fileKind(f) })
    }
    if (toAdd.length > 0) {
      setSelected((prev) => [...prev, ...toAdd])
      setUploaded(null)
      setError('')
    }
    if (anyError) setError(anyError)
  }, [selected])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    onFiles(e.dataTransfer.files)
  }, [onFiles])

  const onDragOver = useCallback((e) => {
    e.preventDefault()
    if (!isDragging) setIsDragging(true)
  }, [])

  const onDragLeave = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  // Revoke object URLs on unmount
  useEffect(() => {
    return () => {
      try { selected.forEach(s => s.previewUrl && URL.revokeObjectURL(s.previewUrl)) } catch {}
    }
  }, [])

  const removeSelected = (id) => {
    setSelected((prev) => {
      const it = prev.find(x => x.id === id)
      if (it?.previewUrl) { try { URL.revokeObjectURL(it.previewUrl) } catch {} }
      return prev.filter(x => x.id !== id)
    })
  }

  const startUpload = async () => {
    if (!selected.length) return
    setStatus('Envoi en cours...')
    setError('')
    setUploaded(null)
    // Sequential upload
    let completed = 0
    for (let i = 0; i < selected.length; i++) {
      const item = selected[i]
      // Skip already done
      if (item.status === 'done') { completed++; continue }
      // Mark uploading
      setSelected((prev) => prev.map(s => s.id === item.id ? { ...s, status: 'uploading', progress: 0, error: '' } : s))
      try {
        const form = new FormData()
        form.append('file', item.file)
        const res = await api.post(`/upload`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (evt) => {
            if (evt.total) {
              const pct = Math.round((evt.loaded * 100) / evt.total)
              setSelected((prev) => prev.map(s => s.id === item.id ? { ...s, progress: pct } : s))
              // overall progress (avg)
              setProgress((prevProg) => {
                const latest = selected.map(s => s.id === item.id ? pct : (s.progress || 0))
                const avg = Math.round(latest.reduce((a,b)=>a+b,0) / latest.length)
                return avg
              })
            }
          },
          timeout: 60000
        })
        completed++
        setSelected((prev) => prev.map(s => s.id === item.id ? { ...s, status: 'done', progress: 100, response: res.data.file } : s))
        setUploaded(res.data.file) // keep last uploaded for email block
      } catch (err) {
        const msg = err.response?.data?.message || (err.request ? "Impossible d'atteindre le serveur." : err.message)
        setSelected((prev) => prev.map(s => s.id === item.id ? { ...s, status: 'error', error: msg } : s))
        setError(msg)
      }
    }
    setStatus('Terminé ✅')
    await fetchFiles()
  }

  const fetchFiles = useCallback(async () => {
    try {
      const res = await api.get('/files')
      setFiles(res.data.files || [])
    } catch (e) {
      // silent for listing
    }
  }, [])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  const deleteFile = async (name) => {
    try {
      await api.delete(`/files/${encodeURIComponent(name)}`)
  setFeedbackType('success')
  setFeedback('Fichier supprimé avec succès ✅')
      setTimeout(() => setFeedback(''), 2000)
      fetchFiles()
    } catch (e) {
  setFeedbackType('error')
  setFeedback("Échec de suppression ❌")
      setTimeout(() => setFeedback(''), 2500)
    }
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const sendEmail = async () => {
    if (!uploaded) return
    if (!emailRegex.test(email)) {
  setFeedbackType('error')
  setFeedback('Adresse email invalide ❌')
      setTimeout(() => setFeedback(''), 2000)
      return
    }
    try {
      setSending(true)
      const res = await api.post('/send-email', {
        toEmail: email,
        fileName: uploaded.savedAs || uploaded.originalName,
        fileUrl: uploaded.url
      })
  setFeedbackType('success')
  setFeedback('Email envoyé avec succès ✅')
      setPreviewUrl(res.data?.previewUrl || '')
      setEmail('')
    } catch (e) {
  setFeedbackType('error')
  setFeedback("Échec d'envoi de l'email ❌")
    } finally {
      setTimeout(() => setFeedback(''), 2500)
      setSending(false)
    }
  }

  return (
    <div className="min-h-[80vh] sm:min-h-screen flex items-center justify-center px-4 py-10 animate-fade-in">
      <div className="w-full max-w-2xl bg-white/80 backdrop-blur border border-gray-200 rounded-2xl shadow-xl p-6 sm:p-8">
        <header className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Téléversement de fichiers</h1>
          <p className="mt-2 text-gray-600">Formats: .pdf, .docx, .txt, .jpg, .png, .zip • Taille max: 10 Mo</p>
        </header>

        {/* Dropzone */}
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`group relative mt-6 rounded-2xl border-2 border-dashed p-8 sm:p-10 text-center cursor-pointer transition-all dashed-animate ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
          }`}
        >
          <span className="absolute inset-0 rounded-2xl pointer-events-none ring-1 ring-inset ring-black/0 group-hover:ring-black/5 transition" />
          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_EXT.join(',')}
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
          />

          {/* Upload icon */}
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 text-blue-600 shadow-sm">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V7m0 0l-4 4m4-4l4 4" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
            </svg>
          </div>
          <p className="text-gray-800 font-medium">Glissez-déposez vos fichiers ici</p>
          <p className="text-gray-500 text-sm">ou cliquez pour les sélectionner</p>
          {selected.length > 0 && (
            <div className="mt-3 text-sm text-gray-800">
              {selected.length} fichier(s) sélectionné(s)
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-wrap gap-3 items-center">
          <button
            disabled={selected.length === 0}
            onClick={startUpload}
            className={`inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-white shadow-sm transition-all ${
              selected.length > 0 ? 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5 hover:shadow-md' : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            <span className="mr-2">📤</span> Envoyer
          </button>
          <button
            disabled={selected.length === 0 && !error && !uploaded && !status}
            onClick={() => { setSelected([]); setProgress(0); setStatus(''); setError(''); setUploaded(null) }}
            className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 bg-gray-200 text-gray-900 hover:bg-gray-300 hover:-translate-y-0.5 hover:shadow-sm transition-all"
          >
            <span className="mr-2">🔁</span> Réinitialiser
          </button>
          {status && (
            <span className="ml-auto text-sm text-gray-700">{status}</span>
          )}
        </div>

        {/* Progress */}
        {selected.length > 0 && (selected.some(s => s.status === 'uploading') || selected.some(s => s.status === 'done')) && (
          <div className="mt-4">
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 transition-[width] duration-200 ease-out"
                style={{ width: `${Math.round(selected.reduce((a,b)=>a+(b.progress||0),0)/selected.length)}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-gray-600">{Math.round(selected.reduce((a,b)=>a+(b.progress||0),0)/selected.length)}%</div>
          </div>
        )}

        {/* Alerts */}
        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
            <span className="text-base">❌</span>
            <div className="text-sm">{error}</div>
          </div>
        )}

        {uploaded && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
            <span className="text-base">✅</span>
            <div className="text-sm">
              <div>Fichier sauvegardé sous: <code className="font-mono">{uploaded.savedAs}</code></div>
              <div>URL: <a className="text-blue-600 underline" href={`${apiBase}${uploaded.url}`} target="_blank" rel="noreferrer">ouvrir</a></div>
            </div>
          </div>
        )}

        {/* Document metadata + extracted content */}
        {uploaded && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-800">Document extrait</h3>
            <div className="mt-2 overflow-x-auto">
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
                  <tr className="border-t align-top">
                    <td className="px-3 py-2">{uploaded.savedAs}</td>
                    <td className="px-3 py-2">{uploaded.mimetype || '-'}</td>
                    <td className="px-3 py-2">{humanSize(uploaded.size || 0)}</td>
                    <td className="px-3 py-2">{uploaded.uploadedAt ? new Date(uploaded.uploadedAt).toLocaleString() : '-'}</td>
                    <td className="px-3 py-2 max-w-[28rem] whitespace-pre-wrap break-words text-gray-800">
                      {uploaded.content ? uploaded.content.slice(0, 2000) : '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Email share */}
        {uploaded && (
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-gray-800">Envoyer le lien par email</h3>
            <div className="mt-2 flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                placeholder="destinataire@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2.5 shadow-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                disabled={sending}
                onClick={sendEmail}
                className={`inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-white shadow-sm transition-all ${
                  sending ? 'bg-blue-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5 hover:shadow-md'
                }`}
              >
                {sending ? 'Envoi…' : 'Envoyer par email'}
              </button>
            </div>
            {previewUrl && (
              <p className="mt-2 text-xs text-gray-600">Ethereal preview: <a className="text-blue-600 underline" href={previewUrl} target="_blank" rel="noreferrer">ouvrir</a></p>
            )}
          </div>
        )}

        {/* Floating top-right toast */}
        <div className="pointer-events-none fixed top-4 right-4 z-50 space-y-2">
          {feedback && (
            <div
              className={`pointer-events-auto rounded-xl shadow-lg border px-4 py-3 text-sm animate-slide-up ${
                feedbackType === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : feedbackType === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-sky-50 border-sky-200 text-sky-800'
              }`}
            >
              {feedback}
            </div>
          )}
        </div>

        {/* Selected files list with remove and per-item progress */}
        {selected.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-semibold text-gray-800">Sélection en attente</h2>
            <div className="mt-2 rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="divide-y divide-gray-100">
                {selected.map((s) => (
                  <div key={s.id} className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {s.kind === 'image' ? (
                          <img src={s.previewUrl} alt="preview" className="h-12 w-12 rounded-lg object-cover border border-gray-200" />
                        ) : s.kind === 'pdf' ? (
                          <div className="h-12 w-12 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs flex items-center justify-center font-semibold">PDF</div>
                        ) : (
                          <span className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-gray-600 border border-gray-200">📄</span>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-gray-800 truncate max-w-[12rem] sm:max-w-lg">{s.file.name}</div>
                          <div className="text-xs text-gray-500">{humanSize(s.file.size)} {s.status === 'done' && '• ✅'} {s.status === 'error' && '• ❌'}</div>
                          <div className="mt-1 flex items-center gap-3 text-xs">
                            <a href={s.previewUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-700 underline">Ouvrir</a>
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSelected(s.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-red-600 hover:bg-red-100 hover:-translate-y-0.5 hover:shadow-sm transition-all"
                        title="Retirer ce fichier"
                      >
                        ❌ <span className="hidden sm:inline">Retirer</span>
                      </button>
                    </div>
                    {(s.status === 'uploading' || s.status === 'done') && (
                      <div className="mt-2">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-2 rounded-full bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 transition-[width] duration-200 ease-out" style={{ width: `${s.progress || 0}%` }} />
                        </div>
                        <div className="mt-1 text-[10px] text-gray-500">{s.progress || 0}%</div>
                        {s.error && <div className="mt-1 text-xs text-red-600">{s.error}</div>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Files list */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Fichiers existants</h2>
          <div className="mt-3 rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="divide-y divide-gray-100">
              {files.length === 0 && (
                <div className="p-4 text-sm text-gray-500">Aucun fichier pour le moment.</div>
              )}
              {files.map((f) => (
                <div key={f.name} className="flex items-center justify-between p-3 hover:bg-gray-50">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600">📄</span>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-800 truncate max-w-[12rem] sm:max-w-lg">{f.name}</div>
                      <div className="text-xs text-gray-500">{humanSize(f.size)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a className="text-blue-600 hover:text-blue-700 underline text-sm" href={`${apiBase}/uploads/${encodeURIComponent(f.name)}`} target="_blank" rel="noreferrer">Ouvrir</a>
                    <button
                      onClick={() => deleteFile(f.name)}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-red-600 hover:bg-red-100 hover:-translate-y-0.5 hover:shadow-sm transition-all"
                    >
                      🗑️ <span className="hidden sm:inline">Supprimer</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <footer className="mt-6 text-center text-xs text-gray-500">
          Upload protégé par authentification JWT.
        </footer>
      </div>
    </div>
  )
}
