const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email format']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  firstName: String,
  lastName: String,
  phone: String,
  dateOfBirth: Date,
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer-not']
  },
  avatar: {
    url: String,
    publicId: String
  },
  role: {
    type: String,
    enum: ['user', 'dentist', 'admin', 'clinic_manager', 'content_admin', 'live_chat_agent'],
    default: 'user'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  verificationExpires: Date,
  // One-Time-Password email verification (used by the registration flow)
  otpHash: { type: String, select: false },
  otpExpires: Date,
  otpAttempts: { type: Number, default: 0 },
  passwordResetToken: String,
  passwordResetExpires: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  lastLogin: Date,
  medicalHistory: {
    conditions: [String],
    allergies: [String],
    medications: [String],
    notes: String
  },
  preferences: {
    emailNotifications: { type: Boolean, default: true },
    smsNotifications: { type: Boolean, default: false },
    newsletter: { type: Boolean, default: false }
  },
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

userSchema.virtual('fullName').get(function() {
  return [this.firstName, this.lastName].filter(Boolean).join(' ').trim();
});
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateVerificationToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.verificationToken = crypto.createHash('sha256').update(token).digest('hex');
  this.verificationExpires = Date.now() + 24 * 60 * 60 * 1000;
  return token;
};

userSchema.methods.generatePasswordResetToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto.createHash('sha256').update(token).digest('hex');
  this.passwordResetExpires = Date.now() + 60 * 60 * 1000;
  return token;
};

userSchema.methods.generateOtp = function() {
  const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
  this.otpHash = crypto.createHash('sha256').update(code).digest('hex');
  const minutes = parseInt(process.env.OTP_EXPIRE_MINUTES) || 10;
  this.otpExpires = Date.now() + minutes * 60 * 1000;
  this.otpAttempts = 0;
  return code;
};

userSchema.methods.verifyOtp = function(code) {
  if (!this.otpHash || !this.otpExpires) return { ok: false, reason: 'No verification code pending. Please request a new one.' };
  if (this.otpExpires < Date.now()) return { ok: false, reason: 'Code expired. Please request a new one.' };
  const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS) || 5;
  if (this.otpAttempts >= maxAttempts) return { ok: false, reason: 'Too many incorrect attempts. Please request a new code.' };
  const hash = crypto.createHash('sha256').update(String(code)).digest('hex');
  if (hash !== this.otpHash) {
    this.otpAttempts += 1;
    return { ok: false, reason: 'Incorrect code.' };
  }
  return { ok: true };
};

userSchema.methods.incLoginAttempts = function() {
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }
  const updates = { $inc: { loginAttempts: 1 } };
  const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
  const lockTime = parseInt(process.env.LOCK_TIME) || 15 * 60 * 1000;
  if (this.loginAttempts + 1 >= maxAttempts && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + lockTime };
  }
  return this.updateOne(updates);
};

userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $set: { loginAttempts: 0, lastLogin: Date.now() },
    $unset: { lockUntil: 1 }
  });
};

userSchema.methods.isLocked = function() {
  return this.lockUntil && this.lockUntil > Date.now();
};

userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.verificationToken;
  delete obj.passwordResetToken;
  delete obj.otpHash;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
