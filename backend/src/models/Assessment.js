const mongoose = require('mongoose');

const assessmentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  patientName: String,
  age: Number,
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer-not']
  },
  medicalConditions: String,
  symptoms: {
    difficultyBreathing: Boolean,
    severeBleed: Boolean,
    facialSwelling: Boolean,
    fever: Boolean,
    severePain: Boolean,
    trauma: Boolean,
    swelling: Boolean,
    throbbingPain: Boolean,
    coldSensitivity: Boolean,
    painOnBiting: Boolean,
    bleedingGums: Boolean,
    swollenGums: Boolean,
    jawPain: Boolean,
    badBreath: Boolean,
    mildPain: Boolean,
    looseTooth: Boolean,
    mouthUlcers: Boolean,
    tonguePain: Boolean,
    dryMouth: Boolean,
    whitePatch: Boolean,
    redPatch: Boolean,
    oralHerpes: Boolean,
    candidiasis: Boolean,
    halitosis: Boolean,
    malocclusion: Boolean,
    bruxism: Boolean,
    orthodonticConcerns: Boolean
  },
  selectedConditions: [String],
  duration: String,
  severity: String,
  triggers: [String],
  previousTreatment: String,
  medications: [String],
  result: {
    level: {
      type: String,
      enum: ['emergency', 'severe', 'moderate', 'mild'],
      required: true
    },
    levelLabel: String,
    condition: String,
    details: String,
    action: String,
    homeCare: [String],
    color: String,
    referralRequired: Boolean,
    urgencyDays: Number
  },
  notes: String,
  status: {
    type: String,
    enum: ['completed', 'in_progress', 'archived'],
    default: 'completed'
  },
  sessionId: String,
  ipAddress: String,
  userAgent: String,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(+new Date() + 90 * 24 * 60 * 60 * 1000)
  }
}, { timestamps: true });

assessmentSchema.index({ user: 1, createdAt: -1 });
assessmentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Assessment', assessmentSchema);
