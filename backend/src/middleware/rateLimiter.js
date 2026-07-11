const rateLimit = require('express-rate-limit');

exports.global = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP'
});

exports.auth = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  message: 'Too many login attempts, please try again later'
});

exports.assessment = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many assessments, please try again later'
});

exports.appointment = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many appointment bookings, please try again later'
});
