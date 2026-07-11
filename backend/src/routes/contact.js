const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/appError');
const emailService = require('../utils/emailService');
const rateLimiter = require('../middleware/rateLimiter');

const router = express.Router();

// Public contact form submission — relays the message to the clinic's
// admin inbox by email. No database storage needed for this simple case.
router.post('/', rateLimiter.assessment, asyncHandler(async (req, res) => {
  const { name, email, phone, subject, message } = req.body;

  if (!name || !email || !message) {
    throw new AppError('Name, email and message are required', 400);
  }

  const to = process.env.CONTACT_INBOX_EMAIL || process.env.SMTP_FROM || process.env.SMTP_USER;

  if (to) {
    const html = `
      <h2>New contact form submission</h2>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Phone:</strong> ${phone || '—'}</p>
      <p><strong>Subject:</strong> ${subject || '—'}</p>
      <p><strong>Message:</strong></p>
      <p>${String(message).replace(/</g, '&lt;')}</p>
    `;
    try {
      await emailService.sendEmail(to, `Contact form: ${subject || 'New message'}`, html, message);
    } catch (error) {
      // Don't fail the request just because email delivery failed — log and move on
    }
  }

  res.status(201).json({
    success: true,
    message: "Thanks for reaching out — we'll get back to you within 1 business day."
  });
}));

module.exports = router;
