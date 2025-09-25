import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import User from './models/User.js'

const router = express.Router()

function generateToken(user) {
  const payload = { id: user.id, email: user.email, name: user.name, username: user.username, role: user.role || 'user' }
  const secret = process.env.JWT_SECRET || 'dev_secret_change_me'
  return jwt.sign(payload, secret, { expiresIn: '2h' })
}

// No OTP flow: keep only simple login

router.post('/register', async (req, res) => {
  try {
    let { name, username, email, password, role } = req.body || {}
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Champs manquants' })
    }
    if (!username) {
      const base = (name || email).toString().split('@')[0].replace(/[^a-z0-9]+/gi, '').toLowerCase().substring(0, 16) || 'user'
      username = `${base}${Math.floor(Math.random()*10000)}`
    }

    const emailLc = email.toLowerCase().trim()
    const usernameLc = username.toLowerCase().trim()
    const existing = await User.findOne({ $or: [{ email: emailLc }, { username: usernameLc }] }).lean()
    if (existing) {
      const field = existing.email === emailLc ? 'Email' : 'Nom utilisateur'
      return res.status(409).json({ success: false, message: `${field} déjà utilisé` })
    }

    const salt = await bcrypt.genSalt(10)
    const hash = await bcrypt.hash(password, salt)
    const user = await User.create({ name, username: usernameLc, email: emailLc, role: role || 'user', passwordHash: hash })
    return res.status(201).json({ success: true, message: 'Utilisateur créé', user: { id: user._id, name: user.name, username: user.username, email: user.email, role: user.role } })
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email ou nom utilisateur déjà utilisé' })
    }
    console.error('Register error:', err)
    return res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, username, password } = req.body || {}
    if ((!email && !username) || !password) {
      return res.status(400).json({ success: false, message: 'Champs manquants' })
    }
    const query = email ? { email: email.toLowerCase().trim() } : { username: username.toLowerCase().trim() }
    const user = await User.findOne(query)
    if (!user) {
      return res.status(401).json({ success: false, message: 'Identifiants invalides' })
    }
    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      return res.status(401).json({ success: false, message: 'Identifiants invalides' })
    }
    const token = generateToken({ id: user._id, email: user.email, name: user.name, username: user.username, role: user.role })
    return res.json({ success: true, token, user: { id: user._id, name: user.name, username: user.username, email: user.email, role: user.role } })
  } catch (err) {
    console.error('Login error:', err)
    return res.status(500).json({ success: false, message: 'Erreur serveur' })
  }
})

// OTP endpoints removed

export default router
