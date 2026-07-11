const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
const logger = require('../utils/logger');

const migrate = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('Connected to MongoDB for migration');

    const db = mongoose.connection.db;

    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ createdAt: -1 });

    await db.collection('assessments').createIndex({ user: 1, createdAt: -1 });
    await db.collection('assessments').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    await db.collection('appointments').createIndex({ user: 1, appointmentDate: 1 });
    await db.collection('appointments').createIndex({ clinic: 1, appointmentDate: 1 });
    await db.collection('appointments').createIndex({ appointmentDate: 1, status: 1 });

    await db.collection('clinics').createIndex({ 'location.coordinates': '2dsphere' });
    await db.collection('clinics').createIndex({ 'location.city': 1, status: 1 });

    await db.collection('blogposts').createIndex({ slug: 1 }, { unique: true });
    await db.collection('blogposts').createIndex({ category: 1, status: 1 });
    await db.collection('blogposts').createIndex({ publishedAt: -1 });

    await db.collection('chatmessages').createIndex({ conversationId: 1, createdAt: -1 });

    await db.collection('chatconversations').createIndex({ user: 1, createdAt: -1 });
    await db.collection('chatconversations').createIndex({ status: 1, createdAt: -1 });
    await db.collection('chatconversations').createIndex({ assignedAgent: 1, status: 1 });

    logger.info('Database migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error(`Migration failed: ${error.message}`);
    process.exit(1);
  }
};

migrate();
