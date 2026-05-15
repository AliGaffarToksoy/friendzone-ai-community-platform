# FriendZone – AI-Powered Student Social Community Platform

FriendZone is an AI-powered social community platform designed for university students. It helps students discover meaningful communities, meet like-minded people, participate in real-time conversations, join events, earn certificates, receive notifications, and interact with a modern moderation-aware social platform.

The project is built as a full-stack web application with Flask, PostgreSQL, Socket.IO, Vanilla JavaScript, Docker, and AI-assisted recommendation features.

---

## Project Summary

FriendZone aims to solve a common problem in university life: students often struggle to find the right communities, events, and people who match their interests and personality.

The platform provides a structured flow:

1. The user registers with a `.edu.tr` university email address.
2. The user completes an MBTI-style personality test.
3. The user selects hobbies and interests.
4. The system recommends and assigns relevant communities.
5. The user joins communities and real-time chats.
6. The user can create posts, comments, rooms, events, and reviews.
7. The AI assistant generates community suggestions and activity ideas.
8. The notification system keeps users informed.
9. The moderation system allows admins to review reports, warn users, hide content, and manage platform safety.

---

## Main Features

### Authentication

- JWT-based authentication
- Secure password hashing with Bcrypt
- `.edu.tr` email validation
- Login and signup pages
- Protected backend endpoints
- Token cleanup on logout
- Disabled user access protection
- Frontend auto-logout when an account is deactivated

---

### Personality Test

- MBTI-style personality test
- Likert scale answers
- Backend-side personality calculation
- Personality type stored in user profile
- Personality result used in community recommendation logic

---

### Hobby Selection

- Category-based hobby selection
- Minimum and maximum selection validation
- Searchable hobby interface
- Selected hobbies panel
- User hobbies stored in the database
- Hobbies used in community matching

---

### Smart Community Matching

FriendZone uses a score-based community recommendation approach.

Matching factors include:

```text
- Hobby similarity
- Community tags
- Community category compatibility
- MBTI/personality compatibility
- Fallback community assignment
```

Main matching module:

```text
backend/ml/community_assigner.py
```

---

### Communities

- List active communities
- Recommended communities
- Community detail page
- Join community
- Create community
- Community member management
- Community owner support
- Community chat room auto-creation
- Active/passive community status support

---

### Real-Time Chat

- Real-time messaging with Flask-SocketIO
- Persistent chat messages in PostgreSQL
- Join/leave room events
- Typing indicator
- Online/offline status
- Message reactions
- Last messages loading
- Community-based chat authorization

---

### Feed System

FriendZone includes a social feed system.

Features:

- Create feed posts
- List active feed posts
- Add comments
- Hide and restore posts through moderation
- Hide and restore comments through moderation
- Report posts and comments
- Feed-related notifications

Main files:

```text
backend/routes/feed_routes.py
backend/models/feed_model.py
frontend/feed.html
frontend/js/feedHandler.js
frontend/css/feed.css
```

---

### Events

The platform includes an event module for student communities.

Features:

- Create events
- List events
- Community-based events
- Join events
- Event reviews
- Event poster upload support
- Event sponsor support
- Active/passive event status
- Moderation support for events

Main files:

```text
backend/routes/event_routes.py
backend/models/event_model.py
frontend/events.html
frontend/js/eventHandler.js
frontend/css/events.css
```

---

### Brand and Sponsor System

FriendZone includes a brand/sponsor system for community and event partnerships.

Features:

- Brand records
- Brand logos
- Community sponsors
- Event sponsors
- Sponsor notifications
- Admin and frontend integration

Main files:

```text
backend/routes/brand_routes.py
backend/models/brand_model.py
frontend/brands.html
frontend/js/brandsHandler.js
frontend/css/brands.css
```

---

### Social Rooms

FriendZone includes a social room module for more dynamic student interaction.

Features:

- Create social rooms
- Join rooms
- Room listing
- Room status management
- Moderation support for closing rooms
- Room-related notifications

Main files:

```text
backend/routes/social_room_routes.py
backend/models/social_room_model.py
frontend/rooms.html
frontend/js/roomsHandler.js
frontend/css/rooms.css
```

---

### Notification System

The platform includes a notification system used across the application.

Notification examples:

- Community joined
- Community created
- Event joined
- Event created
- Sponsor added
- Badge awarded
- Certificate awarded
- Feed post/comment activity
- Moderation action notifications
- User warning notifications

Features:

- Notification list page
- Notification dropdown
- Unread notification badge
- Mark as read
- Mark all as read
- Archive notifications
- Action URL support

Main files:

```text
backend/routes/notification_routes.py
backend/services/notification_service.py
backend/models/notification_model.py
frontend/notifications.html
frontend/js/notificationsHandler.js
frontend/css/notifications.css
frontend/js/main.js
```

---

### Gamification

FriendZone includes gamification elements to increase engagement.

Features:

- Points
- Badges
- Achievement-style notifications
- Activity-based rewards
- Profile integration

Main files:

```text
backend/routes/gamification_routes.py
backend/models/gamification_model.py
```

---

### Certificates

The platform includes a certificate system.

Features:

- Award certificates
- Certificate listing
- Certificate verification page
- Public certificate verification route
- Certificate-related notifications

Main files:

```text
backend/routes/certificate_routes.py
backend/models/certificate_model.py
frontend/certificate-verify.html
frontend/js/certificateVerifyHandler.js
frontend/css/certificate-verify.css
```

---

### AI Assistant

The platform includes an AI assistant for communities.

The assistant can generate:

- Conversation topics
- Event ideas
- Icebreaker questions
- Mini activities
- Community engagement suggestions

If `OPENAI_API_KEY` is available, OpenAI-powered responses are used.

If no API key is provided, the system uses a local fallback suggestion system.

```text
OPENAI_API_KEY exists     -> OpenAI-powered suggestions
OPENAI_API_KEY is missing -> Local fallback suggestions
```

Main files:

```text
backend/routes/assistant_routes.py
backend/services/gpt_service.py
frontend/js/gptAssistant.js
```

---

## Admin Dashboard

FriendZone includes a general admin dashboard.

Features:

- Total users
- Total communities
- Total messages
- Personality test completion count
- MBTI distribution
- Hobby statistics
- User list
- Community list
- JSON export
- Chart.js dashboard visuals

Admin dashboard URL:

```text
http://localhost:8080/admin.html
```

Default admin credentials:

```text
Username: admin
Password: admin123
```

Main files:

```text
backend/routes/admin_routes.py
frontend/admin.html
frontend/js/adminHandler.js
frontend/css/admin.css
```

---

## Moderation Center

FriendZone includes a dedicated moderation center.

Moderation features:

- User-facing report creation
- Admin report listing
- Report status management
- Report detail view
- Admin action logs
- User search
- User warning system
- Deactivate/reactivate users
- Hide/restore feed posts
- Hide/restore feed comments
- Deactivate/reactivate communities
- Deactivate/reactivate events
- Close social rooms
- Notify affected users after moderation actions
- Prevent inactive users from accessing protected features

Moderation center URL:

```text
http://localhost:8080/admin-moderation.html
```

Main files:

```text
backend/routes/moderation_routes.py
backend/models/moderation_model.py
frontend/admin-moderation.html
frontend/js/adminModerationHandler.js
frontend/css/admin.css
```

---

## Technology Stack

### Backend

- Python 3.10+
- Flask 2.2.5
- Flask-SQLAlchemy
- PostgreSQL 15
- Flask-Migrate
- Flask-JWT-Extended
- Flask-Bcrypt
- Flask-CORS
- Flask-SocketIO
- Eventlet
- python-dotenv
- Rotating file logging

### Frontend

- HTML5
- CSS3
- Vanilla JavaScript ES6+
- Socket.IO Client
- Chart.js
- Responsive design
- Dark theme
- Modern dashboard layout
- Modern sidebar navigation

### AI / ML

- Score-based recommendation logic
- Scikit-learn infrastructure
- Cosine similarity infrastructure
- OpenAI API integration
- Local fallback suggestion system

### Deployment

- Docker
- Docker Compose
- PostgreSQL container
- Backend container
- Nginx frontend container
- Environment-based configuration

---

## Project Structure

```text
friendzone-ai-community-platform/
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
├── requirements.txt
├── start.sh
├── README.md
├── .env.example
├── .gitignore
├── backend/
│   ├── __init__.py
│   ├── app.py
│   ├── config.py
│   ├── socket_events.py
│   ├── database/
│   │   ├── db_connection.py
│   │   └── seed_data.py
│   ├── ml/
│   │   ├── community_assigner.py
│   │   ├── preprocessing.py
│   │   └── similarity_engine.py
│   ├── models/
│   │   ├── user_model.py
│   │   ├── community_model.py
│   │   ├── chat_model.py
│   │   ├── chat_room_model.py
│   │   ├── event_model.py
│   │   ├── feed_model.py
│   │   ├── brand_model.py
│   │   ├── notification_model.py
│   │   ├── moderation_model.py
│   │   ├── social_room_model.py
│   │   ├── certificate_model.py
│   │   └── gamification_model.py
│   ├── routes/
│   │   ├── auth_routes.py
│   │   ├── test_routes.py
│   │   ├── community_routes.py
│   │   ├── chat_routes.py
│   │   ├── assistant_routes.py
│   │   ├── admin_routes.py
│   │   ├── event_routes.py
│   │   ├── feed_routes.py
│   │   ├── brand_routes.py
│   │   ├── notification_routes.py
│   │   ├── moderation_routes.py
│   │   ├── social_room_routes.py
│   │   ├── certificate_routes.py
│   │   ├── gamification_routes.py
│   │   └── user_routes.py
│   ├── services/
│   │   ├── gpt_service.py
│   │   ├── notification_service.py
│   │   └── recommendation_service.py
│   └── utils/
│       ├── helpers.py
│       ├── validators.py
│       └── logger.py
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── signup.html
│   ├── personality_test.html
│   ├── hobbies.html
│   ├── communities.html
│   ├── community.html
│   ├── feed.html
│   ├── events.html
│   ├── rooms.html
│   ├── brands.html
│   ├── notifications.html
│   ├── profile.html
│   ├── social-profile.html
│   ├── certificate-verify.html
│   ├── admin.html
│   ├── admin-moderation.html
│   ├── css/
│   └── js/
└── logs/
```

---

## Running with Docker

Go to the project root:

```bash
cd friendzone-ai-community-platform
```

Start the full project:

```bash
docker compose up --build
```

Services:

```text
Frontend: http://localhost:8080
Backend:  http://localhost:5001
Postgres: localhost:5433
Admin:    http://localhost:8080/admin.html
Moderation Center: http://localhost:8080/admin-moderation.html
```

Backend health check:

```bash
curl http://localhost:5001/health
```

Expected response:

```json
{
  "success": true,
  "message": "FriendZone backend is running",
  "data": {
    "service": "backend",
    "status": "healthy"
  }
}
```

Stop services:

```bash
docker compose down
```

Stop services and remove database volume:

```bash
docker compose down -v
```

> Warning: `docker compose down -v` removes PostgreSQL data. Registered users, messages, posts, reports, notifications, and other records will be deleted.

---

## Docker Compose Services

### PostgreSQL

```text
Container: friendzone_postgres
Image: postgres:15-alpine
Port: 5433 -> 5432
Database: friendzone_db
User: friendzone_user
Password: friendzone_password
```

### Backend

```text
Container: friendzone_backend
Port: 5001
Command: bash /app/start.sh
```

Backend startup flow:

1. Wait for PostgreSQL.
2. Apply migrations.
3. Load seed data when needed.
4. Start Flask backend with Socket.IO support.

### Frontend

```text
Container: friendzone_frontend
Image: nginx:alpine
Port: 8080 -> 80
```

---

## Running Locally Without Docker

### 1. Create virtual environment

```bash
python3 -m venv venv
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Create PostgreSQL database

```bash
createdb friendzone_db
```

### 4. Create environment file

```bash
cp .env.example .env
```

Example `.env`:

```env
FLASK_APP=backend.app
FLASK_DEBUG=1

SECRET_KEY=change-this-secret-key-minimum-32-character
JWT_SECRET_KEY=change-this-jwt-secret-key-minimum-32-character

DATABASE_URL=postgresql://postgres:password@localhost:5432/friendzone_db

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini

ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

FRONTEND_ORIGIN=http://localhost:5500
```

### 5. Run migrations

```bash
flask db upgrade
```

### 6. Load seed data

```bash
python -m backend.database.seed_data
```

### 7. Start backend

```bash
python -m backend.app
```

### 8. Start frontend

Open another terminal:

```bash
cd frontend
python3 -m http.server 5500
```

Frontend URL:

```text
http://localhost:5500
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `FLASK_APP` | Flask app entry point |
| `FLASK_DEBUG` | Enables debug mode |
| `SECRET_KEY` | Flask secret key |
| `JWT_SECRET_KEY` | JWT token secret |
| `DATABASE_URL` | PostgreSQL connection URL |
| `OPENAI_API_KEY` | OpenAI API key |
| `OPENAI_MODEL` | OpenAI model name |
| `ADMIN_USERNAME` | Admin username |
| `ADMIN_PASSWORD` | Admin password |
| `FRONTEND_ORIGIN` | Allowed frontend origin |

---

## API Endpoints

### Auth

```http
POST /api/auth/register
POST /api/auth/login
```

### Personality and Hobbies

```http
POST /api/test/personality
GET  /api/test/hobbies
POST /api/test/hobbies
```

### Communities

```http
GET  /api/community
GET  /api/community/recommendations/:user_id
GET  /api/community/user/:user_id
GET  /api/community/:id
POST /api/community/join
POST /api/community/create
```

### Chat

```http
GET  /api/chat/:community_id/messages
POST /api/chat/message
```

### Assistant

```http
POST /api/assistant/community-suggestion
```

### Feed

```http
GET    /api/feed
POST   /api/feed
GET    /api/feed/posts/:post_id/comments
POST   /api/feed/posts/:post_id/comments
DELETE /api/feed/posts/:post_id
DELETE /api/feed/comments/:comment_id
```

### Events

```http
GET  /api/events
GET  /api/events/:event_id
POST /api/events
POST /api/events/:event_id/join
POST /api/events/:event_id/reviews
```

### Brands and Sponsors

```http
GET  /api/brands
POST /api/brands
POST /api/brands/community-sponsor
POST /api/brands/event-sponsor
```

### Social Rooms

```http
GET  /api/rooms
POST /api/rooms
POST /api/rooms/:room_id/join
```

### Notifications

```http
GET   /api/notifications
PATCH /api/notifications/:notification_id/read
PATCH /api/notifications/read-all
PATCH /api/notifications/:notification_id/archive
```

### Moderation

```http
POST  /api/moderation/reports
GET   /api/moderation/warnings/me
PATCH /api/moderation/warnings/:warning_id/acknowledge
```

### Admin Moderation

```http
GET   /api/moderation/admin/overview
GET   /api/moderation/admin/reports
GET   /api/moderation/admin/reports/:report_id
PATCH /api/moderation/admin/reports/:report_id/status
GET   /api/moderation/admin/actions
GET   /api/moderation/admin/users
GET   /api/moderation/admin/warnings
POST  /api/moderation/admin/action
```

### Admin Dashboard

```http
GET /admin/api/dashboard/stats
GET /admin/api/users
GET /admin/api/communities
GET /admin/api/personality-stats
GET /admin/api/hobby-stats
GET /admin/api/export
```

---

## Socket.IO Events

### Client to Server

```text
join_room
leave_room
typing
stop_typing
add_reaction
```

### Server to Client

```text
connected
joined_room
receive_message
typing
stop_typing
reaction_updated
reaction_error
user_online
user_offline
socket_error
```

Example `join_room` payload:

```json
{
  "room_id": 1,
  "user_id": 5
}
```

Example reaction payload:

```json
{
  "message_id": 10,
  "reaction": "👍",
  "user_id": 5,
  "room_id": 1
}
```

---

## Database Modules

Main database areas:

```text
users
communities
community_members
chat_messages
chat_rooms
chat_user_status
feed_posts
feed_comments
events
event_participants
event_reviews
brands
community_sponsors
event_sponsors
notifications
moderation_reports
moderation_actions
user_warnings
social_rooms
certificates
badges
points
```

---

## Demo Flow

1. Start Docker:

```bash
docker compose up --build
```

2. Open frontend:

```text
http://localhost:8080
```

3. Create an account with a `.edu.tr` email.

4. Complete the personality test.

5. Select hobbies.

6. Join or create a community.

7. Open a community chat.

8. Send messages and reactions.

9. Use the AI assistant.

10. Create or view feed posts.

11. Create or join events.

12. Check notifications.

13. Open admin dashboard:

```text
http://localhost:8080/admin.html
```

14. Open moderation center:

```text
http://localhost:8080/admin-moderation.html
```

15. Test reporting and moderation actions.

---

## Useful Test Commands

### Health check

```bash
curl -X GET "http://localhost:5001/health"
```

### Admin moderation overview

```bash
curl -X GET "http://localhost:5001/api/moderation/admin/overview" \
  -u admin:admin123
```

### Admin reports

```bash
curl -X GET "http://localhost:5001/api/moderation/admin/reports?limit=5" \
  -u admin:admin123
```

### Admin actions

```bash
curl -X GET "http://localhost:5001/api/moderation/admin/actions?limit=5" \
  -u admin:admin123
```

### Admin warnings

```bash
curl -X GET "http://localhost:5001/api/moderation/admin/warnings?limit=5" \
  -u admin:admin123
```

### User notifications

```bash
curl -X GET "http://localhost:5001/api/notifications" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Acceptance Tests

The following scenarios should work:

- User can register with a `.edu.tr` email.
- Non-university emails are rejected.
- User can log in.
- User can complete the personality test.
- User can select hobbies.
- User can receive community recommendations.
- User can join communities.
- User can send real-time chat messages.
- User can add emoji reactions.
- AI assistant returns OpenAI or fallback suggestions.
- User can create feed posts.
- User can comment on feed posts.
- User can report users, posts, comments, communities, events, and rooms.
- Admin can view reports.
- Admin can update report status.
- Admin can warn users.
- Admin can deactivate and reactivate users.
- Admin can hide and restore feed posts.
- Admin can hide and restore feed comments.
- Admin can deactivate and reactivate communities.
- Admin can deactivate and reactivate events.
- Admin can close social rooms.
- Affected users receive notifications after moderation actions.
- Deactivated users cannot access protected user endpoints.
- Notifications can be marked as read.
- Admin dashboard statistics work.
- Docker Compose starts the full project.

---

## Common Errors and Fixes

### `zsh: command not found: python`

Use `python3` on macOS:

```bash
python3 -m venv venv
```

---

### `No module named backend`

Run commands from the project root:

```bash
cd friendzone-ai-community-platform
python -m backend.app
```

---

### `Could not import backend.backend.app`

You are probably inside the `backend/` directory. Return to the project root:

```bash
cd ..
export FLASK_APP=backend.app
```

---

### `column ... does not exist`

The database may be using an old migration.

For Docker reset:

```bash
docker compose down -v
docker compose up --build
```

For local reset:

```bash
dropdb friendzone_db
createdb friendzone_db
flask db upgrade
python -m backend.database.seed_data
```

---

### `Failed to fetch`

Check:

```text
Backend health: http://localhost:5001/health
Frontend URL:   http://localhost:8080
API base URL:   frontend/js/main.js should use http://localhost:5001
CORS config:    backend/__init__.py
```

Clear browser storage:

```js
localStorage.clear();
sessionStorage.clear();
location.reload();
```

---

### Admin login does not work

Default credentials:

```text
admin
admin123
```

Test admin endpoint:

```bash
curl -u admin:admin123 http://localhost:5001/admin/api/dashboard/stats
```

---

### Socket.IO messages only appear after refresh

Do not use `flask run` for Socket.IO mode.

Use:

```bash
python -m backend.app
```

Docker already starts the backend with Socket.IO support.

---

### Docker database differs from local database

Docker uses its own PostgreSQL volume.

Reset Docker database:

```bash
docker compose down -v
docker compose up --build
```

---

## Security Notes

- Passwords are hashed with Bcrypt.
- JWT secrets are stored in environment variables.
- `.env` must not be committed.
- `.env.example` can be committed.
- Admin credentials are environment-based.
- API keys must not be hardcoded.
- CORS should only allow trusted origins.
- Deactivated users are blocked from protected user routes.
- Moderation actions are logged.
- User-facing moderation notifications are stored.
- Frontend uses safe rendering patterns for dynamic content.

---

## Development Notes

This project is designed as a portfolio-level, production-oriented full-stack application.

Before real production deployment, these improvements are recommended:

- HTTPS reverse proxy
- Refresh token support
- Email verification
- Password reset
- Role-based access control
- Rate limiting
- Automated tests
- CI/CD pipeline
- Cloud deployment
- Monitoring and metrics
- Object storage for uploaded images
- Production-grade logging
- WebSocket token validation

---

## Future Improvements

- Private messaging
- Advanced friend recommendation system
- More advanced ML-based user segmentation
- Semantic embedding-based community matching
- More detailed admin roles
- Community-specific moderation roles
- CSV/PDF exports
- Production Docker profile
- GitHub Actions CI/CD
- Cloud deployment with PostgreSQL managed service

---

## License

This project was developed for education, portfolio building, and technical interview preparation.