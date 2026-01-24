# NOVA‑BOT‑STUDIO‑BACKEND  
![Node.js](https://img.shields.io/badge/Node.js-18.x-green) ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue) ![License](https://img.shields.io/badge/License-MIT-yellow) ![Build](https://img.shields.io/github/actions/workflow/status/GURUDAS-DEV/NOVA-BOT-STUDIO-BACKEND/ci.yml?branch=main) ![Coverage](https://img.shields.io/codecov/c/github/GURUDAS-DEV/NOVA-BOT-STUDIO-BACKEND) ![Docker](https://img.shields.io/badge/Docker-✓-blue) ![Version](https://img.shields.io/github/v/tag/GURUDAS-DEV/NOVA-BOT-STUDIO-BACKEND?label=version)

**A modular, TypeScript‑based backend for managing AI bots, API keys, user authentication, and bot analytics.**  

---  

## Overview  

NOVA‑BOT‑STUDIO‑BACKEND provides a clean, extensible framework for building and operating bot‑centric applications. It supports:

* **Bot lifecycle management** – create, update, delete, and run bots.  
* **AI feature toggling** – enable/disable advanced AI capabilities per bot.  
* **Secure API‑key handling** – generation, hashing, revocation with Redis‑backed caching.  
* **Robust authentication** – JWT‑based login/registration with refresh tokens and role‑based middleware.  
* **Bot analytics** – collect, store, and query usage metrics per bot.  
* **Multi‑database support** – PostgreSQL for relational data, MongoDB for flexible storage.  
* **Redis integration** – fast look‑ups for API‑key validation, session data, and real‑time website‑bot communication.  

Targeted at developers building SaaS bot platforms, internal automation tools, or any service that needs programmable bots with fine‑grained access control and insight into bot performance.  

---  

## Features  

| Feature | Description | Status |
|---------|-------------|--------|
| **Authentication** | JWT login, registration, refresh tokens, role‑based middleware. | ✅ Stable |
| **API‑Key Management** | Secure generation, hashing, revocation, Redis‑backed lookup. | ✅ Stable |
| **Bot Configuration** | CRUD for bot metadata, custom prompts, and system settings. | ✅ Stable |
| **AI Feature Management** | Toggle AI modules (e.g., text‑enhancer, validator) per bot. | ✅ Stable |
| **Advanced Bot Management** | Lifecycle helpers, scheduled clean‑up, versioning. | ✅ Stable |
| **Website Bot Communication** | Real‑time interaction endpoints backed by Redis for sub‑millisecond latency. | ✅ Stable |
| **Bot Analytics** | Capture events (messages sent, errors, usage time) and expose aggregated stats. | ✅ Stable |
| **Multi‑DB Support** | PostgreSQL (`pg`) & MongoDB (`mongoose`). | ✅ Stable |
| **Redis Caching** | Centralised client for API‑key validation, session storage, and bot messaging. | ✅ Stable |
| **CORS Configuration** | Whitelisted origins with credentials support. | ✅ Stable |
| **Testing Utilities** | Ready‑made test router and controller for CI pipelines. | ✅ Stable |
| **System Prompt Utilities** | Re‑usable helpers (`TextEnhancer`, `TextValidator`, `ExampleValidator`, `Website`) for building robust AI prompts. | ✅ Stable |

---  

## Tech Stack  

| Layer | Technology | Reason |
|-------|------------|--------|
| **Runtime** | Node.js 18 LTS | Modern async APIs, wide ecosystem |
| **Language** | TypeScript 5 | Static typing, IDE support |
| **Web Framework** | Express 4 | Minimalist, middleware‑centric |
| **Database** | PostgreSQL (`pg`) & MongoDB (`mongoose`) | Relational + flexible document storage |
| **Cache** | Redis (`ioredis`) | Fast key‑value look‑ups for API‑key validation & bot messaging |
| **Authentication** | `jsonwebtoken`, `bcrypt` | Secure token handling |
| **Validation / Sanitisation** | `class-validator`, custom sanitiser helpers | Prevent injection attacks |
| **Testing** | Jest & Supertest | Unit & integration testing |
| **Containerisation** | Docker | Consistent dev/prod environments |
| **CI/CD** | GitHub Actions | Automated lint, test, build pipelines |
| **Utilities** | System Prompt utils (`TextEnhancer`, `TextValidator`, `ExampleValidator`, `Website`) | Reusable AI‑prompt processing helpers |

---  

## Architecture  

```
src/
├─ controller/            # Request handlers (business logic)
│   ├─ authentication/
│   ├─ API_Key_Management/
│   ├─ Bot_Management/
│   ├─ Bot_Configration/
│   ├─ AI_Feature_Management/
│   ├─ AdvanceBotManagement/
│   ├─ BotAnalyticsManagement/
│   ├─ BotCommunication/
│   │   └─ Website/
│   └─ Testing/
├─ Router/                # Express routers – one per domain
│   ├─ Authentication/
│   ├─ API_Key_Management/
│   ├─ Bot_Management/
│   ├─ Bot_Configration/
│   ├─ AI_Feature_Management/
│   ├─ Advance_Bot_Management/
│   ├─ BotAnalytics/
│   ├─ BotCommunication/
│   │   └─ Website/
│   └─ Testing/
├─ Models/                # Mongoose / TypeORM schemas
├─ utils/
│   ├─ JWT/               # Token generation & validation
│   ├─ System_Prompt/     # Prompt‑related helpers
│   ├─ helper/            # Miscellaneous utilities (API‑key, sanitising, etc.)
│   └─ types/             # Shared TypeScript types
├─ Database/              # DB connection wrappers (PostgreSQL & MongoDB)
├─ Redis/                 # Redis client singleton
├─ Middleware/            # Auth & access control middlewares
├─ Static/                # Assets (logo, etc.)
└─ index.ts               # Application entry point
```

* **Express** routes delegate to controllers, which interact with the data layer (PostgreSQL, MongoDB) and auxiliary services (Redis, JWT).  
* **Redis** is used as a fast cache for API‑key look‑ups, session storage, and real‑time bot messaging.  
* **JWT** tokens are signed with separate secrets for access and refresh tokens, enabling short‑lived access tokens and long‑lived refresh tokens stored in HTTP‑only cookies.  

---  

## Getting Started  

### Prerequisites  

| Tool | Minimum Version |
|------|-----------------|
| Node | 18.x |
| npm | 9.x (or Yarn 1.22+) |
| PostgreSQL | 13 |
| MongoDB | 5 |
| Redis | 6 |
| Docker (optional) | 20.10+ |

### Installation  

```bash
# 1️⃣ Clone the repository
git clone https://github.com/GURUDAS-DEV/NOVA-BOT-STUDIO-BACKEND.git
cd NOVA-BOT-STUDIO-BACKEND

# 2️⃣ Install dependencies
npm ci   # or `yarn install`

# 3️⃣ Prepare environment variables
cp .env.example .env
# Edit .env with your DB credentials, JWT secrets, etc.
```

### Database setup  

* **PostgreSQL** – The first run will automatically create required tables via the `pg` client.  
* **MongoDB** – Collections are created on demand; just ensure the database exists.

### Running locally (development)  

```bash
npm run dev   # uses ts-node-dev for hot‑reloading
```

### Building & running (production)  

```bash
npm run build
npm start
```

### Docker (recommended)  

```bash
# Build the image
docker build -t nova-bot-studio-backend .

# Run the container (exposes port 9000)
docker run -d -p 9000:9000 --env-file .env nova-bot-studio-backend
```

---  

## Configuration  

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | Port the Express server listens on | `9000` |
| `POSTGRES_URI` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/nova` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/nova` |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` |
| `JWT_ACCESS_SECRET` | Secret for access tokens | `supersecretaccess` |
| `JWT_REFRESH_SECRET` | Secret for refresh tokens | `supersecretrefresh` |
| `CORS_ORIGINS` | Comma‑separated list of allowed origins | `http://localhost:3000` |
| `API_KEY_SALT_ROUNDS` | Bcrypt salt rounds for API‑key hashing | `12` |
| `SESSION_TTL_SECONDS` | Redis TTL for session entries | `86400` |

**Example `.env` snippet**

```dotenv
PORT=9000
POSTGRES_URI=postgresql://postgres:password@localhost:5432/nova
MONGODB_URI=mongodb://localhost:27017/nova
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=yourAccessSecret
JWT_REFRESH_SECRET=yourRefreshSecret
CORS_ORIGINS=http://localhost:3000
API_KEY_SALT_ROUNDS=12
SESSION_TTL_SECONDS=86400
```

---  

## Usage  

### Health check  

```bash
curl http://localhost:9000/ping
# => {"message":"Pong!"}
```

### Register & login (TypeScript example)

```typescript
import axios from 'axios';

await axios.post('http://localhost:9000/api/auth/register', {
  email: 'dev@example.com',
  password: 'StrongP@ssw0rd',
});

const { data: loginRes } = await axios.post(
  'http://localhost:9000/api/auth/login',
  {
    email: 'dev@example.com',
    password: 'StrongP@ssw0rd',
  },
  { withCredentials: true }
);

const { accessToken, refreshToken } = loginRes;
```

### Call a protected endpoint  

```typescript
await axios.get('http://localhost:9000/api/bot/', {
  headers: { Cookie: `refreshToken=${refreshToken}` },
  withCredentials: true,
});
```

### Retrieve a Bot Configuration  

```typescript
await axios.get(
  'http://localhost:9000/api/botConfig/getConfig/12345',
  {
    headers: { Cookie: `refreshToken=${refreshToken}` },
    withCredentials: true,
  }
);
```

### Fetch Bot Analytics  

```typescript
await axios.get(
  'http://localhost:9000/api/botAnalytics/summary/12345',
  {
    headers: { Cookie: `refreshToken=${refreshToken}` },
    withCredentials: true,
  }
);
```

### Website Bot Communication (real‑time)  

```bash
POST http://localhost:9000/websiteBot/message
Content-Type: application/json

{
  "botId": "12345",
  "userMessage": "Hello!"
}
```

Response (example):

```json
{
  "reply": "Hi there! How can I assist you today?",
  "status": "success"
}
```

### Generate an API Key (protected)  

```typescript
await axios.post(
  'http://localhost:9000/api/APIKeyManagement',
  { name: 'My Service' },
  {
    headers: { Cookie: `refreshToken=${refreshToken}` },
    withCredentials: true,
  }
);
```

The response contains the raw API key (shown only once) and its hashed representation stored in Redis.

---  

## API Documentation  

> **Base URL:** `http://<host>:<port>/api/`  

| Category | Method | Endpoint | Description |
|----------|--------|----------|-------------|
| **Auth** | `POST` | `/auth/register` | Register a new user |
| | `POST` | `/auth/login` | Login and receive JWT cookies |
| | `POST` | `/auth/refresh-token` | Refresh access token |
| **API‑Key** | `POST` | `/APIKeyManagement` | Generate a new API key (protected) |
| | `GET` | `/APIKeyManagement` | List all API keys for the caller |
| | `DELETE` | `/APIKeyManagement/:id` | Revoke an API key |
| **Bot Config** | `POST` | `/botConfig/` | Create bot configuration |
| | `GET` | `/botConfig/` | List bot configurations |
| | `GET` | `/botConfig/getConfig/:botId` | Fetch a specific bot’s configuration (protected) |
| | `PUT` | `/botConfig/:id` | Update a bot configuration |
| | `DELETE` | `/botConfig/:id` | Delete a bot configuration |
| **Bot Management** | `GET` | `/bot/` | Retrieve bots owned by the authenticated user |
| | `POST` | `/bot/` | Deploy a new bot instance |
| | `DELETE` | `/bot/:id` | Remove a bot |
| **AI Feature Management** | `PATCH` | `/aiFeatures/:botId` | Enable/disable AI modules for a bot |
| **Advanced Bot Management** | `POST` | `/advanceBotController/start` | Start a bot with advanced lifecycle options |
| | `POST` | `/advanceBotController/stop` | Stop a running bot |
| **Website Bot** | `POST` | `/websiteBot/message` | Send a message to a website‑embedded bot and receive a reply |
| | `GET` | `/websiteBot/status/:botId` | Get current status of the website bot |
| **Bot Analytics** | `GET` | `/botAnalytics/summary/:botId` | Retrieve aggregated usage stats for a bot |
| | `GET` | `/botAnalytics/events/:botId` | List raw analytics events (protected) |
| **Testing** | `GET` | `/testing/ping` | Simple health check for test environment |

### Authentication  

All routes under `/api/` (except `/auth/*`) require a valid `refreshToken` cookie. The `authMiddleware` validates the JWT, attaches `req.user`, and enforces role‑based access when configured.

### Error format  

```json
{
  "error": "InvalidCredentials",
  "message": "Email or password is incorrect",
  "statusCode": 401
}
```

---  

## Development  

### Setup  

```bash
npm run dev   # starts ts-node-dev with hot reload
```

### Testing  

```bash
npm test
```

### Linting & Formatting  

```bash
npm run lint          # ESLint
npm run format        # Prettier
```

### Debugging Tips  

* Enable request logging: `DEBUG=express:* npm run dev`.  
* Inspect Redis keys with `redis-cli` (e.g., `KEYS apiKey:*` or `KEYS websiteBot:*`).  
* Use VS Code’s “Attach to Node Process” for step‑through debugging of TypeScript sources.  

---  

## Deployment  

### Docker (production)  

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
ENV NODE_ENV=production
EXPOSE 9000
CMD ["node", "dist/index.js"]
```

Build & run:

```bash
docker build -t nova-bot-studio-backend .
docker run -d -p 9000:9000 --env-file .env nova-bot-studio-backend
```

### Kubernetes (quick reference)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nova-bot-studio-backend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nova-bot-studio-backend
  template:
    metadata:
      labels:
        app: nova-bot-st