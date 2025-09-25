import { mongoose } from '../../config/db.js'

const ExtractedSchema = new mongoose.Schema(
  {
    firstName: { type: String },
    lastName: { type: String },
    email: { type: String },
    phone: { type: String },
    address: { type: String }
  },
  { _id: false }
)

const CvSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    extracted: { type: ExtractedSchema, default: {} },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { collection: 'cvs' }
)

const Cv = mongoose.models.Cv || mongoose.model('Cv', CvSchema)
export default Cv
