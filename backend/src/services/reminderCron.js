// Feature 11 — Scheduled Email + SMS Appointment Reminders
// Runs every day at 8:00 AM (Africa/Lagos) to send reminders for tomorrow's appointments.
// Requires: npm install node-cron (already in package.json)

const cron = require('node-cron');
const Appointment = require('../models/Appointment');
const Clinic = require('../models/Clinic');
const User = require('../models/User');
const emailService = require('../utils/emailService');
const smsService = require('./smsService');
const logger = require('../utils/logger');

async function sendTomorrowReminders() {
  logger.info('Reminder cron: checking for tomorrow\'s appointments...');
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayStart = new Date(tomorrow.toDateString());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  try {
    const appointments = await Appointment.find({
      appointmentDate: { $gte: dayStart, $lte: dayEnd },
      status: { $in: ['pending', 'confirmed'] },
      reminderSent: { $ne: true }
    }).populate('clinic').populate('user');

    logger.info(`Reminder cron: found ${appointments.length} appointment(s) for tomorrow`);

    for (const appt of appointments) {
      const clinic = appt.clinic;
      const user = appt.user;

      // Email reminder
      if (appt.reminders?.email !== false) {
        try {
          await emailService.sendAppointmentReminder(appt, clinic, user);
        } catch (e) {
          logger.error(`Reminder email failed for appt ${appt._id}: ${e.message}`);
        }
      }

      // SMS reminder
      if (appt.reminders?.sms) {
        try {
          await smsService.sendAppointmentReminderSms(appt, clinic);
        } catch (e) {
          logger.error(`Reminder SMS failed for appt ${appt._id}: ${e.message}`);
        }
      }

      // Mark reminder as sent
      appt.reminderSent = true;
      appt.reminderSentAt = new Date();
      await appt.save({ validateBeforeSave: false });
    }

    logger.info('Reminder cron: done');
  } catch (err) {
    logger.error(`Reminder cron error: ${err.message}`);
  }
}

// Schedule: every day at 08:00 Lagos time (WAT = UTC+1)
module.exports = function startReminderCron() {
  cron.schedule('0 8 * * *', sendTomorrowReminders, {
    timezone: 'Africa/Lagos'
  });
  logger.info('Reminder cron scheduled: daily at 08:00 Africa/Lagos');
};
