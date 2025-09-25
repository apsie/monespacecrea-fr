import React from 'react'
import { Link } from 'react-router-dom'

export default function HomePage() {
  return (
    <section className="relative min-h-[90vh] sm:min-h-screen overflow-hidden bg-gradient-to-r from-slate-50 via-blue-50 to-slate-50">
      {/* subtle pattern */}
      <div className="pointer-events-none absolute inset-0 opacity-40" aria-hidden>
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-gradient-to-tr from-blue-200 to-blue-100 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-gradient-to-tr from-slate-200 to-blue-100 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Text column */}
          <div className="animate-fade-in">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-gray-900 animate-slide-up">
              Téléversez vos fichiers en toute simplicité
            </h1>
            <p className="mt-4 text-base sm:text-lg md:text-xl text-gray-600 max-w-xl animate-slide-up [animation-delay:120ms]">
              Un outil moderne, sécurisé et rapide pour envoyer vos documents. Connexion, upload, progression en direct et gestion simplifiée.
            </p>

            <div className="mt-8 flex flex-wrap gap-3 animate-slide-up [animation-delay:220ms]">
              <Link
                to="/login"
                className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-white shadow-md transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-lg"
              >
                Commencer
                <svg className="ml-2 h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center rounded-lg bg-white/70 px-6 py-3 text-gray-900 border border-gray-200 shadow-sm backdrop-blur transition-all duration-200 hover:bg-white"
              >
                En savoir plus
              </a>
            </div>
          </div>

          {/* Illustration column */}
          <div className="flex justify-center md:justify-end animate-fade-in [animation-delay:160ms]">
            <div className="bg-white/60 backdrop-blur rounded-2xl p-8 shadow-lg border border-gray-100">
              {/* Upload cloud SVG */}
              <svg className="w-64 h-64 text-blue-600" viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M200 208H72a40 40 0 1 1 6.58-79.54A56 56 0 0 1 224 120a56.1 56.1 0 0 1-3.21 18.68" stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                <path d="M128 160V64" stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M96 96l32-32 32 32" stroke="currentColor" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
      </div>
      {/* Features */}
      <section id="features" className="relative bg-transparent py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[{
              title: 'Sécurisé par JWT',
              desc: 'Vos actions sont protégées par un jeton signé et expirent automatiquement.',
              icon: (
                <svg className="w-7 h-7 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0-1.657 1.343-3 3-3s3 1.343 3 3v2m-6 0V9a3 3 0 1 0-6 0v4m0 0a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2m-12 0V9m12 0v4" />
                </svg>
              )
            },{
              title: 'Upload rapide',
              desc: 'Suivez la progression en temps réel et obtenez un lien directement.',
              icon: (
                <svg className="w-7 h-7 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 0 0 2 2h12M4 12l4-4m0 0l4 4m-4-4v12" />
                </svg>
              )
            },{
              title: 'Formats variés',
              desc: 'PDF, images et archives pris en charge jusqu’à 10 Mo.',
              icon: (
                <svg className="w-7 h-7 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              )
            }].map((f, i) => (
              <div key={i} className="group rounded-2xl border border-gray-200 bg-white/80 backdrop-blur p-6 shadow-sm hover:shadow-md transition-all animate-slide-up" style={{ animationDelay: `${100 + i * 100}ms` }}>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 border border-blue-100">
                    {f.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">{f.title}</h3>
                </div>
                <p className="mt-3 text-gray-600 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </section>
  )
}
