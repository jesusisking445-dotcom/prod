# HomoDentHealth — Backend API

Production-grade Node.js/Express backend for the HomoDentHealth platform.

## Features

- **Authentication**: JWT-based with email verification and password reset
- **Assessment Engine**: Rule-based dental triage system
- **Appointment Management**: Clinic booking with calendar integration
- **User Management**: Profiles, medical history, preferences
- **Admin Dashboard**: User, clinic, blog, and appointment management
- **Live Chat**: Real-time messaging with Socket.io
- **Blog System**: Content management with comments and ratings
- **Clinic Directory**: Geolocation-based clinic search
- **Security**: Rate limiting, CORS, helmet, input validation
- **Error Handling**: Comprehensive error tracking and logging

## Installation

```bash
cd backend
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required environment variables:
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT tokens (min 32 chars)
- `SMTP_*`: Email service configuration
- `CORS_ORIGIN`: Frontend URL(s)

## Database Setup

```bash
npm run migrate    # Create indexes
npm run seed       # Seed sample data
```

## Running the Server

**Development**:
```bash
npm run dev
```

**Production**:
```bash
npm start
```

**Docker**:
```bash
docker-compose up --build
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/verify-email` - Email verification
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Reset password
- `POST /api/auth/refresh-token` - Refresh JWT token

### Assessment
- `POST /api/assessment` - Create assessment
- `GET /api/assessment/:id` - Get assessment result
- `GET /api/assessment/user/history` - User's assessment history

### Appointments
- `POST /api/appointment` - Book appointment
- `GET /api/appointment/my-appointments` - User's appointments
- `GET /api/appointment/:id` - Get appointment details
- `PATCH /api/appointment/:id/cancel` - Cancel appointment
- `PATCH /api/appointment/:id/rate` - Rate appointment

### Clinics
- `GET /api/clinic` - Search clinics
- `GET /api/clinic/nearby` - Find nearby clinics (geolocation)
- `GET /api/clinic/:id` - Get clinic details
- `GET /api/clinic/:id/availability` - Check clinic availability

### Blog
- `GET /api/blog` - List blog posts
- `GET /api/blog/:slug` - Get blog post
- `POST /api/blog/:id/comment` - Post comment
- `POST /api/blog/:id/like` - Like post

### User
- `GET /api/user/profile` - Get user profile
- `PATCH /api/user/profile` - Update profile
- `PATCH /api/user/password` - Change password
- `PATCH /api/user/preferences` - Update preferences
- `DELETE /api/user/account` - Deactivate account

### Chat
- `POST /api/chat/conversations` - Create chat conversation
- `GET /api/chat/conversations` - List conversations
- `POST /api/chat/conversations/:conversationId/messages` - Send message
- `GET /api/chat/conversations/:conversationId/messages` - Get messages
- `PATCH /api/chat/conversations/:conversationId/close` - Close conversation

### Admin
- `GET /api/admin/dashboard/stats` - Dashboard statistics
- `GET /api/admin/users` - List users
- `PATCH /api/admin/users/:id/role` - Change user role
- `GET /api/admin/clinics` - List clinics
- `POST /api/admin/clinics` - Create clinic
- `PATCH /api/admin/clinics/:id` - Update clinic
- `GET /api/admin/appointments` - List appointments
- `GET /api/admin/blog` - List blog posts
- `POST /api/admin/blog` - Create blog post
- `GET /api/admin/chat/conversations` - List chat conversations

## Architecture

```
src/
├── config/           # Database configuration
├── middleware/       # Express middleware (auth, error, rate limit)
├── models/           # MongoDB schemas
├── routes/           # API endpoints
├── services/         # Business logic (Socket.io, etc.)
├── utils/            # Helpers (logger, email, tokens, validation)
└── scripts/          # Database migration and seeding
```

## Security

- **Password hashing**: Bcrypt with salt rounds
- **JWT tokens**: Exp 7 days (access), 30 days (refresh)
- **Rate limiting**: 100 requests/15 mins global, 5 auth attempts/15 mins
- **Input validation**: Joi schemas for all endpoints
- **CORS**: Configurable origin whitelist
- **Helmet**: HTTP security headers
- **MongoDB Injection**: Express-mongo-sanitize protection
- **Account lockout**: After 5 failed login attempts

## Error Handling

All errors return JSON with status code, message, and optional details:

```json
{
  "success": false,
  "error": "Validation error",
  "details": ["field1: error message", "field2: error message"]
}
```

## Logging

Logs written to `/logs/`:
- `app.log` - Application events
- `error.log` - Errors
- `debug.log` - Debug messages (dev only)

## Database Schema

### User
- Email, password (hashed), profile info
- Medical history, preferences
- Role-based access (user, dentist, admin, clinic_manager)
- Account status, login tracking

### Assessment
- Patient demographics, symptoms selected
- Triage result (level, condition, action, home care)
- Session tracking, expiry after 90 days

### Appointment
- User, clinic, dentist assignment
- Date/time, service type, notes
- Status workflow, cancellation tracking
- Payment, consultation notes, ratings

### Clinic
- Location with geospatial coordinates
- Contact, hours, services, specialties
- Staff, capacity, accreditation
- Availability slots, ratings, reviews

### BlogPost
- Title, slug, content, excerpt
- Category, tags, featured image
- Author, publish status, dates
- Views, likes, comments with moderation

### ChatConversation & ChatMessage
- User-admin/agent conversations
- Message history with attachments
- Status, priority, resolution tracking
- Satisfaction ratings

## Testing

```bash
npm test
```

Tests use Jest + Supertest for API endpoint testing.

## Monitoring & Maintenance

- Monitor logs in `/logs/` directory
- Check MongoDB indexes with `db.collection.getIndexes()`
- Track JWT token expiry and refresh cycles
- Review failed login attempts for security

## License

Proprietary - HomoDentHealth Platform
