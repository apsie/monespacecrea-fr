import jwt from 'jsonwebtoken'

export function authRequired(req, res, next) {
  const auth = req.headers['authorization'] || ''
  // Accept "Bearer" in a case-insensitive way and trim extra spaces
  const match = /^Bearer\s+(.+)$/i.exec(auth)
  const token = match ? match[1].trim() : null
  if (!token) return res.status(401).json({ success: false, message: 'Token manquant' })

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_change_me')
    req.user = { id: payload.id, email: payload.email, name: payload.name, username: payload.username, role: payload.role }
    return next()
  } catch (err) {
    const name = err?.name || ''
    if (name === 'TokenExpiredError') {
      res.set('WWW-Authenticate', 'Bearer error="invalid_token", error_description="token expired"')
      return res.status(401).json({ success: false, message: 'Session expirée. Veuillez vous reconnecter.' })
    }
    res.set('WWW-Authenticate', 'Bearer error="invalid_token", error_description="token invalid"')
    return res.status(401).json({ success: false, message: 'Token invalide' })
  }
}

export function requireRole(...roles) {
  return function (req, res, next) {
    if (!req.user || !req.user.role) return res.status(403).json({ success: false, message: 'Accès refusé' })
    if (roles.length === 0) return next()
    if (roles.includes(req.user.role)) return next()
    return res.status(403).json({ success: false, message: 'Rôle insuffisant' })
  }
}
