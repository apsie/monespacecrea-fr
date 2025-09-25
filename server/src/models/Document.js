import mongoose from 'mongoose'

const DocumentSchema = new mongoose.Schema(
  {
    // Business type such as "CNI", "Contrat d'engagement", etc.
    type: { type: String, required: true, index: true },
    // Category such as "Documents d'identité", "Livrables", etc.
    category: { type: String, required: true, index: true },
    // Saved filename on disk
    fileName: { type: String, required: true },
    // Relative URL path to serve the file (e.g., /uploads/<name>)
    filePath: { type: String, required: true },
    // MIME type
    fileType: { type: String, required: true },
    // Size in bytes
    fileSize: { type: Number, required: true },
    // Upload date
    uploadDate: { type: Date, default: Date.now },
    // Optional: owner (if multi-user)
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { collection: 'documents', timestamps: false }
)

// Useful compound index for status lookups per user/type
DocumentSchema.index({ user: 1, type: 1, uploadDate: -1 })

const Document = mongoose.models.Document || mongoose.model('Document', DocumentSchema)
export default Document
