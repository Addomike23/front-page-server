const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, required: true, unique: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['customer', 'restaurant', 'admin'], default: 'customer' },
  address: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    landmark: String
  },
  isActive: { type: Boolean, default: true },
  lastLogin: Date,
  deletedAt: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// NO password hashing here - done in controller
// NO comparePassword method here - done in controller

module.exports = mongoose.model('User', userSchema);