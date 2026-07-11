const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dentalcare', {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logger.info(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
  console.error(error); // Print the full error

  logger.error(`MongoDB connection failed: ${error.message}`);
  logger.warn('Continuing without MongoDB. Some API routes may be unavailable in demo mode.');

  return null;

  }
};

module.exports = connectDB;
