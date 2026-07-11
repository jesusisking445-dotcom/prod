const mongoose = require('mongoose');

const clinicSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    index: true
  },
  registrationNumber: {
    type: String,
    unique: true,
    sparse: true
  },
  description: String,
  image: {
    url: String,
    publicId: String
  },
  location: {
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      required: true,
      index: true
    },
    state: String,
    zipCode: String,
    country: {
      type: String,
      default: 'Nigeria'
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        required: true
      }
    }
  },
  contact: {
    phone: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true
    },
    website: String,
    whatsapp: String
  },
  hours: {
    monday: { open: String, close: String },
    tuesday: { open: String, close: String },
    wednesday: { open: String, close: String },
    thursday: { open: String, close: String },
    friday: { open: String, close: String },
    saturday: { open: String, close: String },
    sunday: { open: String, close: String },
    holidays: [{ date: Date, reason: String }]
  },
  services: [{
    name: String,
    category: {
      type: String,
      enum: ['preventive', 'restorative', 'cosmetic', 'orthodontic', 'surgical', 'pediatric'],
      required: true
    },
    description: String,
    price: Number,
    currency: { type: String, default: 'NGN' },
    duration: Number
  }],
  specialties: [{
    type: String,
    enum: ['general', 'endodontics', 'orthodontics', 'periodontics', 'prosthodontics', 'oral_surgery', 'pediatric_dentistry', 'cosmetic']
  }],
  staff: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  capacity: {
    totalChairs: Number,
    operatories: Number
  },
  accreditation: {
    certifications: [String],
    insuranceProviders: [String],
    verified: Boolean,
    verifiedAt: Date
  },
  facilities: {
    equipment: [String],
    services: [String],
    accessibility: [String]
  },
  ratings: {
    averageRating: {
      type: Number,
      min: 1,
      max: 5,
      default: 0
    },
    totalRatings: { type: Number, default: 0 },
    reviews: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      rating: Number,
      text: String,
      createdAt: Date
    }]
  },
  availability: {
    slots: [{
      date: Date,
      slots: [{ time: String, available: Boolean, dentist: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } }]
    }]
  },
  emergencyAvailable: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
    index: true
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

clinicSchema.index({ 'location.coordinates': '2dsphere' });
clinicSchema.index({ 'location.city': 1, status: 1 });

module.exports = mongoose.model('Clinic', clinicSchema);
