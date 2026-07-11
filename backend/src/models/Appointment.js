const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  clinic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clinic',
    required: true
  },
  dentist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  appointmentDate: {
    type: Date,
    required: true,
    index: true
  },
  timeSlot: {
    startTime: String,
    endTime: String
  },
  duration: {
    type: Number,
    default: 30
  },
  serviceType: {
    type: String,
    enum: ['screening', 'cleaning', 'checkup', 'treatment', 'consultation', 'emergency'],
    default: 'checkup'
  },
  // Contact details for this specific booking (may differ from the account holder)
  contactName: String,
  contactPhone: String,
  contactEmail: String,
  reminders: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false }
  },
  referral: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assessment'
  },
  chief_complaint: String,
  notes: String,
  attachments: [{
    filename: String,
    url: String,
    type: String
  }],
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
    default: 'pending',
    index: true
  },
  cancellationReason: String,
  cancelledBy: {
    type: String,
    enum: ['user', 'clinic', 'system']
  },
  cancelledAt: Date,
  reminderSent: {
    type: Boolean,
    default: false
  },
  reminderSentAt: Date,
  assessment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Assessment'
  },
  rating: {
    score: {
      type: Number,
      min: 1,
      max: 5
    },
    review: String,
    ratedAt: Date
  },
  consultationNotes: String,
  prescriptions: [{
    medication: String,
    dosage: String,
    frequency: String,
    duration: String,
    notes: String
  }],
  followUpRequired: Boolean,
  followUpDate: Date,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

appointmentSchema.index({ user: 1, appointmentDate: 1 });
appointmentSchema.index({ clinic: 1, appointmentDate: 1 });
appointmentSchema.index({ appointmentDate: 1, status: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
