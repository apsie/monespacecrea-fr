import React from 'react'

export default function Footer () {
  return (
    <footer className="mt-16 border-t border-gray-200 bg-white/70 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 py-6 text-sm text-gray-600 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white text-xs">↥</span>
          <span>Gestion de fichiers</span>
        </div>
        <div className="text-xs text-gray-500">© {new Date().getFullYear()} • Tous droits réservés</div>
      </div>
    </footer>
  )
}
