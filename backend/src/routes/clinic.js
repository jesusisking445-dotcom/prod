const express = require('express');
const Clinic = require('../models/Clinic');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const { optional, protect, authorize } = require('../middleware/auth');

const router = express.Router();

const LIST_FIELDS = 'name image location specialties hours ratings.averageRating contact.phone contact.email emergencyAvailable status';

router.get('/', asyncHandler(async (req, res) => {
  const { city, specialty, page = 1, limit = 20, search } = req.query;

  const query = { status: 'active' };

  if (city) query['location.city'] = { $regex: city, $options: 'i' };
  if (specialty) query.specialties = specialty;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { 'location.address': { $regex: search, $options: 'i' } },
      { 'location.city': { $regex: search, $options: 'i' } }
    ];
  }

  const clinics = await Clinic.find(query)
    .select(LIST_FIELDS)
    .limit(limit * 1)
    .skip((page - 1) * limit)
    .sort({ 'ratings.averageRating': -1 });

  const total = await Clinic.countDocuments(query);

  res.json({
    success: true,
    clinics,
    pagination: { total, pages: Math.ceil(total / limit), currentPage: page }
  });
}));

router.get('/nearby', optional, asyncHandler(async (req, res) => {
  const { longitude, latitude, maxDistance = 10000 } = req.query;

  if (!longitude || !latitude) {
    throw new AppError('Coordinates required', 400);
  }

  const clinics = await Clinic.find({
    'location.coordinates': {
      $near: {
        $geometry: { type: 'Point', coordinates: [parseFloat(longitude), parseFloat(latitude)] },
        $maxDistance: Number(maxDistance)
      }
    },
    status: 'active'
  }).select(LIST_FIELDS);

  res.json({ success: true, clinics });
}));

// ── CLINIC ADMIN SELF-SERVICE ─────────────────────────────
// Must be declared before "/:id" so "mine" isn't parsed as an ObjectId.
router.get('/mine', protect, authorize('clinic_manager', 'admin'), asyncHandler(async (req, res) => {
  if (!req.user.clinic) {
    throw new AppError('No clinic is linked to this account yet. Ask a super admin to assign one.', 404);
  }
  const clinic = await Clinic.findById(req.user.clinic).populate('staff', 'firstName lastName role');
  if (!clinic) {
    throw new AppError('Clinic not found', 404);
  }
  res.json({ success: true, clinic });
}));

router.patch('/mine', protect, authorize('clinic_manager', 'admin'), asyncHandler(async (req, res) => {
  if (!req.user.clinic) {
    throw new AppError('No clinic is linked to this account yet. Ask a super admin to assign one.', 404);
  }
  // Whitelist editable fields so a clinic manager can only change their own clinic's
  // public-facing details, never status/manager/registrationNumber.
  const { description, image, contact, hours, services, specialties, facilities, accreditation } = req.body;
  const update = {};
  if (description !== undefined) update.description = description;
  if (image !== undefined) update.image = image;
  if (contact !== undefined) update.contact = contact;
  if (hours !== undefined) update.hours = hours;
  if (services !== undefined) update.services = services;
  if (specialties !== undefined) update.specialties = specialties;
  if (facilities !== undefined) update.facilities = facilities;
  if (accreditation !== undefined) update.accreditation = accreditation;

  const clinic = await Clinic.findByIdAndUpdate(req.user.clinic, update, { new: true, runValidators: true });
  if (!clinic) {
    throw new AppError('Clinic not found', 404);
  }
  res.json({ success: true, clinic });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const clinic = await Clinic.findById(req.params.id)
    .populate('staff', 'firstName lastName role')
    .populate('manager', 'firstName lastName');

  if (!clinic || clinic.status !== 'active') {
    throw new AppError('Clinic not found', 404);
  }

  res.json({ success: true, clinic });
}));

router.get('/:id/availability', asyncHandler(async (req, res) => {
  const clinic = await Clinic.findById(req.params.id).select('availability hours');

  if (!clinic) {
    throw new AppError('Clinic not found', 404);
  }

  res.json({ success: true, availability: clinic.availability, hours: clinic.hours });
}));

module.exports = router;
