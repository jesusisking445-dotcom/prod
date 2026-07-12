/**
 * Seeds the database with demo data so the site is immediately testable.
 * Run with: npm run seed
 * (requires MONGODB_URI to be set in backend/.env)
 */
const mongoose = require('mongoose');
const dotenv   = require('dotenv');
const path     = require('path');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const User   = require('../models/User');
const Clinic = require('../models/Clinic');
const logger = require('../utils/logger');

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB');

    // NOTE: This used to call User.deleteMany({}) / Clinic.deleteMany({})
    // here, which wiped every real registered user on every single run.
    // upsertUser() below only creates a demo account if it doesn't
    // already exist — it never touches other users, so this script is
    // now safe to run again at any time (e.g. from the Render Shell tab).
    async function upsertUser(data) {
      const existing = await User.findOne({ email: data.email });
      if (existing) {
        logger.info(`↷ ${data.email} already exists — skipped`);
        return existing;
      }
      const created = await User.create(data);
      logger.info(`✅ ${data.email} created`);
      return created;
    }

    // ── 1. SUPER ADMIN ──────────────────────────────────────────────────────
    const adminUser = await upsertUser({
      email:      'admin@homodenthealth.ng',
      password:   'Admin@123456',
      firstName:  'Quadri Ahmmed ',
      lastName:   'Olalekan',
      role:       'admin',
      isVerified: true,
      isActive:   true
    });

    // ── 2. CONTENT ADMIN (blog posts + videos + live chat replies) ──────────
    const contentAdminUser = await upsertUser({
      email:      'content@homodenthealth.ng',
      password:   'Content@123456',
      firstName:  'Adeshina ',
      lastName:   'Oluwatobi',
      role:       'content_admin',
      isVerified: true,
      isActive:   true
    });

    // ── 3. LIVE CHAT AGENT ─────────────────────────────────────────────────
    const liveChatAgentUser = await upsertUser({
      email:      'livechat@homodenthealth.ng',
      password:   'LiveChat@123456',
      firstName:  'Amaka',
      lastName:   'Nwosu',
      role:       'live_chat_agent',
      isVerified: true,
      isActive:   true
    });

    // ── 4. DENTIST ──────────────────────────────────────────────────────────
    const dentistUser = await upsertUser({
      email:      'dentist@homodenthealth.ng',
      password:   'Dentist@123456',
      firstName:  'Dr. John',
      lastName:   'Okafor',
      role:       'dentist',
      isVerified: true,
      isActive:   true
    });

    // ── 5. CLINIC MANAGER ───────────────────────────────────────────────────
    const clinicManagerUser = await upsertUser({
      email:      'clinicadmin@homodenthealth.ng',
      password:   'ClinicAdmin@123456',
      firstName:  'Isaac',
      lastName:   'Abigeal',
      role:       'clinic_manager',
      isVerified: true,
      isActive:   true
    });

    // ── 6. PATIENT ──────────────────────────────────────────────────────────
    const patientUser = await upsertUser({
      email:      'patient@homodenthealth.ng',
      password:   'Patient@123456',
      firstName:  'Ajose',
      lastName:   'Ayoade',
      role:       'user',
      phone:      '+2348012345000',
      isVerified: true,
      isActive:   true
    });

    // ── CLINICS ─────────────────────────────────────────────────────────────
    const standardServices = [
      {
        name:        'General Check-up',
        category:    'preventive',
        description: 'Routine dental examination',
        price:       5000,
        duration:    30
      },
      {
        name:        'Professional Cleaning',
        category:    'preventive',
        description: 'Teeth cleaning and scaling',
        price:       8000,
        duration:    45
      }
    ];

    const clinicDefs = [
      // ── Ijebu Ode ─────────────────────────────────────────────────────────
      {
        name: 'Quams Dental Clinic',
        description: 'Full-service general dentistry in the heart of Ijebu Ode.',
        location: {
          address:     'No 9, Bonojo Road, opposite Oluworo Mosque',
          city:        'Ijebu Ode',
          state:       'Ogun',
          country:     'Nigeria',
          coordinates: { type: 'Point', coordinates: [3.9240, 6.8230] }
        },
        contact:           { phone: '+2348117294983', email: 'quams@homodenthealth.ng' },
        hours:             dailyHours('08:00', '15:00', { saturday: null, sunday: null }),
        specialties:       ['general'],
        emergencyAvailable: false,
        ratingsSeed:       4.8,
        manager:           clinicManagerUser._id,
        staff:             [dentistUser._id]
      },
      {
        name: 'State Dental Clinic',
        description: 'Government-run dental clinic serving Ijebu Ode and environs.',
        location: {
          address:     'State Dental Clinic Road',
          city:        'Ijebu Ode',
          state:       'Ogun',
          country:     'Nigeria',
          coordinates: { type: 'Point', coordinates: [3.9150, 6.8192] }
        },
        contact:           { phone: '+2347062264014', email: 'state@homodenthealth.ng' },
        hours:             dailyHours('08:00', '16:00', { saturday: null, sunday: null }),
        specialties:       ['general'],
        emergencyAvailable: true,
        ratingsSeed:       4.6
      },
      {
        name: 'Hope Dental Clinic',
        description: '24-hour oral surgery and emergency dental care in Ijebu Ode.',
        location: {
          address:     'Imepe, opposite FCMB',
          city:        'Ijebu Ode',
          state:       'Ogun',
          country:     'Nigeria',
          coordinates: { type: 'Point', coordinates: [3.9173, 6.8213] }
        },
        contact:           { phone: '+2349035872841', email: 'hope@homodenthealth.ng' },
        hours:             dailyHours('00:00', '23:59'),
        specialties:       ['oral_surgery'],
        emergencyAvailable: true,
        ratingsSeed:       4.9
      },
    ];

    const clinics = [];
    for (const def of clinicDefs) {
      const existingClinic = await Clinic.findOne({ name: def.name });
      if (existingClinic) {
        logger.info(`↷ ${def.name} already exists — skipped`);
        clinics.push(existingClinic);
        continue;
      }
      const { ratingsSeed, ...rest } = def;
      const clinic = await Clinic.create({
        ...rest,
        services: standardServices,
        status:   'active',
        ratings: {
          averageRating: ratingsSeed,
          totalRatings:  Math.floor(Math.random() * 40) + 10
        },
        accreditation: { verified: true, verifiedAt: new Date() }
      });
      clinics.push(clinic);
      logger.info(`✅ ${clinic.name} (${clinic.location.city}) created`);
    }

    // Link clinic manager and dentist to Quams (first clinic)
    clinicManagerUser.clinic = clinics[0]._id;
    await clinicManagerUser.save();
    dentistUser.clinic = clinics[0]._id;
    await dentistUser.save();

    // ── Summary ─────────────────────────────────────────────────────────────
    logger.info('\n✅ Database seeded successfully\n');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('TEST ACCOUNTS (all pre-verified, ready to log in)');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('  Super Admin:    admin@homodenthealth.ng     / Admin@123456');
    logger.info('  Content Admin:  content@homodenthealth.ng   / Content@123456');
    logger.info('  Live Chat Agent: livechat@homodenthealth.ng  / LiveChat@123456');
    logger.info('  Dentist:        dentist@homodenthealth.ng   / Dentist@123456');
    logger.info('  Clinic Manager: clinicadmin@homodenthealth.ng / ClinicAdmin@123456');
    logger.info('  Patient:        patient@homodenthealth.ng   / Patient@123456');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info(`CLINICS CREATED: ${clinics.length}`);
    logger.info('  Ijebu Ode: Quams Dental, State Dental, Hope Dental');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    process.exit(0);
  } catch (error) {
    logger.error(`Seeding failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
};

function dailyHours(open, close, overrides = {}) {
  const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  const hours = {};
  days.forEach(day => {
    if (Object.prototype.hasOwnProperty.call(overrides, day) && overrides[day] === null) {
      hours[day] = { open: null, close: null };
    } else {
      hours[day] = { open, close };
    }
  });
  return hours;
}

seedDatabase();