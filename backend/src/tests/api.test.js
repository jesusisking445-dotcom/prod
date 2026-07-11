require('dotenv').config();
const request = require('supertest');
const { app } = require('../src/server');
const User = require('../src/models/User');

describe('Authentication API', () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user with valid data', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123',
          firstName: 'John',
          lastName: 'Doe'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.tokens.accessToken).toBeDefined();
      expect(res.body.user.email).toBe('test@example.com');
    });

    it('should reject duplicate email', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123'
        });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123'
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'SecurePass123'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'short'
        });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await User.create({
        email: 'test@example.com',
        password: 'SecurePass123',
        firstName: 'John',
        isVerified: true
      });
    });

    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.tokens.accessToken).toBeDefined();
    });

    it('should reject wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'WrongPassword'
        });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-existent user', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123'
        });

      expect(res.statusCode).toBe(401);
    });

    it('should lock account after 5 failed attempts', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'WrongPassword'
          });
      }

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123'
        });

      expect(res.statusCode).toBe(429);
      expect(res.body.error).toContain('locked');
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    let refreshToken;

    beforeEach(async () => {
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123'
        });

      refreshToken = registerRes.body.tokens.refreshToken;
    });

    it('should return new access token with valid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken });

      expect(res.statusCode).toBe(200);
      expect(res.body.tokens.accessToken).toBeDefined();
      expect(res.body.tokens.accessToken).not.toBe('');
    });

    it('should reject invalid refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .send({ refreshToken: 'invalid-token' });

      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    let accessToken;

    beforeEach(async () => {
      const registerRes = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'SecurePass123'
        });

      accessToken = registerRes.body.tokens.accessToken;
    });

    it('should return authenticated user', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.user.email).toBe('test@example.com');
    });

    it('should reject without token', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.statusCode).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.statusCode).toBe(401);
    });
  });
});

describe('Assessment API', () => {
  describe('POST /api/assessment', () => {
    it('should create assessment without authentication', async () => {
      const res = await request(app)
        .post('/api/assessment')
        .send({
          patientName: 'John Doe',
          age: 30,
          gender: 'male',
          symptoms: { severePain: true },
          selectedConditions: ['dental-abscess']
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.assessment.id).toBeDefined();
      expect(res.body.assessment.result).toBeDefined();
    });

    it('should reject without selected conditions', async () => {
      const res = await request(app)
        .post('/api/assessment')
        .send({
          patientName: 'John Doe',
          selectedConditions: []
        });

      expect(res.statusCode).toBe(400);
    });
  });

  describe('GET /api/assessment/:id', () => {
    let assessmentId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/assessment')
        .send({
          patientName: 'John Doe',
          selectedConditions: ['dental-abscess']
        });

      assessmentId = res.body.assessment.id;
    });

    it('should retrieve assessment result', async () => {
      const res = await request(app)
        .get(`/api/assessment/${assessmentId}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.assessment.result).toBeDefined();
    });

    it('should return 404 for non-existent assessment', async () => {
      const res = await request(app)
        .get('/api/assessment/000000000000000000000000');

      expect(res.statusCode).toBe(404);
    });
  });
});

module.exports = { app };
