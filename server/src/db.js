import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// Resolve to server/users.json regardless of working directory
const dbFile = path.resolve(__dirname, '..', 'users.json')

function initDB() {
  if (!fs.existsSync(dbFile)) {
    fs.writeFileSync(dbFile, JSON.stringify({ users: [] }, null, 2), 'utf8')
  }
}

export function readUsers() {
  initDB()
  const raw = fs.readFileSync(dbFile, 'utf8')
  const data = JSON.parse(raw || '{"users": []}')
  return data.users || []
}

export function writeUsers(users) {
  initDB()
  fs.writeFileSync(dbFile, JSON.stringify({ users }, null, 2), 'utf8')
}

export function findUserByEmail(email) {
  const users = readUsers()
  return users.find(u => u.email.toLowerCase() === email.toLowerCase())
}

export function addUser(user) {
  const users = readUsers()
  users.push(user)
  writeUsers(users)
}
