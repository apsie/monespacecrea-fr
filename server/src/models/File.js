import { mongoose } from '../../config/db.js'

const FileSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 0 },
    mimetype: { type: String, required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
)

const File = mongoose.models.File || mongoose.model('File', FileSchema)
export default File
