# NOVA‑BOT‑STUDIO‑BACKEND  

![Node.js](https://img.shields.io/badge/Node.js-18.x-green) ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue) ![License](https://img.shields.io/badge/License-MIT-yellow) ![Build](https://img.shields.io/github/actions/workflow/status/GURUDAS-DEV/NOVA-BOT-STUDIO-BACKEND/ci.yml?branch=main) ![Coverage](https://img.shields.io/codecov/c/github/GURUDAS-DEV/NOVA-BOT-STUDIO-BACKEND) ![Docker](https://img.shields.io/badge/Docker-✓-blue) ![Version](https://img.shields.io/github/v/tag/GURUDAS-DEV/NOVA-BOT-STUDIO-BACKEND?label=version)

**A modular, TypeScript‑based backend for managing AI bots, API keys, user authentication, and bot analytics.**  

---  

## Overview  

NOVA‑BOT‑STUDIO‑BACKEND provides a clean, extensible framework for building and operating bot‑centric applications. It offers:

* **Bot lifecycle management** – create, update, delete, and run bots.  
* **AI feature toggling** – enable/disable advanced AI capabilities per bot.  
* **Secure API‑key handling** – generation, hashing, revocation with Redis‑backed caching.  
* **Robust authentication** – JWT‑based login/registration with refresh tokens and role‑based middleware.  
* **Bot analytics** – collect, store, and query usage metrics per bot.  
* **Multi‑database support** – PostgreSQL for relational data, MongoDB for flexible storage.  
* **Redis integration** – fast look‑ups for API‑key validation, session data, and real‑time website‑bot communication.  
* **Controlled bots** – lightweight, website‑hosted bots with a dedicated schema and management endpoints.  

Targeted at developers building SaaS bot platforms, internal automation tools, or any service that needs programmable bots with fine‑grained access control and insight into bot performance.  

---  

## Features  

| Feature | Description | Status |
|---------|-------------|--------|
| **Authentication** | JWT login, registration, refresh tokens, role‑based middleware. | ✅ Stable |
| **API‑Key Management** | Secure generation, hashing, revocation, Redis‑backed lookup. | ✅ Stable |
| **Bot Configuration** | CRUD for bot metadata, custom prompts, and system settings. | ✅ Stable |
| **AI Feature Management** | Toggle AI modules (`TextEnhancer`, `TextValidator`, etc.) per bot. | ✅ Stable |
| **Advanced Bot Management** | Lifecycle helpers, scheduled clean‑up, versioning. | ✅ Stable |
| **Website Bot Communication** | Real‑time interaction endpoints backed by Redis for sub‑millisecond latency. | ✅ Stable |
| **Controlled Bot Management** | Create lightweight “website‑controlled” bots, configure style, and retrieve details via dedicated routes. | ✅ Stable |
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
├─ controller/                # Request handlers (business logic)
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
├─ Router/                    # Express routers – one per domain
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
├─ Models/                    # Mongoose / TypeORM schemas
│   ├─ BotStructure.ts
│   ├─ BotConfiguration.ts
│   ├─ ControlledBotSchema.ts   ← schema for website‑controlled bots
│   └─ … (other models)
├─ utils/
│   ├─ JWT/                   # Token generation & validation
│   ├─ System_Prompt/         # Prompt‑related helpers
│   ├─ helper/                # Misc. utilities (API‑key, sanitising, etc.)
│   └─ types/                 # Shared TypeScript types
├─ Database/                  # DB connection wrappers (PostgreSQL & MongoDB)
├─ Redis/                     # Redis client singleton
├─ Middleware/                # Auth & access‑control middlewares
├─ Schedulers/                # Periodic jobs (e.g., DeleteBotScheduler)
├─ Static/                    # Assets (logo, etc.)
├─ index.ts                   # Application entry point
└─ tsconfig.json
```

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

# 3️⃣ Create environment file
cp .env.example .env
# Edit .env with your DB credentials, JWT secrets, etc.
```

### Database setup  

* **PostgreSQL** – Tables are created automatically on first run via the `pg` client.  
* **MongoDB** – Collections are created on demand; ensure the database exists.

### Running locally (development)  

```bash
npm run dev   # uses ts-node-dev for hot‑reloading
```

The API will be available at `http://localhost:9000`.

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
docker run -d -p 9000:9000 \
  --env-file .env \
  --restart unless-stopped \
  nova-bot-studio-backend
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
| `MAX_POOL_SIZE` | PostgreSQL connection pool size | `20` |
| `LOG_LEVEL` | Application log level (`error`, `warn`, `info`, `debug`) | `info` |

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
MAX_POOL_SIZE=20
LOG_LEVEL=info
```

---  

## Usage  

### Health check  

```bash
curl http://localhost:9000/ping
# => {"message":"Pong!"}
```

### Register & login (TypeScript)

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

### Create a **controlled website bot**

```typescript
await axios.post(
  'http://localhost:9000/api/bot/createControlledBot',
  {
    name: 'SupportBot',
    userId: '64a1f2c9e5b6c8d1f0a2b3c4',
    platform: 'Website',          // optional – defaults to Website
    type: 'CONTROLLED',
    // entryNodeId can be omitted for a fresh bot
  },
  {
    headers: { Cookie: `refreshToken=${refreshToken}` },
    withCredentials: true,
  }
);
```

### Configure website‑controlled bot style  

```typescript
await axios.post(
  'http://localhost:9000/api/bot/updateControlledBotStyle',
  {
    botId: '64b2d3e4f5a6b7c8d9e0f1a2',
    style: {
      primaryColor: '#4A90E2',
      bubbleShape: 'rounded',
      welcomeMessage: 'Hello! How can I help you today?'
    }
  },
  {
    headers: { Cookie: `refreshToken=${refreshToken}` },
    withCredentials: true,
  }
);
```

---  

## API Documentation  

All routes are prefixed with `/api`. The API follows REST conventions and returns JSON.

### Authentication  

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/auth/register` | Register a new user (email + password). | ❌ |
| `POST` | `/auth/login` | Login and receive `accessToken` & `refreshToken`. | ❌ |
| `POST` | `/auth/refresh` | Refresh an expired access token. | ✅ (refresh token cookie) |
| `POST` | `/auth/logout` | Invalidate refresh token & clear cookie. | ✅ |

### API‑Key Management  

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/key/generate` | Generate a new API key for the authenticated user. | ✅ |
| `GET` | `/api/key` | List all API keys belonging to the user. | ✅ |
| `DELETE` | `/api/key/:keyId` | Revoke a specific API key. | ✅ |

### Bot Management  

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/bot` | Create a new bot (standard or controlled). | ✅ |
| `GET` | `/api/bot/:botId` | Retrieve bot details. | ✅ |
| `PATCH` | `/api/bot/:botId` | Update bot metadata or prompts. | ✅ |
| `DELETE` | `/api/bot/:botId` | Delete a bot (soft‑delete, scheduled cleanup). | ✅ |
| `POST` | `/api/bot/createControlledBot` | Shortcut for creating a website‑controlled bot. | ✅ |
| `POST` | `/api/bot/updateControlledBotStyle` | Update visual style of a controlled bot. | ✅ |

### AI Feature Management  

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `PATCH` | `/api/bot/:botId/ai-features` | Enable/disable AI modules (`TextEnhancer`, `TextValidator`, …). | ✅ |

### Bot Analytics  

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/analytics/bot/:botId` | Retrieve aggregated usage statistics for a bot. | ✅ |
| `GET` | `/api/analytics/user/:userId` | Get analytics across all bots owned by a user. | ✅ |

### Website Bot Communication  

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/website/bot/:botId/message` | Send a message to a website‑controlled bot and receive enriched response. | ✅ |
| `GET` | `/api/website/bot/:botId/status` | Get real‑time status (online/offline, last activity). | ✅ |

> **Note:** All protected routes require the `refreshToken` cookie (set on login) or a valid `Authorization: Bearer <accessToken>` header.

---  

## Development  

### Setting up the development environment  

```bash
# Install dev dependencies (already done in the main install step)
npm ci

# Run linting
npm run lint

# Run tests
npm test
```

### Running tests  

```bash
npm run test          # Jest unit & integration tests
npm run test:watch    # Watch mode
```

### Code style  

* **Prettier** – automatically formats files (`npm run format`).  
* **ESLint** – enforces best practices (`npm run lint`).  

### Debugging  

* Use `DEBUG=app:* npm run dev` to enable verbose logging.  
* The `LOG_LEVEL` env variable can be set to `debug` for more granular output.

---  

## Deployment  

### Production build  

```bash
npm run build   # Compiles TypeScript to ./dist
npm start       # Runs compiled code with Node
```

### Docker deployment (recommended)  

```bash
docker build -t nova-bot-studio-backend .
docker run -d -p 9000:9000 \
  --env-file .env \
  --restart unless-stopped \
  nova-bot-studio-backend
```

### Cloud platforms  

* **Heroku / Render** – Use the Dockerfile or the `npm start` command.  
* **AWS ECS / Fargate** – Deploy the Docker image; configure environment variables via task definition.  

### Performance considerations  

* Enable **Redis** for API‑key look‑ups and session storage to minimise DB round‑trips.  
* Tune PostgreSQL `MAX_POOL_SIZE` according to expected concurrency.  
* Use the **DeleteBotScheduler** to purge soft‑deleted bots after 30 days.

---  

## Contributing  

We welcome contributions! Please follow