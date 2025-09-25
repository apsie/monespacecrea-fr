import mongoose from 'mongoose'

const ExtractedDocumentSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    uploadDate: { type: Date, default: Date.now },
    content: { type: String, default: '' }
  },
  { collection: 'documents', timestamps: false }
)

const ExtractedDocument = mongoose.models.ExtractedDocument || mongoose.model('ExtractedDocument', ExtractedDocumentSchema)
export default ExtractedDocument
