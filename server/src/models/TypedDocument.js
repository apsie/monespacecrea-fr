import mongoose from 'mongoose'

const TypedDocumentSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    uploadDate: { type: Date, default: Date.now },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { collection: 'typed_documents', timestamps: false }
)

TypedDocumentSchema.index({ user: 1, type: 1, uploadDate: -1 })

const TypedDocument = mongoose.models.TypedDocument || mongoose.model('TypedDocument', TypedDocumentSchema)
export default TypedDocument
