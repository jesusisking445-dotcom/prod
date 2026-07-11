const express = require('express');
const User = require('../models/User');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const { protect } = require('../middleware/auth');

const router = express.Router();

router.get('/profile', protect, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    user: req.user.toJSON()
  });
}));

router.patch('/profile', protect, asyncHandler(async (req, res) => {
  const { firstName, lastName, phone, dateOfBirth, gender, medicalHistory, whatsappNumber } = req.body;

  const updateData = {};
  if (firstName) updateData.firstName = firstName;
  if (lastName) updateData.lastName = lastName;
  if (phone) updateData.phone = phone;
  if (dateOfBirth) updateData.dateOfBirth = dateOfBirth;
  if (gender) updateData.gender = gender;
  if (medicalHistory) updateData.medicalHistory = medicalHistory;
  if (whatsappNumber !== undefined) updateData.whatsappNumber = whatsappNumber;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    updateData,
    { new: true, runValidators: true }
  );

  res.json({
    success: true,
    user: user.toJSON()
  });
}));

router.patch('/password', protect, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new AppError('Current and new password required', 400);
  }

  const user = await User.findById(req.user._id).select('+password');
  const isValid = await user.comparePassword(currentPassword);

  if (!isValid) {
    throw new AppError('Current password is incorrect', 401);
  }

  user.password = newPassword;
  await user.save();

  res.json({
    success: true,
    message: 'Password updated successfully'
  });
}));

router.patch('/preferences', protect, asyncHandler(async (req, res) => {
  const { emailNotifications, smsNotifications, newsletter } = req.body;

  const preferences = {};
  if (emailNotifications !== undefined) preferences.emailNotifications = emailNotifications;
  if (smsNotifications !== undefined) preferences.smsNotifications = smsNotifications;
  if (newsletter !== undefined) preferences.newsletter = newsletter;

  const user = await User.findByIdAndUpdate(
    req.user._id,
    { preferences: { ...req.user.preferences, ...preferences } },
    { new: true }
  );

  res.json({
    success: true,
    user: user.toJSON()
  });
}));

router.delete('/account', protect, asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { isActive: false });

  res.json({
    success: true,
    message: 'Account deactivated successfully'
  });
}));

module.exports = router;
