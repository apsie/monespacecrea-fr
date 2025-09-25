import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import UploadPage from './pages/UploadPage'
import RequiredDocs from './pages/RequiredDocs'
import Profile from './pages/Profile'

function RequireAuth({ children }) {
  const token = localStorage.getItem('token')
  if (!token) return <Navigate to="/login" replace />
  return children
}

export default function App () {
  return (
    <div>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/upload" element={<RequireAuth><UploadPage /></RequireAuth>} />
        {/* Redirect old Documents path to Required Docs */}
        <Route path="/documents" element={<Navigate to="/required-docs" replace />} />
  <Route path="/required-docs" element={<RequireAuth><RequiredDocs /></RequireAuth>} />
  <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
  {/** Page Diagnostics SMTP supprimée **/}
      </Routes>
      <Footer />
    </div>
  )
}
