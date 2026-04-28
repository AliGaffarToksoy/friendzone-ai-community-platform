# FriendZone – AI-Powered Social Community Platform

FriendZone is a modern social community platform designed to help university students build more meaningful social connections based on their personality traits and interests.

The platform includes user authentication, an MBTI-based personality test, hobby selection, score-based community matching, real-time community chat, emoji reactions, GPT-powered community suggestions, and an admin dashboard.

---

## Project Overview

The main goal of FriendZone is to guide students toward more relevant social communities instead of assigning them randomly.

The platform uses:

- Personality type
- Hobby profile
- Community tags
- Community category
- Real-time interaction features
- AI-powered group suggestions

User flow:

1. The user registers with a `.edu.tr` university email address.
2. The user completes a 24-question MBTI-based personality test.
3. The user selects hobbies and interests.
4. The system automatically assigns the user to the most suitable community.
5. The user joins real-time community chats.
6. The AI assistant generates conversation topics, event ideas, icebreaker questions, and group activities.
7. The admin panel tracks platform statistics.

---

## Core Features

### Authentication

- JWT-based user authentication
- Password hashing with Bcrypt
- Only `.edu.tr` email addresses are accepted
- Email validation on both frontend and backend
- Protected API endpoints
- Token cleanup on logout

### Personality Test

- 24-question MBTI-based test
- 1–5 Likert scale
- Balanced question distribution across E/I, S/N, T/F, and J/P axes
- Backend-side MBTI calculation
- Personality type saved to the user profile
- Personality type used in community matching

### Hobby Selection

- Dynamic hobby categories
- Categories include Technology, Sports, Art, Nature, Education, Social, Career, Games & Entertainment, and Health & Lifestyle
- Minimum 3 and maximum 10 hobby selections
- Automatic community assignment after hobby submission
- Search, selection limit, and selected hobbies panel

### Smart Community Matching

FriendZone uses a weighted scoring system for community assignment:

```text
60% Hobby / Tag Similarity
20% Hobby Category / Community Category Compatibility
20% MBTI Personality Type / Community Compatibility
```

Matching algorithm file:

```text
backend/ml/community_assigner.py
```

Supported matching logic:

- Exact match
- Partial string match
- Fuzzy string similarity
- Hobby category matching
- MBTI personality-category affinity
- Fallback to General Chat if no meaningful match is found

### Communities

- List all active communities
- Show recommended communities
- Search communities
- Filter by category
- Join communities
- Create new communities through a modal
- Automatically create a chat room when a new community is created

### Real-Time Chat

- Real-time messaging with Flask-SocketIO
- Persistent message storage in PostgreSQL
- Load the latest 50 messages
- Typing indicator
- Online/offline connection status
- Only community members can view and send messages
- Messages appear in real time without page refresh
- Fixed-height chat panel with scrollable message area

### Emoji Reactions

- Add emoji reactions to messages
- Toggle reaction support
- Real-time reaction updates
- Reaction counts shown below messages

Example:

```text
👍 2   ❤️ 1   😂 3
```

### AI / GPT Assistant

The community chat page includes an AI assistant button.

The AI assistant can generate:

- Conversation topics
- Event ideas
- Icebreaker questions
- Mini games or challenges
- Category-specific group activities

If an OpenAI API key is available, the system generates real GPT-powered suggestions.

If no API key is provided, the system uses local category-based fallback suggestions. This keeps the application functional even when the external AI service is unavailable.

```text
OPENAI_API_KEY exists     -> OpenAI-powered suggestions
OPENAI_API_KEY is missing -> Local fallback suggestions
```

AI service file:

```text
backend/services/gpt_service.py
```

### Admin Panel

The admin panel provides:

- Total user count
- Total community count
- Total message count
- Number of users who completed the personality test
- Last 7 days registration chart
- MBTI distribution chart
- Popular hobbies
- User list
- Community list
- JSON export

Admin panel URL:

```text
http://localhost:8080/admin.html
```

Default admin credentials:

```text
Username: admin
Password: admin123
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
- Modern dashboard and sidebar layout

### AI / ML

- Scikit-learn infrastructure
- Cosine similarity infrastructure
- Advanced score-based community assignment
- OpenAI API integration
- GPT fallback system

### Deployment

- Docker
- Docker Compose
- PostgreSQL container
- Backend container
- Nginx-based frontend container
- `.env` environment management

---

## Project Structure

```text
friendzone/
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
├── .dockerignore
├── .env.example
├── .gitignore
├── requirements.txt
├── start.sh
├── README.md
├── backend/
│   ├── __init__.py
│   ├── app.py
│   ├── config.py
│   ├── socket_events.py
│   ├── models/
│   │   ├── user_model.py
│   │   ├── community_model.py
│   │   ├── chat_model.py
│   │   └── chat_room_model.py
│   ├── routes/
│   │   ├── auth_routes.py
│   │   ├── test_routes.py
│   │   ├── community_routes.py
│   │   ├── chat_routes.py
│   │   ├── assistant_routes.py
│   │   ├── admin_routes.py
│   │   └── user_routes.py
│   ├── services/
│   │   ├── gpt_service.py
│   │   └── recommendation_service.py
│   ├── ml/
│   │   ├── community_assigner.py
│   │   ├── similarity_engine.py
│   │   └── preprocessing.py
│   ├── utils/
│   │   ├── helpers.py
│   │   ├── validators.py
│   │   └── logger.py
│   └── database/
│       ├── db_connection.py
│       └── seed_data.py
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── signup.html
│   ├── personality_test.html
│   ├── hobbies.html
│   ├── communities.html
│   ├── community.html
│   ├── profile.html
│   ├── admin.html
│   ├── css/
│   ├── js/
│   └── assets/
├── logs/
├── data/
└── docs/
```

---

## Running with Docker

Go to the project root directory:

```bash
cd /Users/alitoksoy/Downloads/friendzone
```

Start the project with Docker Compose:

```bash
docker compose up --build
```

Services:

```text
Frontend: http://localhost:8080
Backend:  http://localhost:5001
Postgres: localhost:5433
Admin:    http://localhost:8080/admin.html
```

Backend health check:

```text
http://localhost:5001/health
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

Stop Docker services:

```bash
docker compose down
```

Stop Docker services and remove volumes:

```bash
docker compose down -v
```

> Note: `docker compose down -v` removes PostgreSQL data as well. Registered users, messages, and database records will be deleted.

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

During startup, the backend:

1. Waits for PostgreSQL to become ready.
2. Checks migration setup.
3. Applies migrations.
4. Loads seed data.
5. Starts the Flask backend with Socket.IO support.

### Frontend

```text
Container: friendzone_frontend
Image: nginx:alpine
Port: 8080 -> 80
```

---

## Running Locally Without Docker

### 1. Create a virtual environment

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

### 4. Create `.env`

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
flask db init
flask db migrate -m "initial migration"
flask db upgrade
```

### 6. Load seed data

```bash
python -m backend.database.seed_data
```

Expected output:

```text
Seed completed successfully.
Communities: 21
Users: 8
Chat rooms: 21
```

### 7. Start backend

```bash
python -m backend.app
```

### 8. Start frontend

Open a new terminal:

```bash
cd frontend
python3 -m http.server 5500
```

Frontend:

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

## OpenAI / AI Assistant Usage

Without an API key:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

The system will use fallback suggestions.

With an API key:

```env
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini
```

Docker Compose environment:

```yaml
OPENAI_API_KEY: ${OPENAI_API_KEY:-}
OPENAI_MODEL: ${OPENAI_MODEL:-gpt-4o-mini}
```

AI endpoint:

```http
POST /api/assistant/community-suggestion
```

Example request body:

```json
{
  "community_id": 1
}
```

Example fallback response:

```json
{
  "success": true,
  "message": "AI suggestions generated.",
  "data": {
    "source": "fallback",
    "model": null,
    "suggestions": [
      "Icebreaker question: What motivated you the most today?",
      "Mini game: Everyone describes themselves with 3 emojis.",
      "Conversation topic: How to build new friendships in university life."
    ]
  }
}
```

Example OpenAI response:

```json
{
  "success": true,
  "message": "AI suggestions generated.",
  "data": {
    "source": "openai",
    "model": "gpt-4o-mini",
    "suggestions": []
  }
}
```

---

## API Endpoints

### Auth

```http
POST /api/auth/register
POST /api/auth/login
```

### Test

```http
POST /api/test/personality
GET  /api/test/hobbies
POST /api/test/hobbies
```

### Community

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

### User

```http
GET  /api/user/profile/:id
POST /api/user/profile/update
GET  /api/user/similar/:id
```

### Admin

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

### Client -> Server

```text
join_room
leave_room
typing
stop_typing
add_reaction
```

### Server -> Client

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

## Database Models

### users

- id
- name
- email
- password_hash
- university
- department
- year
- bio
- personality_type
- hobbies
- is_test_completed
- is_active
- created_at
- updated_at

### communities

- id
- name
- description
- category
- tags
- compatibility_score
- is_active
- max_members
- created_by
- created_at
- updated_at

### community_members

- id
- community_id
- user_id
- role
- joined_at
- is_active
- last_active
- message_count

### chat_messages

- id
- community_id
- user_id
- content
- message_type
- timestamp
- edited
- edited_at
- reply_to
- reactions

### chat_rooms

- id
- community_id
- name
- description
- is_active
- max_members
- current_members
- settings
- created_at
- last_activity

### chat_user_status

- id
- user_id
- room_id
- is_online
- last_seen
- socket_id
- total_messages

---

## Seed Data

Run seed script:

```bash
python -m backend.database.seed_data
```

Seed data creates:

- 21 communities
- General Chat community
- Technology communities
- Career communities
- Art communities
- Sports communities
- Social communities
- Health & Lifestyle communities
- Demo users
- Chat rooms for each community

Example communities:

```text
General Chat
Artificial Intelligence and Data Science
Cloud & DevOps Club
Cybersecurity Community
Web and Mobile Development
Startup and Entrepreneurship
Fitness and Running Club
Psychology and Personal Development
```

---

## Demo Flow

1. Start the application with Docker:

```bash
docker compose up --build
```

2. Open the frontend:

```text
http://localhost:8080
```

3. Create a new user:

```text
signup.html
```

4. Use a `.edu.tr` email address:

```text
ali.toksoy@mf.karaelmas.edu.tr
```

5. Complete the personality test.

6. Select hobbies.

7. Let the system assign you to a community.

8. Open the community chat.

9. Send a message.

10. Add emoji reactions.

11. Click the AI suggestion button.

12. Check statistics from the admin panel:

```text
http://localhost:8080/admin.html
```

---

## Acceptance Tests

The following scenarios should work:

- User can register with a `.edu.tr` email address.
- Gmail, Hotmail, and similar non-university emails are rejected.
- User is redirected to the personality test after registration.
- Personality test contains 24 questions.
- Each question uses a 1–5 Likert scale.
- MBTI result is calculated.
- MBTI result appears in the user profile.
- Hobby selection requires at least 3 selections.
- Hobby selection enforces the maximum selection limit.
- Hobbies are saved to the backend.
- User is automatically assigned to a community after hobby submission.
- User’s joined communities appear in the sidebar.
- Recommended communities appear on the communities page.
- Join community button works.
- New communities can be created.
- A chat room is created when a community is created.
- Users can send chat messages.
- Messages are saved to the database.
- Socket.IO broadcasts messages in real time.
- Typing indicator works.
- Emoji reactions update in real time.
- AI assistant returns suggestions.
- AI assistant returns fallback suggestions when OpenAI API key is missing.
- Profile can be updated.
- Admin panel shows statistics.
- Admin panel Chart.js charts work.
- Docker Compose starts the full project.

---

## Common Errors and Fixes

### 1. `zsh: command not found: python`

On macOS, use `python3` instead:

```bash
python3 -m venv venv
```

---

### 2. `No module named backend`

Run the command from the project root:

```bash
cd /Users/alitoksoy/Downloads/friendzone
python -m backend.app
```

---

### 3. `Could not import backend.backend.app`

You are probably inside the `backend/` folder. Return to the project root:

```bash
cd ..
export FLASK_APP=backend.app
```

---

### 4. `column users.bio does not exist`

The database may be using an old migration.

For local development reset:

```bash
dropdb friendzone_db
createdb friendzone_db
flask db upgrade
python -m backend.database.seed_data
```

For Docker reset:

```bash
docker compose down -v
docker compose up --build
```

---

### 5. `Failed to fetch`

Check:

```text
Is backend running? http://localhost:5001/health
Is frontend running through Docker? http://localhost:8080
Is API_BASE correct? frontend/js/main.js should use http://localhost:5001.
Is CORS configured correctly?
```

Clear browser storage:

```js
localStorage.clear();
sessionStorage.clear();
location.reload();
```

---

### 6. Admin login does not work

Default admin credentials:

```text
admin
admin123
```

Docker backend environment should include:

```yaml
ADMIN_USERNAME: admin
ADMIN_PASSWORD: admin123
```

You can test with:

```bash
curl -u admin:admin123 http://localhost:5001/admin/api/dashboard/stats
```

---

### 7. Docker backend `permission denied`

Dockerfile should start backend with:

```dockerfile
CMD ["bash", "/app/start.sh"]
```

---

### 8. Messages only appear after refreshing the page

Backend should be started with:

```bash
python -m backend.app
```

Do not use `flask run` for Socket.IO mode.

If running with Docker, Socket.IO is already started correctly.

---

### 9. Docker database is different from local database

Docker uses its own PostgreSQL volume. Users created in the local database will not appear in Docker.

To reset Docker database:

```bash
docker compose down -v
docker compose up --build
```

---

## Security Notes

- Passwords are never stored in plain text.
- Passwords are hashed with Bcrypt.
- JWT secret is stored in environment variables.
- `.env` must not be committed to GitHub.
- `.env.example` can be shared safely.
- Admin credentials are loaded from environment variables.
- API keys must not be hardcoded.
- CORS should only allow trusted frontend origins.
- Chat messages are rendered using `textContent` on the frontend to reduce XSS risk.

---

## Development Notes

This project is a portfolio and learning project that is close to production-ready structure.

Before deploying to a real production environment, the following improvements are recommended:

- HTTPS reverse proxy
- Refresh token support
- Rate limiting
- Email verification
- Password reset
- Role-based access control
- WebSocket authentication token validation
- Automated tests
- CI/CD pipeline
- Cloud deployment
- Monitoring and metrics
- Structured logging
- Object storage support for profile images

---

## Future Improvements

- Private messaging between users
- Profile image upload
- Community moderation panel
- Message delete/edit support
- Notification system
- Event creation and RSVP
- More advanced ML-based recommendation engine
- K-means user segmentation
- Semantic embedding-based similarity engine
- CSV export for admin panel
- Docker production profile
- GitHub Actions CI/CD pipeline

---

## License

This project was developed for education, portfolio building, and technical interview preparation.