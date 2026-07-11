const express = require('express');
const Appointment = require('../models/Appointment');
const Clinic = require('../models/Clinic');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const { protect, authorize, optional } = require('../middleware/auth');
const emailService = require('../utils/emailService');
const smsService = require('../services/smsService');
const rateLimiter = require('../middleware/rateLimiter');

const router = express.Router();

function normalizeTimeSlot(timeSlot, durationMinutes = 30) {
  if (!timeSlot) return null;
  if (typeof timeSlot === 'object' && timeSlot.startTime) {
    return { startTime: timeSlot.startTime, endTime: timeSlot.endTime || timeSlot.startTime };
  }
  const startTime = String(timeSlot);
  const [h, m] = startTime.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return { startTime, endTime: startTime };
  const totalMinutes = h * 60 + m + durationMinutes;
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  return { startTime, endTime };
}

// ── BOOK APPOINTMENT ──────────────────────────────────────
router.post('/', optional, rateLimiter.appointment, asyncHandler(async (req, res) => {
  const {
    clinicId, dentistId, referralId,
    appointmentDate, timeSlot, appointmentTime,
    serviceType, notes,
    patientName, patientPhone, patientEmail,
    remindEmail, remindSms
  } = req.body;

  const rawTimeSlot = timeSlot || appointmentTime;
  if (!clinicId || !appointmentDate || !rawTimeSlot) throw new AppError('clinicId, appointmentDate and a time slot are required', 400);
  if (!req.user && (!patientName || !patientPhone || !patientEmail)) throw new AppError('Name, phone and email are required when booking without an account', 400);

  const clinic = await Clinic.findById(clinicId).catch(() => null);
  if (!clinic || clinic.status !== 'active') throw new AppError('Selected clinic was not found. Please choose a clinic from the list again.', 404);

  const appointment = new Appointment({
    user: req.user ? req.user._id : undefined,
    clinic: clinicId,
    dentist: dentistId || undefined,
    referral: referralId || undefined,
    appointmentDate: new Date(appointmentDate),
    timeSlot: normalizeTimeSlot(rawTimeSlot),
    serviceType: serviceType || 'checkup',
    notes,
    contactName: patientName || (req.user && req.user.fullName),
    contactPhone: patientPhone || (req.user && req.user.phone),
    contactEmail: patientEmail || (req.user && req.user.email),
    reminders: { email: remindEmail !== false, sms: !!remindSms },
    status: 'pending'
  });

  await appointment.save();

  try { await emailService.sendAppointmentConfirmation(appointment, clinic, req.user || { email: patientEmail, firstName: patientName }); } catch (_) {}

  res.status(201).json({ success: true, message: 'Appointment booked successfully', appointment_id: appointment._id, appointment });
}));

// ── TAKEN SLOTS ─────────────────────────────────────────
router.get('/taken-slots', asyncHandler(async (req, res) => {
  const { clinicId, date } = req.query;
  if (!clinicId || !date) throw new AppError('clinicId and date are required', 400);
  const dayStart = new Date(date + 'T00:00:00');
  const dayEnd = new Date(date + 'T23:59:59');
  const appointments = await Appointment.find({ clinic: clinicId, appointmentDate: { $gte: dayStart, $lte: dayEnd }, status: { $in: ['pending', 'confirmed', 'in_progress'] } }).select('timeSlot');
  res.json({ success: true, taken: appointments.map(a => a.timeSlot?.startTime).filter(Boolean) });
}));

// ── MY APPOINTMENTS ──────────────────────────────────────
router.get('/my-appointments', protect, asyncHandler(async (req, res) => {
  const appointments = await Appointment.find({ user: req.user._id })
    .populate('clinic', 'name location contact')
    .populate('dentist', 'firstName lastName')
    .sort({ appointmentDate: -1 });
  res.json({ success: true, appointments });
}));

// ── DENTIST QUEUE ──────────────────────────────────────
router.get('/dentist/queue', protect, authorize('dentist', 'admin'), asyncHandler(async (req, res) => {
  const filter = req.user.role === 'dentist' ? { dentist: req.user._id } : {};
  const appointments = await Appointment.find(filter).populate('clinic', 'name location').populate('user', 'firstName lastName email phone').sort({ appointmentDate: 1 });
  res.json({ success: true, appointments });
}));

// ── CLINIC QUEUE ──────────────────────────────────────
router.get('/clinic/queue', protect, authorize('clinic_manager', 'admin'), asyncHandler(async (req, res) => {
  const filter = req.user.role === 'clinic_manager' && req.user.clinic ? { clinic: req.user.clinic } : {};
  const appointments = await Appointment.find(filter)
    .populate('clinic', 'name location')
    .populate('dentist', 'firstName lastName')
    .populate('user', 'firstName lastName email phone')
    .sort({ appointmentDate: 1 });
  res.json({ success: true, appointments });
}));

// ── ASSIGN DENTIST (clinic manager) — Feature 8 ──────────
router.patch('/:id/assign-dentist', protect, authorize('clinic_manager', 'admin'), asyncHandler(async (req, res) => {
  const { dentistId } = req.body;
  if (!dentistId) throw new AppError('dentistId is required', 400);

  const appointment = await Appointment.findByIdAndUpdate(
    req.params.id,
    { dentist: dentistId },
    { new: true }
  ).populate('dentist', 'firstName lastName');

  if (!appointment) throw new AppError('Appointment not found', 404);
  res.json({ success: true, appointment });
}));

// ── GET SINGLE APPOINTMENT ──────────────────────────────
router.get('/:id', protect, asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id).populate('clinic').populate('dentist', 'firstName lastName').populate('user', 'firstName lastName email phone');
  if (!appointment) throw new AppError('Appointment not found', 404);
  const isOwner = appointment.user && appointment.user._id.toString() === req.user._id.toString();
  const isAssignedDentist = appointment.dentist && appointment.dentist._id.toString() === req.user._id.toString();
  const isStaff = ['admin', 'clinic_manager'].includes(req.user.role);
  if (!isOwner && !isAssignedDentist && !isStaff) throw new AppError('Unauthorized', 403);
  res.json({ success: true, appointment });
}));

// ── CANCEL ─────────────────────────────────────────────
router.patch('/:id/cancel', protect, asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const appointment = await Appointment.findById(req.params.id).populate('clinic');
  if (!appointment) throw new AppError('Appointment not found', 404);
  const isOwner = appointment.user && appointment.user.toString() === req.user._id.toString();
  if (!isOwner && !['admin', 'clinic_manager'].includes(req.user.role)) throw new AppError('Unauthorized', 403);
  if (!['pending', 'confirmed'].includes(appointment.status)) throw new AppError('Cannot cancel an appointment in its current status', 400);
  appointment.status = 'cancelled';
  appointment.cancellationReason = reason;
  appointment.cancelledBy = req.user.role === 'user' ? 'user' : 'clinic';
  appointment.cancelledAt = new Date();
  await appointment.save();
  res.json({ success: true, message: 'Appointment cancelled successfully', appointment });
}));

// ── STATUS UPDATE with email/SMS notification — Feature 14 ──
router.patch('/:id/status', protect, authorize('dentist', 'clinic_manager', 'admin'), asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ['confirmed', 'in_progress', 'completed', 'no_show'];
  if (!allowed.includes(status)) throw new AppError(`Status must be one of: ${allowed.join(', ')}`, 400);

  const appointment = await Appointment.findByIdAndUpdate(req.params.id, { status }, { new: true })
    .populate('clinic')
    .populate('user');

  if (!appointment) throw new AppError('Appointment not found', 404);

  // Feature 14: send notification for meaningful status transitions
  if (['confirmed', 'completed', 'cancelled', 'no_show'].includes(status)) {
    try {
      await emailService.sendAppointmentStatusEmail(appointment, appointment.clinic, appointment.user, status);
    } catch (e) { /* non-blocking */ }
    if (appointment.reminders?.sms) {
      try {
        await smsService.sendAppointmentStatusSms(appointment, appointment.clinic, status);
      } catch (e) { /* non-blocking */ }
    }
  }

  res.json({ success: true, appointment });
}));

// ── CONSULTATION NOTES ─────────────────────────────────
router.patch('/:id/notes', protect, authorize('dentist', 'admin'), asyncHandler(async (req, res) => {
  const { consultationNotes, followUpRequired, followUpDate, prescriptions } = req.body;
  const appointment = await Appointment.findByIdAndUpdate(req.params.id, {
    ...(consultationNotes !== undefined && { consultationNotes }),
    ...(followUpRequired !== undefined && { followUpRequired }),
    ...(followUpDate !== undefined && { followUpDate }),
    ...(prescriptions !== undefined && { prescriptions })
  }, { new: true });
  if (!appointment) throw new AppError('Appointment not found', 404);
  res.json({ success: true, appointment });
}));

// ── RATE — Feature 1 backend already existed ──────────
router.patch('/:id/rate', protect, asyncHandler(async (req, res) => {
  const { score, review } = req.body;
  if (!score || score < 1 || score > 5) throw new AppError('Rating must be between 1 and 5', 400);
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw new AppError('Appointment not found', 404);
  if (!appointment.user || appointment.user.toString() !== req.user._id.toString()) throw new AppError('Unauthorized', 403);
  appointment.rating = { score, review, ratedAt: new Date() };
  await appointment.save();
  res.json({ success: true, appointment });
}));

module.exports = router;
