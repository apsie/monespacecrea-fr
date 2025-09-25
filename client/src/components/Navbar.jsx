import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

export default function Navbar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isAuthed = !!localStorage.getItem('token')
  const logout = () => { localStorage.removeItem('token'); navigate('/') }

  const linkCls = (to) => `relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
    pathname === to ? 'text-blue-700 bg-blue-50' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
  }`

  return (
    <nav className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4">
        <div className="h-14 flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 font-semibold text-gray-900">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-blue-600 text-white shadow-sm">↥</span>
            <span>Fichiers</span>
          </Link>
          <div className="ml-auto flex items-center gap-1.5">
            {!isAuthed && <Link to="/login" className={linkCls('/login')}>Connexion</Link>}
            {!isAuthed && <Link to="/register" className={linkCls('/register')}>Inscription</Link>}
            {isAuthed && <Link to="/upload" className={linkCls('/upload')}>Upload</Link>}
            {isAuthed && <Link to="/required-docs" className={linkCls('/required-docs')}>Pièces attendues</Link>}
            {isAuthed && <Link to="/profile" className={linkCls('/profile')}>Profil</Link>}
            {isAuthed && (
              <button
                onClick={logout}
                className="ml-1 inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 transition"
                title="Se déconnecter"
              >
                <span>Déconnexion</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
