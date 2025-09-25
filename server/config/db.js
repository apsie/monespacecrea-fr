import mongoose from 'mongoose'

// Connection URI: set MONGODB_URI in your environment, otherwise defaults to local MongoDB
let EFFECTIVE_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/upload_db'
let memoryServer = null

// Optional debug logs (set MONGODB_DEBUG=1 to enable)
if (process.env.MONGODB_DEBUG) {
  mongoose.set('debug', true)
}

// Avoid creating multiple connections in dev (nodemon hot reload)
let cached = global.__MONGO_CONN
if (!cached) {
  cached = global.__MONGO_CONN = { conn: null, promise: null }
}

export async function connectDB() {
  if (cached.conn) return cached.conn
  if (!cached.promise) {
    mongoose.set('strictQuery', true)
    cached.promise = (async () => {
      try {
        // Try normal connection first
        const m = await mongoose.connect(EFFECTIVE_URI, {
          maxPoolSize: 10,
          autoIndex: true
        })
        return m
      } catch (err) {
        // Optional fallback to in-memory server for dev
        // Allow fallback if explicitly enabled (MONGO_MEMORY=1) OR if no MONGODB_URI provided
        const allowMemory = (process.env.MONGO_MEMORY === '1') || (!process.env.MONGODB_URI)
        if (!allowMemory) throw err
        try {
          const mod = await import('mongodb-memory-server')
          const { MongoMemoryServer } = mod
          memoryServer = await MongoMemoryServer.create()
          EFFECTIVE_URI = memoryServer.getUri('file_uploader')
          console.warn('[MongoDB] Falling back to in-memory server at', EFFECTIVE_URI)
          const m2 = await mongoose.connect(EFFECTIVE_URI, { maxPoolSize: 10, autoIndex: true })
          return m2
        } catch (e) {
          console.error('[MongoDB] In-memory fallback failed:', e?.message || e)
          throw err
        }
      }
    })()
  }
  cached.conn = await cached.promise
  return cached.conn
}

export async function disconnectDB() {
  if (cached.conn) {
    await mongoose.disconnect()
    cached.conn = null
    cached.promise = null
  }
}

export function getMongoUri() {
  return EFFECTIVE_URI
}

export function getDbStatus() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting']
  const state = states[mongoose.connection.readyState] || String(mongoose.connection.readyState)
  return {
    state,
    uri: EFFECTIVE_URI,
    memory: Boolean(memoryServer)
  }
}

// Basic event logs (can be silenced if noisy)
mongoose.connection.on('connected', () => {
  console.log(`[MongoDB] Connected: ${EFFECTIVE_URI}`)
})
mongoose.connection.on('error', (err) => {
  console.error('[MongoDB] Connection error:', err)
})
mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Disconnected')
})

export { mongoose }
export default connectDB
