import multer from 'multer'
import path from 'path'
import fs from 'fs'

const uploadsDir = path.resolve(process.cwd(), 'server', 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir)
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname)
    const base = path.basename(file.originalname, ext)
    const safeBase = base.replace(/[^a-zA-Z0-9-_]/g, '_')
    const unique = Date.now()
    cb(null, `${safeBase}-${unique}${ext}`)
  }
})

const allowedExt = new Set(['.pdf', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.zip'])

function fileFilter (req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase()
  if (!allowedExt.has(ext)) {
    return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'type'))
  }
  cb(null, true)
}

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 MB
  }
})

export const UPLOADS_DIR = uploadsDir
