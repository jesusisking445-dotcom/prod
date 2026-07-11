const nodemailer = require('nodemailer');
const logger = require('./logger');

const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    })
  : null;

const BRAND = 'HomoDentHealth';
const ACCENT = '#2E9B6B';

function wrapHtml(content) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>body{font-family:system-ui,sans-serif;background:#f5fafa;margin:0;padding:0;}
.wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);}
.hdr{background:${ACCENT};padding:24px 32px;color:#fff;font-size:1.2rem;font-weight:700;}
.body{padding:32px;}
.code{font-size:2rem;font-weight:800;letter-spacing:6px;color:${ACCENT};background:#f0faf6;border-radius:8px;padding:16px 24px;text-align:center;margin:20px 0;}
.btn{display:inline-block;background:${ACCENT};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;}
.footer{padding:16px 32px;background:#f5fafa;font-size:.8rem;color:#aaa;text-align:center;}
ul{line-height:2;}</style></head>
<body><div class="wrap">
<div class="hdr">🦷 ${BRAND}</div>
<div class="body">${content}</div>
<div class="footer">© ${new Date().getFullYear()} ${BRAND} · This is an automated email, please do not reply.</div>
</div></body></html>`;
}

exports.sendEmail = async (to, subject, html, text) => {
  if (!transporter) {
    logger.warn(`SMTP not configured — skipping email to ${to} ("${subject}"). Add SMTP_HOST/SMTP_USER/SMTP_PASS in .env to enable real email delivery.`);
    return;
  }
  try {
    await transporter.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject, html, text });
    logger.info(`Email sent to ${to}`);
  } catch (error) {
    logger.error(`Failed to send email to ${to}: ${error.message}`);
    throw error;
  }
};

exports.sendOtpEmail = async (user, code) => {
  const minutes = parseInt(process.env.OTP_EXPIRE_MINUTES) || 10;
  const html = wrapHtml(`
    <p>Hi ${user.firstName || 'there'},</p>
    <p>Your ${BRAND} verification code is:</p>
    <div class="code">${code}</div>
    <p style="color:#888;font-size:.9rem;">This code expires in <strong>${minutes} minutes</strong>. If you didn't request this, you can ignore this email.</p>
  `);
  await exports.sendEmail(user.email, `Your ${BRAND} verification code`, html, `Your verification code is ${code}. It expires in ${minutes} minutes.`);
};

exports.sendPasswordResetEmail = async (user, token) => {
  const base = process.env.FRONTEND_URL || 'http://localhost:5500';
  const resetUrl = `${base}/reset-password.html?token=${token}`;
  const html = wrapHtml(`
    <p>Hi ${user.firstName || 'there'},</p>
    <p>Someone (hopefully you) requested a password reset for your ${BRAND} account.</p>
    <a class="btn" href="${resetUrl}">Reset My Password</a>
    <p style="color:#888;font-size:.85rem;">Or copy this link:<br/><code>${resetUrl}</code></p>
    <p style="color:#888;font-size:.85rem;">This link expires in <strong>1 hour</strong>. If you didn't request this, ignore this email — your account is safe.</p>
  `);
  await exports.sendEmail(user.email, `Reset your ${BRAND} password`, html);
};

exports.sendAppointmentConfirmation = async (appointment, clinic, user) => {
  const email = user.email || appointment.contactEmail;
  if (!email) return;
  const dateStr = new Date(appointment.appointmentDate).toLocaleDateString('en-NG', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const html = wrapHtml(`
    <p>Hi ${user.firstName || appointment.contactName || 'there'},</p>
    <p>✅ Your appointment has been booked successfully!</p>
    <ul>
      <li><strong>Clinic:</strong> ${clinic.name}</li>
      <li><strong>Address:</strong> ${clinic.location?.address || ''}</li>
      <li><strong>Date:</strong> ${dateStr}</li>
      <li><strong>Time:</strong> ${appointment.timeSlot?.startTime || ''}</li>
      <li><strong>Service:</strong> ${appointment.serviceType}</li>
      <li><strong>Reference:</strong> #${appointment._id}</li>
    </ul>
    <p>Please arrive <strong>10 minutes early</strong>. If you need to cancel, log in to your dashboard.</p>
    <a class="btn" href="${process.env.FRONTEND_URL || 'http://localhost:5500'}/dashboard.html">View My Dashboard</a>
  `);
  await exports.sendEmail(email, `Appointment confirmed — ${clinic.name}`, html);
};

exports.sendAppointmentStatusEmail = async (appointment, clinic, user, newStatus) => {
  const email = user?.email || appointment.contactEmail;
  if (!email) return;
  const dateStr = new Date(appointment.appointmentDate).toLocaleDateString('en-NG', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const statusMessages = {
    confirmed:   { emoji: '✅', label: 'Confirmed',   msg: 'Your appointment has been confirmed by the clinic. See you soon!' },
    in_progress: { emoji: '🦷', label: 'In Progress', msg: 'Your appointment is now in progress.' },
    completed:   { emoji: '🎉', label: 'Completed',   msg: 'Your appointment is complete. We hope your visit went well!' },
    cancelled:   { emoji: '❌', label: 'Cancelled',   msg: 'Unfortunately your appointment has been cancelled by the clinic. Please rebook at your convenience.' },
    no_show:     { emoji: '⚠️', label: 'Missed',      msg: 'We noticed you missed your appointment. Please rebook when you\'re ready.' }
  };
  const info = statusMessages[newStatus] || { emoji: 'ℹ️', label: newStatus, msg: `Your appointment status has been updated to: ${newStatus}.` };
  const html = wrapHtml(`
    <p>Hi ${user?.firstName || appointment.contactName || 'there'},</p>
    <p>${info.emoji} <strong>${info.msg}</strong></p>
    <ul>
      <li><strong>Clinic:</strong> ${clinic?.name || 'Your clinic'}</li>
      <li><strong>Date:</strong> ${dateStr}</li>
      <li><strong>Time:</strong> ${appointment.timeSlot?.startTime || ''}</li>
      <li><strong>Reference:</strong> #${appointment._id}</li>
    </ul>
    ${newStatus === 'completed' ? '<p>⭐ Please rate your visit from your dashboard — your feedback helps improve care for everyone.</p>' : ''}
    <a class="btn" href="${process.env.FRONTEND_URL || 'http://localhost:5500'}/dashboard.html">View My Dashboard</a>
  `);
  await exports.sendEmail(email, `Appointment ${info.label} — ${clinic?.name || BRAND}`, html);
};

exports.sendAppointmentReminder = async (appointment, clinic, user) => {
  const email = user?.email || appointment.contactEmail;
  if (!email) return;
  const dateStr = new Date(appointment.appointmentDate).toLocaleDateString('en-NG', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
  const html = wrapHtml(`
    <p>Hi ${user?.firstName || appointment.contactName || 'there'},</p>
    <p>⏰ <strong>Reminder:</strong> You have a dental appointment <strong>tomorrow</strong>!</p>
    <ul>
      <li><strong>Clinic:</strong> ${clinic?.name || ''}</li>
      <li><strong>Address:</strong> ${clinic?.location?.address || ''}</li>
      <li><strong>Date:</strong> ${dateStr}</li>
      <li><strong>Time:</strong> ${appointment.timeSlot?.startTime || ''}</li>
    </ul>
    <p>Please arrive <strong>10 minutes early</strong> and bring any previous dental records if available.</p>
  `);
  await exports.sendEmail(email, `Reminder: Appointment tomorrow at ${clinic?.name || BRAND}`, html);
};
