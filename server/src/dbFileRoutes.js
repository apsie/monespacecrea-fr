import express from 'express'
import File from './models/File.js'
import { authRequired, requireRole } from './authMiddleware.js'

const router = express.Router()

// Create
router.post('/db/files', authRequired, async (req, res) => {
  try {
    const { filename, size, mimetype } = req.body || {}
    if (!filename || !size || !mimetype) return res.status(400).json({ success: false, message: 'Champs manquants' })
    const doc = await File.create({ filename, size, mimetype, user: req.user.id })
    res.status(201).json({ success: true, file: doc })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Erreur création fichier' })
  }
})

// Read all (own files); admin can list all
router.get('/db/files', authRequired, async (req, res) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { user: req.user.id }
    const files = await File.find(filter).sort({ createdAt: -1 })
    res.json({ success: true, files })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Erreur liste fichiers' })
  }
})

// Read one (own or admin)
router.get('/db/files/:id', authRequired, async (req, res) => {
  try {
    const file = await File.findById(req.params.id)
    if (!file) return res.status(404).json({ success: false, message: 'Introuvable' })
    if (req.user.role !== 'admin' && String(file.user) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Accès refusé' })
    }
    res.json({ success: true, file })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Erreur récupération fichier' })
  }
})

// Update (own or admin)
router.put('/db/files/:id', authRequired, async (req, res) => {
  try {
    const file = await File.findById(req.params.id)
    if (!file) return res.status(404).json({ success: false, message: 'Introuvable' })
    if (req.user.role !== 'admin' && String(file.user) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Accès refusé' })
    }
    const { filename, mimetype } = req.body || {}
    if (filename) file.filename = filename
    if (mimetype) file.mimetype = mimetype
    await file.save()
    res.json({ success: true, file })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Erreur mise à jour fichier' })
  }
})

// Delete (own or admin)
router.delete('/db/files/:id', authRequired, async (req, res) => {
  try {
    const file = await File.findById(req.params.id)
    if (!file) return res.status(404).json({ success: false, message: 'Introuvable' })
    if (req.user.role !== 'admin' && String(file.user) !== String(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Accès refusé' })
    }
    await file.deleteOne()
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Erreur suppression fichier' })
  }
})

// Admin-only purge
router.delete('/db/files', authRequired, requireRole('admin'), async (_req, res) => {
  try {
    await File.deleteMany({})
    res.json({ success: true })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Erreur purge' })
  }
})

export default router
