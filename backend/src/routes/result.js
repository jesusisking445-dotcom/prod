const express = require('express');
const Assessment = require('../models/Assessment');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const { optional } = require('../middleware/auth');

const router = express.Router();

router.get('/:assessmentId', optional, asyncHandler(async (req, res) => {
  const assessment = await Assessment.findById(req.params.assessmentId)
    .select('result patientName age gender selectedConditions createdAt');

  if (!assessment) {
    throw new AppError('Assessment not found', 404);
  }

  if (assessment.user && req.user?.id !== assessment.user.toString()) {
    throw new AppError('Unauthorized', 403);
  }

  res.json({
    success: true,
    result: assessment.result,
    patientName: assessment.patientName,
    selectedConditions: assessment.selectedConditions,
    createdAt: assessment.createdAt
  });
}));

router.post('/:assessmentId/save', asyncHandler(async (req, res) => {
  const assessment = await Assessment.findByIdAndUpdate(
    req.params.assessmentId,
    { status: 'archived' },
    { new: true }
  );

  if (!assessment) {
    throw new AppError('Assessment not found', 404);
  }

  res.json({
    success: true,
    message: 'Assessment saved successfully'
  });
}));

module.exports = router;
