import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { upload, UPLOADS_DIR } from './multerConfig.js'
import FileModel from './models/File.js'
import dbFileRoutes from './dbFileRoutes.js'
import authRoutes from './authRoutes.js'
import { authRequired } from './authMiddleware.js'
import nodemailer from 'nodemailer'
// Import the implementation directly to avoid pdf-parse's index.js self-test in some setups
import pdfParse from 'pdf-parse/lib/pdf-parse.js'
import mammoth from 'mammoth'
import Cv from './models/Cv.js'
import ExtractedDocument from './models/ExtractedDocument.js'
import TypedDocument from './models/TypedDocument.js'
import connectDB, { getDbStatus } from '../config/db.js'
import User from './models/User.js'
import { initSql, isSqlEnabled, sqlSaveTypedDocument, sqlGetLatestByUser, sqlDeleteByType, sqlGetAllByUser } from './sqlDb.js'

dotenv.config()
const app = express()
const DEFAULT_PORT = Number(process.env.PORT) || 4000
let ACTUAL_PORT = DEFAULT_PORT

app.use(cors({
  origin: /http:\/\/localhost:\d+$/,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  credentials: false
}))
app.options('*', cors())

app.use(express.json())
app.get('/health', (_req, res) => {
  res.json({ ok: true, db: getDbStatus(), sql: { enabled: isSqlEnabled() } })
})

app.use('/uploads', express.static(UPLOADS_DIR))
app.use('/api', authRoutes)
app.use('/api', dbFileRoutes)
// Current user profile
app.get('/api/me', authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean()
    if (!user) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' })
    const { _id, name, username, email, role, createdAt, updatedAt } = user
    res.json({ success: true, user: { id: _id, name, username, email, role, createdAt, updatedAt } })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Erreur récupération profil' })
  }
})
// --- Document types catalog (server-side reference) ---
const DOC_CATALOG = [
  { category: 'Livrables', items: [
    "Contrat d'engagement",
    'Emargement',
    'Questionnaire Evaluation Entreprise',
    'Bilan Diagnostic',
    'Questionnaire de satisfaction'
  ]},
  { category: "Documents d'identité", items: [
    'CNI',
    'Passeport'
  ]},
  { category: 'Justificatif RSA', items: [
    'Attestation de paiement CAF',
    "Copie d'écran CDAP"
  ]},
  { category: 'Justificatif Entreprise', items: [
    'Avis Sirene',
    'Extrait K ou Kbis'
  ]},
  { category: "Justificatif d'inéligibilité", items: [
    'Attestation de paiement CAF',
    "Copie d'écran CDAP d'inéligibilité"
  ]},
  { category: 'Justificatif radiation entreprise', items: [
    'Avis Sirene',
    'Extrait K ou Kbis'
  ]},
  { category: 'Declarations / Attestations', items: [
    'Attestation fiscale',
    "Attestation de chiffre d'affaires",
    'Attestation de versement CFP',
    'Bilan / Liasse fiscale',
    "Déclaration mensuelle de chiffre d'affaires",
    "Déclaration trimestrielle de chiffre d'affaire"
  ]},
  { category: 'Autre', items: [
    'Personnalisé'
  ]}
]

function findCategoryForType(t) {
  for (const cat of DOC_CATALOG) {
    if (cat.items.some(x => x.toLowerCase() === t.toLowerCase())) return cat.category
  }
  return 'Autre'
}

// Expose catalog to clients
app.get('/api/documents/catalog', authRequired, (_req, res) => {
  res.json({ success: true, catalog: DOC_CATALOG })
})

// Dynamic period options for periodized documents (years, months, trimesters)
// (No /api/periods route needed; periods are generated client-side to allow wide ranges.)

// Upload for a specific document type
app.post('/api/upload/:type', authRequired, (req, res) => {
  const single = upload.single('file')
  single(req, res, async function (err) {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ success: false, message: 'Fichier trop volumineux (max 10 Mo).' })
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ success: false, message: 'Type de fichier non autorisé. Autorisés: .pdf, .docx, .txt, .jpg, .png, .zip' })
      }
      return res.status(400).json({ success: false, message: 'Erreur lors du téléversement.', details: err.message })
    }
    if (!req.file) return res.status(400).json({ success: false, message: 'Aucun fichier reçu.' })

    const docType = decodeURIComponent(req.params.type || '').trim()
    if (!docType) return res.status(400).json({ success: false, message: 'Type de document manquant.' })
    const category = findCategoryForType(docType)
    try {
      const savedName = path.basename(req.file.path)
      const payload = {
        type: docType,
        category,
        fileName: savedName,
        filePath: `/uploads/${savedName}`,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        uploadDate: new Date(),
        user: req.user?.id || undefined
      }
      let doc
      if (isSqlEnabled()) {
        // Persist only in MariaDB when available
        try { await sqlSaveTypedDocument(payload) } catch (e) { console.warn('[MariaDB] save typed doc failed:', e?.message || e) }
        doc = payload
      } else {
        // Fallback: persist in Mongo if MariaDB is not configured
        doc = await TypedDocument.create(payload)
      }
      // Also persist file metadata in FileModel for consistency
      try { await FileModel.create({ filename: savedName, size: req.file.size, mimetype: req.file.mimetype, user: req.user.id }) } catch {}
      return res.json({ success: true, message: 'Fichier téléversé avec succès.', document: doc })
    } catch (e) {
      console.error('Upload by type error:', e)
      return res.status(500).json({ success: false, message: 'Erreur serveur.' })
    }
  })
})

// Latest document per type for current user
app.get('/api/documents/my-latest', authRequired, async (req, res) => {
  try {
    // If MariaDB is enabled, read from it; otherwise fallback to Mongo aggregation
    let items
    if (isSqlEnabled()) {
      items = await sqlGetLatestByUser(req.user.id)
    } else {
      const match = { user: req.user.id }
      const pipeline = [
        { $match: match },
        { $sort: { uploadDate: -1 } },
        { $group: { _id: '$type', doc: { $first: '$$ROOT' } } },
        { $replaceRoot: { newRoot: '$doc' } }
      ]
      items = await TypedDocument.aggregate(pipeline)
    }
    res.json({ success: true, items })
  } catch (e) {
    console.error('my-latest error:', e)
    res.status(500).json({ success: false, message: 'Impossible de récupérer le statut.' })
  }
})

// All typed documents (latest per type) for current user with minimal fields
app.get('/api/documents/my-history', authRequired, async (req, res) => {
  try {
    let items
    if (isSqlEnabled()) {
      items = await sqlGetLatestByUser(req.user.id)
    } else {
      const pipeline = [
        { $match: { user: req.user.id } },
        { $sort: { uploadDate: -1 } },
        { $group: { _id: '$type', doc: { $first: '$$ROOT' } } },
        { $replaceRoot: { newRoot: '$doc' } }
      ]
      items = await TypedDocument.aggregate(pipeline)
    }
    const mapped = (items || []).map(d => ({
      type: d.type,
      category: d.category,
      fileName: d.fileName,
      filePath: d.filePath,
      uploadedAt: d.uploadDate
    }))
    res.json({ success: true, items: mapped })
  } catch (e) {
    console.error('my-history error:', e)
    res.status(500).json({ success: false, message: 'Impossible de récupérer l\'historique.' })
  }
})

// Full upload list for current user (latest first)
app.get('/api/documents/my-uploads', authRequired, async (req, res) => {
  try {
    let items
    if (isSqlEnabled()) {
      items = await sqlGetAllByUser(req.user.id)
    } else {
      items = await TypedDocument.find({ user: req.user.id }).sort({ uploadDate: -1 }).lean()
    }
    let userName = ''
    try {
      const u = await User.findById(req.user.id).lean()
      userName = u?.name || u?.username || u?.email || ''
    } catch {}
    const mapped = (items || []).map(it => ({
      ...it,
      userName
    }))
    res.json({ success: true, items: mapped })
  } catch (e) {
    console.error('my-uploads error:', e)
    res.status(500).json({ success: false, message: 'Impossible de récupérer les uploads.' })
  }
})

// Delete typed document(s) for a given type (current user)
app.delete('/api/typed-documents', authRequired, async (req, res) => {
  try {
    const typeRaw = req.query.type || req.body?.type || ''
    const docType = decodeURIComponent(typeRaw).trim()
    if (!docType) return res.status(400).json({ success: false, message: 'Paramètre "type" manquant.' })
    if (isSqlEnabled()) {
      // Delete only in MariaDB when available
      const r = await sqlDeleteByType(req.user.id, docType)
      return res.json({ success: true, deleted: r.deleted || 0 })
    }
    const result = await TypedDocument.deleteMany({ user: req.user.id, type: docType })
    res.json({ success: true, deleted: result?.deletedCount || 0 })
  } catch (e) {
    console.error('delete typed-documents error:', e)
    res.status(500).json({ success: false, message: 'Erreur lors de la suppression.' })
  }
})
// List documents (JWT-protected): ?q=search&page=1&limit=20
app.get('/api/documents', authRequired, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20))
    const skip = (page - 1) * limit
    const q = (req.query.q || '').toString().trim()
    const filter = q
      ? {
          $or: [
            { fileName: { $regex: q, $options: 'i' } },
            { fileType: { $regex: q, $options: 'i' } },
            { content: { $regex: q, $options: 'i' } }
          ]
        }
      : {}

    const [items, total] = await Promise.all([
      ExtractedDocument.find(filter).sort({ uploadDate: -1 }).skip(skip).limit(limit).lean(),
      ExtractedDocument.countDocuments(filter)
    ])
    res.json({ success: true, total, page, limit, items })
  } catch (e) {
    console.error('Error listing documents:', e)
    res.status(500).json({ success: false, message: 'Impossible de lister les documents.' })
  }
})

// Admin diagnostics: expose migration status (JWT-protected)
app.get('/api/admin/migration-status', authRequired, async (_req, res) => {
  try {
    const report = app.locals.migrationReport || null
    let users = 0
    try { users = await User.countDocuments() } catch {}
    res.json({ success: true, report, totals: { users } })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Erreur récupération statut migration.' })
  }
})

// Route protégée par JWT
app.post('/api/upload', authRequired, (req, res) => {
  const single = upload.single('file')
  single(req, res, async function (err) {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ success: false, message: 'Fichier trop volumineux (max 10 Mo).' })
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ success: false, message: 'Type de fichier non autorisé. Autorisés: .pdf, .docx, .txt, .jpg, .png, .zip' })
      }
      return res.status(400).json({ success: false, message: 'Erreur lors du téléversement.', details: err.message })
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Aucun fichier reçu.' })
    }

    // Persist file metadata in DB and extract text content for PDF/DOCX/TXT
    const savedName = path.basename(req.file.path)
    const ext = path.extname(savedName).toLowerCase()
    let extracted = { firstName: '', lastName: '', email: '', phone: '', address: '' }
    let extractedText = ''
    try {
      await FileModel.create({ filename: savedName, size: req.file.size, mimetype: req.file.mimetype, user: req.user.id })
      const buffer = await fs.promises.readFile(req.file.path)
      // Extract raw text depending on file type
      if (ext === '.pdf') {
        const parsed = await pdfParse(buffer)
        extractedText = parsed.text || ''
      } else if (ext === '.docx') {
        const result = await mammoth.extractRawText({ buffer })
        extractedText = result.value || ''
      } else if (ext === '.txt') {
        extractedText = buffer.toString('utf-8')
      }

      if (extractedText) {
        const emailMatch = extractedText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
        const phoneMatch = extractedText.match(/(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/)
        // Very naive name/address heuristics: take first two words of first non-empty line
        const lines = extractedText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
        let first = '', last = '', address = ''
        if (lines.length) {
          const parts = lines[0].split(/\s+/)
          if (parts.length >= 2) { first = parts[0]; last = parts[1] }
          // Try to find a line that looks like an address (contains digits and words)
          const addrLine = lines.find(l => /\d+\s+\w+/.test(l))
          if (addrLine) address = addrLine
        }
        extracted = {
          firstName: first,
          lastName: last,
          email: emailMatch ? emailMatch[0] : '',
          phone: phoneMatch ? phoneMatch[0] : '',
          address
        }
      }
      // Save CV doc if PDF/DOCX
      if (ext === '.pdf' || ext === '.docx') {
        try {
          await Cv.create({ fileName: savedName, extracted, user: req.user.id })
        } catch (e) {
          console.warn('[CV] Save error:', e?.message || e)
        }
      }

      // Save content-based document metadata with extracted content
      try {
        await ExtractedDocument.create({
          fileName: savedName,
          fileType: req.file.mimetype,
          fileSize: req.file.size,
          uploadDate: new Date(),
          content: extractedText || ''
        })
      } catch (e) {
        console.warn('[ExtractedDocument] Save error:', e?.message || e)
      }
    } catch (e) {
      console.warn('[Upload] Erreur enregistrement/lecture:', e?.message || e)
    }

    return res.json({
      success: true,
      message: 'Fichier téléversé avec succès.',
      file: {
        originalName: req.file.originalname,
        savedAs: savedName,
        size: req.file.size,
        mimetype: req.file.mimetype,
        uploadedAt: new Date().toISOString(),
        url: `/uploads/${savedName}`,
        extracted,
        content: extractedText || ''
      }
    })
  })
})

// Envoi d'email avec lien de téléchargement
app.post('/api/send-email', authRequired, async (req, res) => {
  const { toEmail, fileName, fileUrl } = req.body || {}
  if (!toEmail || !fileName || !fileUrl) {
    return res.status(400).json({ success: false, message: 'Paramètres manquants. Requis: toEmail, fileName, fileUrl' })
  }

  try {
    // Configure transporter: use env SMTP if provided, otherwise create Ethereal test account
    let transporter
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        logger: true,
        debug: true
      })
    } else {
      const testAccount = await nodemailer.createTestAccount()
      console.log('[SMTP] Utilisation de Ethereal (compte de test).', testAccount.user)
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
        logger: true,
        debug: true
      })
    }

    try { await transporter.verify(); console.log('[SMTP] Vérification connectivité OK') } catch (e) { console.error('[SMTP] Vérification échouée', e) }

  const origin = process.env.PUBLIC_APP_URL || `http://localhost:${ACTUAL_PORT}`
    const absoluteUrl = fileUrl.startsWith('http') ? fileUrl : `${origin}${fileUrl}`

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || 'no-reply@example.com',
      to: toEmail,
      subject: 'Nouveau fichier à télécharger',
      text: `Vous avez reçu un fichier : ${fileName}. Cliquez ici pour le télécharger : ${absoluteUrl}`,
      html: `
        <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto;max-width:560px;margin:auto;padding:24px;background:#f8fafc;border-radius:16px;border:1px solid #e5e7eb;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <div style="width:36px;height:36px;border-radius:10px;background:#dbeafe;color:#1d4ed8;display:flex;align-items:center;justify-content:center;font-weight:700;">U</div>
            <div style="font-size:16px;color:#0f172a;font-weight:700;">File Uploader</div>
          </div>
          <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px;">
            <p style="margin:0 0 8px 0;color:#0f172a;">Vous avez reçu un fichier :</p>
            <p style="margin:0 0 16px 0;font-weight:700;color:#0f172a;">${fileName}</p>
            <a href="${absoluteUrl}" style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:10px 14px;border-radius:10px;font-weight:600">Télécharger le fichier</a>
            <p style="margin:12px 0 0 0;font-size:12px;color:#64748b;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur:</p>
            <p style="margin:4px 0 0 0;font-size:12px;color:#0369a1;word-break:break-all;">${absoluteUrl}</p>
          </div>
          <p style="margin-top:12px;font-size:12px;color:#94a3b8;">Cet email vous a été envoyé via File Uploader.</p>
        </div>
      `
    })

    const previewUrl = nodemailer.getTestMessageUrl?.(info)
    console.log('[MAIL] Message envoyé ID:', info.messageId, 'Preview:', previewUrl)
    res.json({ success: true, message: 'Email envoyé.', previewUrl })
  } catch (e) {
    console.error('Email send error:', e)
    res.status(500).json({ success: false, message: "Impossible d'envoyer l'email." })
  }
})

// (Diagnostics SMTP supprimé à la demande)

// Liste des fichiers présents dans le dossier uploads
app.get('/api/files', async (_req, res) => {
  try {
    const files = await fs.promises.readdir(UPLOADS_DIR)
    const details = await Promise.all(files.map(async (name) => {
      const filePath = path.join(UPLOADS_DIR, name)
      const stat = await fs.promises.stat(filePath)
      if (!stat.isFile()) return null
      return {
        name,
        size: stat.size,
        createdAt: stat.ctime
      }
    }))
    res.json({ success: true, files: details.filter(Boolean) })
  } catch (e) {
    console.error('Error listing files:', e)
    res.status(500).json({ success: false, message: 'Impossible de lister les fichiers.' })
  }
})

// Suppression d'un fichier spécifique (protégée par JWT)
app.delete('/api/files/:filename', authRequired, async (req, res) => {
  const { filename } = req.params
  try {
    // Empêche la traversée de répertoire
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ success: false, message: 'Nom de fichier invalide.' })
    }
    const filePath = path.join(UPLOADS_DIR, filename)
    await fs.promises.unlink(filePath)
    res.json({ success: true, message: 'Fichier supprimé.' })
  } catch (e) {
    if (e.code === 'ENOENT') {
      return res.status(404).json({ success: false, message: 'Fichier introuvable.' })
    }
    console.error('Error deleting file:', e)
    res.status(500).json({ success: false, message: 'Impossible de supprimer le fichier.' })
  }
})

app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ success: false, message: 'Erreur serveur.' })
})

// Start server with port auto-detection (retry up to +10 ports)
async function startWithRetry(startPort, maxAttempts = 11) {
  let attempt = 0
  return new Promise((resolve, reject) => {
    const tryListen = (port) => {
      const server = app.listen(port, () => {
        ACTUAL_PORT = port
        console.log(`Server listening on http://localhost:${port}`)
        resolve(server)
      })
      server.on('error', (err) => {
        if (err && (err.code === 'EADDRINUSE' || err.code === 'EACCES') && attempt < maxAttempts - 1) {
          attempt++
          const nextPort = startPort + attempt
          console.warn(`[Server] Port ${port} indisponible (${err.code}). Tentative sur ${nextPort}...`)
          setTimeout(() => tryListen(nextPort), 150)
        } else {
          reject(err)
        }
      })
    }
    tryListen(startPort)
  })
}

// Initialize DB and then start the server
;(async () => {
  try {
    await connectDB()
    // Try to init MariaDB (optional). If it fails, continue with Mongo only
    await initSql()
    const SQL_REQUIRED = (process.env.SQL_REQUIRED || '').toString().toLowerCase() === 'true' || (process.env.SQL_REQUIRED || '') === '1'
    if (SQL_REQUIRED && !isSqlEnabled()) {
      console.error('[MariaDB] SQL_REQUIRED=1 mais MariaDB n\'est pas connecté. Arrêt du serveur.')
      process.exit(1)
    }
    // Migrate legacy users from JSON if present
    const report = await migrateLegacyUsers()
    if (report) app.locals.migrationReport = report
    await startWithRetry(DEFAULT_PORT)
  } catch (e) {
    console.error('Impossible de démarrer le serveur:', e)
    process.exit(1)
  }
})()

// --- Migration helpers ---
async function migrateLegacyUsers() {
  try {
    const candidates = [
      path.join(process.cwd(), 'users.json'),
      path.join(process.cwd(), 'server', 'users.json')
    ]
    let totalImported = 0
    let totalSkipped = 0
    let totalUsernameAdjusted = 0
    const importedEmails = []
    const processedFiles = []
    const makeUsername = (name, email) => {
      const baseSrc = (name || email || '').toString()
      const base = baseSrc.split('@')[0].replace(/[^a-z0-9]+/gi, '').toLowerCase().substring(0, 16) || 'user'
      return base
    }
    for (const p of candidates) {
      const exists = fs.existsSync(p)
      if (!exists) continue
      processedFiles.push(p)
      const raw = await fs.promises.readFile(p, 'utf-8')
      let parsed
      try { parsed = JSON.parse(raw) } catch (e) { console.warn(`[Migrate] JSON invalide: ${p}`); continue }
      const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.users) ? parsed.users : []
      if (!arr.length) continue
      console.log(`[Migrate] Détection ${arr.length} utilisateur(s) dans ${p}`)
      for (const u of arr) {
        const email = (u?.email || '').toLowerCase().trim()
        const name = u?.name || ''
        const passwordHash = u?.passwordHash || ''
        if (!email || !passwordHash || !name) { totalSkipped++; continue }
        const existsUser = await User.findOne({ email }).lean()
        if (existsUser) { totalSkipped++; continue }
        // Generate a username and ensure uniqueness
        let username = makeUsername(name, email)
        let suffix = 0
        while (await User.exists({ username })) {
          suffix++
          username = `${username.replace(/\d+$/, '')}${suffix}`
          totalUsernameAdjusted++
          if (suffix > 10000) break
        }
        try {
          await User.create({ name, username, email, role: 'user', passwordHash })
          totalImported++
          if (importedEmails.length < 100) importedEmails.push(email)
        } catch (e) {
          if (e && e.code === 11000) { totalSkipped++; continue }
          console.warn('[Migrate] Échec import utilisateur', email, e?.message || e)
          totalSkipped++
        }
      }
    }
    if (totalImported || totalSkipped) {
      console.log(`[Migrate] Terminé. Importés: ${totalImported}, Ignorés: ${totalSkipped}`)
    }
    return { imported: totalImported, skipped: totalSkipped, usernameAdjusted: totalUsernameAdjusted, files: processedFiles, importedSample: importedEmails, at: new Date().toISOString() }
  } catch (e) {
    console.warn('[Migrate] Erreur migration users.json:', e?.message || e)
    return { error: e?.message || String(e), imported: 0, skipped: 0, usernameAdjusted: 0, files: [], importedSample: [], at: new Date().toISOString() }
  }
}
