// SMS Appointment Reminders — Feature 10
// Uses Twilio if TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER are set.
// Without credentials this module is a no-op (logs a warning and returns).

const logger = require('../utils/logger');

const twilioConfigured = !!(
  process.env.TWILIO_ACCOUNT_SID &&
  process.env.TWILIO_AUTH_TOKEN &&
  process.env.TWILIO_FROM_NUMBER &&
  !process.env.TWILIO_ACCOUNT_SID.startsWith('AC_PLACEHOLDER')
);

let twilioClient = null;
if (twilioConfigured) {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    logger.info('Twilio SMS client initialised');
  } catch (e) {
    logger.warn(`Twilio module not available: ${e.message}. Install with: npm install twilio`);
  }
}

exports.sendSms = async (to, body) => {
  if (!twilioClient) {
    logger.warn(`SMS not configured — skipping SMS to ${to}. Set TWILIO_* vars in .env to enable.`);
    return false;
  }
  try {
    const msg = await twilioClient.messages.create({
      body,
      from: process.env.TWILIO_FROM_NUMBER,
      to
    });
    logger.info(`SMS sent to ${to} (SID: ${msg.sid})`);
    return true;
  } catch (err) {
    logger.error(`SMS failed to ${to}: ${err.message}`);
    return false;
  }
};

exports.sendAppointmentReminderSms = async (appointment, clinic) => {
  const phone = appointment.contactPhone;
  if (!phone) return;
  const dateStr = new Date(appointment.appointmentDate).toLocaleDateString('en-NG');
  const body = `HomoDentHealth Reminder: You have an appointment at ${clinic?.name || 'your clinic'} on ${dateStr} at ${appointment.timeSlot?.startTime || ''}. Arrive 10 mins early. Ref: #${appointment._id}`;
  return exports.sendSms(phone, body);
};

exports.sendAppointmentStatusSms = async (appointment, clinic, newStatus) => {
  const phone = appointment.contactPhone;
  if (!phone) return;
  const msgs = {
    confirmed: `Your appointment at ${clinic?.name} has been confirmed. Date: ${new Date(appointment.appointmentDate).toLocaleDateString('en-NG')} at ${appointment.timeSlot?.startTime}.`,
    cancelled: `Your appointment at ${clinic?.name} has been cancelled. Please rebook on HomoDentHealth.`,
    completed: `Your visit to ${clinic?.name} is complete. Please rate your experience on HomoDentHealth.`
  };
  if (!msgs[newStatus]) return;
  return exports.sendSms(phone, `HomoDentHealth: ${msgs[newStatus]}`);
};
