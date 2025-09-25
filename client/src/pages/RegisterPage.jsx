import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { api, getApiBase } from '../api'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ping, setPing] = useState('')

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const payload = { name: form.name.trim(), email: form.email.trim(), password: form.password }
      await api.post('/register', payload)
      navigate('/login')
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Erreur lors de l’inscription"
      const code = err?.response?.status
      setError(code ? `${msg} (HTTP ${code})` : msg)
    } finally {
      setLoading(false)
    }
  }

  const onPing = async () => {
    setPing('')
    setError('')
    try {
      const base = await getApiBase()
      const r = await fetch(`${base}/health`)
      const j = await r.json().catch(() => ({}))
      setPing(r.ok ? `API OK sur ${base} (db: ${j?.db?.state || 'unknown'})` : `API non OK (${r.status})`)
    } catch (e) {
      setError('Impossible de joindre l’API. Vérifiez que le serveur tourne sur http://localhost:4000')
    }
  }

  return (
    <div className="min-h-[80vh] sm:min-h-screen flex items-center justify-center px-4 py-10 animate-fade-in">
      <div className="w-full max-w-md bg-white/80 backdrop-blur border border-gray-200 rounded-2xl shadow-xl p-6 sm:p-8">
        <header className="text-center mb-2">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Inscription</h1>
          <p className="mt-1 text-sm text-gray-600">Créez votre compte pour commencer.</p>
        </header>

        {(error || ping) && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border p-3 text-sm"
               style={{ borderColor: error ? '#fecaca' : '#bfdbfe', background: error ? '#fef2f2' : '#eff6ff', color: error ? '#991b1b' : '#1e40af' }}>
            <span className="text-base">{error ? '❌' : 'ℹ️'}</span>
            <div>{error || ping}</div>
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">👤</span>
              <input
                name="name"
                value={form.name}
                onChange={onChange}
                className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Votre nom"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">@</span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={onChange}
                className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="vous@example.com"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">••</span>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={onChange}
                className="w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-gray-900 placeholder-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Créez un mot de passe"
                required
              />
            </div>
          </div>

          <button
            disabled={loading}
            className={`w-full inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-white shadow-sm transition-all ${
              loading ? 'bg-blue-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5 hover:shadow-md'
            }`}
          >
            {loading ? 'Inscription...' : "S'inscrire"}
          </button>
          <button
            type="button"
            onClick={onPing}
            className="mt-2 w-full inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-sm"
          >
            Tester la connexion API
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-blue-600 hover:text-blue-700 underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
