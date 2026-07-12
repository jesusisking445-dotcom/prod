const express = require('express');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const tokenService = require('../utils/tokenService');
const emailService = require('../utils/emailService');
const rateLimiter = require('../middleware/rateLimiter');
const { protect } = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

// Set SHOW_DEV_OTP=true in your environment to have the OTP code echoed
// back in the register/resend-otp API response, so the frontend's
// dev-otp-hint box can display it — useful while testing without SMTP
// fully working yet. Turn this OFF (remove the var or set to false)
// once email delivery is confirmed, since leaving it on lets anyone who
// can call these endpoints see the code without checking the inbox —
// that defeats the point of email verification.
const showDevOtp = () => process.env.SHOW_DEV_OTP === 'true';

// ── REGISTER ──────────────────────────────────────────────
// Creates the account, sends a 6-digit OTP by email, and returns
// short-lived tokens so the frontend can immediately call /verify-otp.
router.post('/register', rateLimiter.auth, asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName, fullName, phone, gender, dateOfBirth } = req.body;

  if (!email || !password) {
    throw new AppError('Email and password required', 400);
  }
  if (password.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new AppError('Email already registered', 409);
  }

  // Accept either firstName/lastName or a single fullName field from the frontend
  let first = firstName, last = lastName;
  if (!first && fullName) {
    const parts = String(fullName).trim().split(/\s+/);
    first = parts.shift() || '';
    last = parts.join(' ');
  }

  const user = new User({
    email: email.toLowerCase(),
    password,
    firstName: first,
    lastName: last,
    phone,
    gender,
    dateOfBirth,
    role: 'user' // role is always server-assigned, never trusted from the client
  });

  const otp = user.generateOtp();
  await user.save();

  try {
    await emailService.sendOtpEmail(user, otp);
  } catch (error) {
    logger.error('Failed to send OTP email', { userId: user._id, error: error.message });
  }

  const tokens = tokenService.generateTokens(user._id);

  res.status(201).json({
    success: true,
    message: 'Registration successful. Check your email for a verification code.',
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: user.toJSON(),
    // Only included when SHOW_DEV_OTP=true — see note near isProd/showDevOtp above.
    devOtp: showDevOtp() ? otp : undefined
  });
}));

// ── VERIFY OTP ────────────────────────────────────────────
router.post('/verify-otp', rateLimiter.auth, asyncHandler(async (req, res) => {
  const { userId, otpCode } = req.body;

  if (!userId || !otpCode) {
    throw new AppError('userId and otpCode are required', 400);
  }

  const user = await User.findById(userId).select('+otpHash');
  if (!user) {
    throw new AppError('Account not found', 404);
  }
  if (user.isVerified) {
    return res.json({ success: true, message: 'Account already verified.' });
  }

  const result = user.verifyOtp(otpCode);
  if (!result.ok) {
    await user.save();
    throw new AppError(result.reason, 400);
  }

  user.isVerified = true;
  user.otpHash = undefined;
  user.otpExpires = undefined;
  user.otpAttempts = 0;
  await user.save();

  const tokens = tokenService.generateTokens(user._id);

  res.json({
    success: true,
    message: 'Email verified successfully.',
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: user.toJSON()
  });
}));

// ── RESEND OTP ────────────────────────────────────────────
router.post('/resend-otp', rateLimiter.auth, asyncHandler(async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    throw new AppError('userId is required', 400);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('Account not found', 404);
  }
  if (user.isVerified) {
    return res.json({ success: true, message: 'Account already verified.' });
  }

  const otp = user.generateOtp();
  await user.save();

  try {
    await emailService.sendOtpEmail(user, otp);
  } catch (error) {
    logger.error('Failed to resend OTP email', { userId: user._id, error: error.message });
  }

  res.json({
    success: true,
    message: 'A new code has been sent.',
    devOtp: showDevOtp() ? otp : undefined
  });
}));

// ── LOGIN ─────────────────────────────────────────────────
router.post('/login', rateLimiter.auth, asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError('Email and password required', 400);
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user) {
    throw new AppError('Invalid credentials', 401);
  }

  if (user.isLocked()) {
    throw new AppError('Account temporarily locked due to too many failed attempts. Try again later.', 429);
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    await user.incLoginAttempts();
    throw new AppError('Invalid credentials', 401);
  }

  if (!user.isVerified) {
    const err = new AppError('Please verify your email first.', 403);
    err.userId = user._id;
    return res.status(403).json({
      success: false,
      error: 'Please verify your email first.',
      needsVerification: true,
      userId: user._id
    });
  }

  await user.resetLoginAttempts();
  const tokens = tokenService.generateTokens(user._id);

  res.json({
    success: true,
    message: 'Login successful',
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    user: user.toJSON()
  });
}));

// ── FORGOT / RESET PASSWORD ─────────────────────────────────
router.post('/forgot-password', rateLimiter.auth, asyncHandler(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new AppError('Email required', 400);
  }

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    // Don't reveal whether the email exists
    return res.json({
      success: true,
      message: 'If that email is registered, a reset link has been sent.'
    });
  }

  const resetToken = user.generatePasswordResetToken();
  await user.save({ validateBeforeSave: false });

  try {
    await emailService.sendPasswordResetEmail(user, resetToken);
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    throw new AppError('Failed to send reset email', 500);
  }

  res.json({
    success: true,
    message: 'If that email is registered, a reset link has been sent.'
  });
}));

router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, password, newPassword } = req.body;
  const finalPassword = newPassword || password;

  if (!token || !finalPassword) {
    throw new AppError('Token and password required', 400);
  }
  if (finalPassword.length < 8) {
    throw new AppError('Password must be at least 8 characters', 400);
  }

  const hashedToken = require('crypto')
    .createHash('sha256')
    .update(token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });

  if (!user) {
    throw new AppError('Invalid or expired token', 400);
  }

  user.password = finalPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  const tokens = tokenService.generateTokens(user._id);

  res.json({
    success: true,
    message: 'Password reset successful',
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken
  });
}));

// ── REFRESH TOKEN ─────────────────────────────────────────
router.post('/refresh-token', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AppError('Refresh token required', 400);
  }

  const decoded = tokenService.verifyToken(refreshToken, process.env.REFRESH_TOKEN_SECRET);
  if (!decoded) {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) {
    throw new AppError('User not found or inactive', 404);
  }

  const tokens = tokenService.generateTokens(user._id);

  res.json({
    success: true,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken
  });
}));

// ── CURRENT USER ───────────────────────────────────────────
router.get('/me', protect, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    user: req.user.toJSON()
  });
}));

module.exports = router;