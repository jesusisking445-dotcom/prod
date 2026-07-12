const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dentalcare';

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      autoIndex: true,
    });
    logger.info(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(error);
    logger.error(`MongoDB connection failed: ${error.message}`);
    logger.warn('Continuing without MongoDB. Some API routes may be unavailable in demo mode.');
    return null;
  }
};

module.exports = connectDB;
