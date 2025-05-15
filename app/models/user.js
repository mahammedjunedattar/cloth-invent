// app/models/user.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    unique: true,
    required: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email']
  },
  password: {
    type: String,
    select: false
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: ['OWNER', 'MANAGER', 'STAFF'],
    default: 'STAFF'
  },
  emailVerified: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.models.User || mongoose.model('User', userSchema);