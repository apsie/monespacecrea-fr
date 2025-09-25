import mysql from 'mysql2/promise'

let pool = null

export async function initSql() {
  const host = process.env.MYSQL_HOST || '127.0.0.1'
  const port = Number(process.env.MYSQL_PORT) || 3306
  const database = process.env.MYSQL_DB || process.env.MYSQL_DATABASE || 'upload_app'
  const user = process.env.MYSQL_USER || process.env.MARIADB_USER || 'app'
  const password = process.env.MYSQL_PASSWORD || process.env.MARIADB_PASSWORD || 'app'

  try {
    pool = mysql.createPool({ host, port, database, user, password, waitForConnections: true, connectionLimit: 10 })
    // Sanity check + ensure table exists
    await ensureSchema()
    console.log(`[MariaDB] Connected: ${user}@${host}:${port}/${database}`)
    return true
  } catch (e) {
    console.warn('[MariaDB] Connection failed:', e?.message || e)
    pool = null
    return false
  }
}

async function ensureSchema() {
  if (!pool) return
  const sql = `CREATE TABLE IF NOT EXISTS typed_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    type VARCHAR(255) NOT NULL,
    category VARCHAR(255) NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(1024) NULL,
    file_type VARCHAR(255) NULL,
    file_size BIGINT NULL,
    upload_date DATETIME NOT NULL,
    INDEX idx_user_type_date (user_id, type, upload_date)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;
  await pool.query(sql)
}

export async function sqlSaveTypedDocument(doc) {
  if (!pool) return null
  const q = `INSERT INTO typed_documents (user_id, type, category, file_name, file_path, file_type, file_size, upload_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  const params = [
    doc.user || doc.userId || '',
    doc.type,
    doc.category || null,
    doc.fileName,
    doc.filePath || null,
    doc.fileType || null,
    doc.fileSize || null,
    doc.uploadDate instanceof Date ? doc.uploadDate : new Date(doc.uploadDate || Date.now())
  ]
  await pool.query(q, params)
  return true
}

export async function sqlGetLatestByUser(userId) {
  if (!pool) return null
  // Get latest row per type for this user
  const q = `
    SELECT t.* FROM typed_documents t
    JOIN (
      SELECT type, MAX(upload_date) AS maxd
      FROM typed_documents
      WHERE user_id = ?
      GROUP BY type
    ) x ON t.type = x.type AND t.upload_date = x.maxd
    WHERE t.user_id = ?
    ORDER BY t.type ASC
  `
  const [rows] = await pool.query(q, [userId, userId])
  return rows.map(r => ({
    _id: r.id,
    type: r.type,
    category: r.category,
    fileName: r.file_name,
    filePath: r.file_path,
    fileType: r.file_type,
    fileSize: r.file_size,
    uploadDate: r.upload_date,
    user: r.user_id
  }))
}

export async function sqlDeleteByType(userId, type) {
  if (!pool) return { deleted: 0 }
  const [ret] = await pool.query('DELETE FROM typed_documents WHERE user_id = ? AND type = ?', [userId, type])
  return { deleted: ret.affectedRows || 0 }
}

export function isSqlEnabled() {
  return !!pool
}

export async function sqlGetAllByUser(userId) {
  if (!pool) return []
  const q = 'SELECT * FROM typed_documents WHERE user_id = ? ORDER BY upload_date DESC'
  const [rows] = await pool.query(q, [userId])
  return rows.map(r => ({
    _id: r.id,
    type: r.type,
    category: r.category,
    fileName: r.file_name,
    filePath: r.file_path,
    fileType: r.file_type,
    fileSize: r.file_size,
    uploadDate: r.upload_date,
    user: r.user_id
  }))
}
