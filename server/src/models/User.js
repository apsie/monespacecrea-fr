import { mongoose } from '../../config/db.js'

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    username: { type: String, required: true, trim: true, lowercase: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    passwordHash: { type: String, required: true }
  },
  { timestamps: { createdAt: true, updatedAt: true } }
)

const User = mongoose.models.User || mongoose.model('User', UserSchema)
export default User
