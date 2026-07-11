const express = require('express');
const Assessment = require('../models/Assessment');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const { optional } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/', rateLimiter.assessment, optional, asyncHandler(async (req, res) => {
  const { patientName, age, gender, medicalConditions, symptoms, selectedConditions } = req.body;

  if (!selectedConditions || !selectedConditions.length) {
    throw new AppError('At least one symptom/condition required', 400);
  }

  const result = assessmentEngine(symptoms, selectedConditions);

  const assessment = new Assessment({
    user: req.user?.id,
    patientName,
    age,
    gender,
    medicalConditions,
    symptoms,
    selectedConditions,
    result,
    sessionId: req.sessionID,
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  });

  await assessment.save();

  res.status(201).json({
    success: true,
    assessment: {
      id: assessment._id,
      result: assessment.result,
      patientName: assessment.patientName
    }
  });
}));

router.get('/:id', optional, asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.id).select('-ipAddress -userAgent');

  if (!assessment) {
    throw new AppError('Assessment not found', 404);
  }

  if (assessment.user && req.user?.id !== assessment.user.toString()) {
    throw new AppError('Unauthorized', 403);
  }

  res.json({
    success: true,
    assessment
  });
}));

router.get('/user/history', optional, asyncHandler(async (req, res) => {
  if (!req.user) {
    throw new AppError('Authentication required', 401);
  }

  const assessments = await Assessment.find({ user: req.user.id })
    .select('_id patientName result createdAt selectedConditions')
    .sort({ createdAt: -1 })
    .limit(20);

  res.json({
    success: true,
    assessments,
    count: assessments.length
  });
}));

const assessmentEngine = (symptoms, selectedConditions) => {
  if (symptoms.difficultyBreathing || symptoms.severeBleed) {
    return {
      level: 'emergency',
      levelLabel: '🚨 Emergency',
      condition: 'Life-threatening Dental Emergency',
      details: 'Difficulty breathing or severe uncontrolled bleeding requires immediate emergency care.',
      action: 'Call emergency services (112) or go to the nearest hospital ER immediately.',
      homeCare: [],
      color: '#A51C30',
      urgencyDays: 0
    };
  }

  if (symptoms.facialSwelling && symptoms.fever && symptoms.severePain) {
    return {
      level: 'emergency',
      levelLabel: '🚨 Emergency',
      condition: 'Possible Dental Abscess with Systemic Spread',
      details: 'Combination of facial swelling, fever, and severe pain suggests a spreading infection that can be life-threatening.',
      action: 'Seek emergency dental or hospital care immediately. Do not wait.',
      homeCare: [],
      color: '#A51C30',
      urgencyDays: 0
    };
  }

  if (symptoms.trauma) {
    return {
      level: 'severe',
      levelLabel: '⚠️ Urgent',
      condition: 'Dental Trauma',
      details: 'Physical injury to teeth or jaw needs prompt professional assessment.',
      action: 'Visit a dentist or emergency dental clinic within the next few hours.',
      homeCare: ['Apply gentle pressure for bleeding', 'Rinse gently with clean water', 'Avoid hot/cold foods'],
      color: '#DC3545',
      urgencyDays: 0
    };
  }

  if (symptoms.swelling && symptoms.fever && symptoms.throbbingPain) {
    return {
      level: 'severe',
      levelLabel: '⚠️ Urgent',
      condition: 'Possible Dental Abscess',
      details: 'Throbbing pain with swelling and fever suggests a dental abscess — a bacterial infection.',
      action: 'See a dentist urgently today or tomorrow.',
      homeCare: ['Warm salt-water rinse every 2 hours', 'OTC pain reliever', 'Avoid very hot or cold food'],
      color: '#DC3545',
      urgencyDays: 1
    };
  }

  if (symptoms.coldSensitivity && symptoms.painOnBiting) {
    return {
      level: 'moderate',
      levelLabel: '🔶 Moderate',
      condition: 'Possible Dental Caries (Cavity)',
      details: 'Sensitivity to cold and pain on biting suggests cavity progression.',
      action: 'Schedule a dental appointment within 1–2 weeks.',
      homeCare: ['Use sensitivity toothpaste', 'Avoid very cold, hot, or sweet foods', 'Brush gently twice daily'],
      color: '#D97706',
      urgencyDays: 14
    };
  }

  if (symptoms.bleedingGums && symptoms.swollenGums) {
    return {
      level: 'moderate',
      levelLabel: '🔶 Moderate',
      condition: 'Possible Gingivitis / Early Periodontal Disease',
      details: 'Bleeding and swollen gums indicate inflammation of gum tissue.',
      action: 'Book a dental check-up and professional scaling within 1–2 weeks.',
      homeCare: ['Brush teeth gently twice daily', 'Floss once daily', 'Use antibacterial mouthwash'],
      color: '#D97706',
      urgencyDays: 14
    };
  }

  if (symptoms.badBreath) {
    return {
      level: 'mild',
      levelLabel: '✅ Mild',
      condition: 'Poor Oral Hygiene / Possible Minor Infection',
      details: 'Persistent bad breath can result from plaque buildup or minor infection.',
      action: 'Improve oral hygiene routine. Visit dentist if persisting beyond 2 weeks.',
      homeCare: ['Brush teeth and tongue twice daily', 'Floss daily', 'Drink more water'],
      color: '#2E9B6B',
      urgencyDays: 30
    };
  }

  return {
    level: 'mild',
    levelLabel: '✅ Routine',
    condition: 'Routine Dental Check-Up Recommended',
    details: 'No urgent dental concern detected. Regular dental visits prevent problems.',
    action: 'Schedule a routine dental check-up every 6 months.',
    homeCare: ['Brush twice daily with fluoride toothpaste', 'Floss once daily', 'Reduce sugary drinks and snacks'],
    color: '#2E9B6B',
    urgencyDays: 180
  };
};

module.exports = router;
