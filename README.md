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
* **Controlled bots** – lightweight, website‑hosted bots with a dedicated schema and management endpoints.  

Targeted at developers building SaaS bot platforms, internal automation tools, or any service that needs programmable bots with fine‑grained access control and insight into bot performance.  

---  

## Features  

| Feature | Description | Status |
|---------|-------------|--------|
| **Authentication** | JWT login, registration, refresh tokens, role‑based middleware. | ✅ Stable |
| **API‑Key Management** | Secure generation, hashing, revocation, Redis‑backed lookup. | ✅ Stable |
| **Bot Configuration** | CRUD for bot metadata, custom prompts, and system settings. | ✅ Stable |
| **AI Feature Management** | Toggle AI modules (e.g., `TextEnhancer`, `TextValidator`) per bot. | ✅ Stable |
| **Advanced Bot Management** | Lifecycle helpers, scheduled clean‑up, versioning. | ✅ Stable |
| **Website Bot Communication** | Real‑time interaction endpoints backed by Redis for sub‑millisecond latency. Returns enriched payloads with navigation options and message arrays. | ✅ Stable |
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
├─ Static/                    # Assets (logo, etc.)
├─ index.ts                   # Application entry point
└─ tsconfig.json
```

* **Express routers** delegate to controllers, which interact with the data layer (PostgreSQL, MongoDB) and auxiliary services (Redis, JWT).  
* **Redis** is used as a fast cache for API‑key look‑ups, session storage, and real‑time bot messaging.  
* **JWT** tokens are signed with separate secrets for access and refresh tokens, enabling short‑lived access tokens and long‑lived refresh tokens stored in HTTP‑only cookies.  
* **ControlledBotModel** stores lightweight bots that run entirely on the website layer; the `platform` field (default `Website`) and lifecycle status are part of the schema.  

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
docker run -d -p 9000:9000 --env-file .env --restart unless-stopped nova-bot-studio-backend
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
  'http://localhost:9000/api/bot/setupWebsiteControlledStyleBotConfig',
  {
    botId: '64b2e3d4f6a7c9e0b1c2d3e4',
    style: {
      theme: 'light',
      bubbleColor: '#007bff',
      // any other UI‑related settings
    },
  },
  {
    headers: { Cookie: `refreshToken=${refreshToken}` },
    withCredentials: true,
  }
);
```

### Retrieve a controlled bot by ID  

```bash
GET http://localhost:9000/api/bot/getControlledBotById/64b2e3d4f6a7c9e0b1c2
```

### Interact with a website‑controlled bot (enriched response)

```typescript
const { data } = await axios.post(
  'http://localhost:9000/api/bot/communicateWebsiteBot',
  {
    botId: '64b2e3d4f6a7c9e0b1c2d3e4',
    userMessage: 'How can I reset my password?',
  },
  {
    headers: { Cookie: `refreshToken=${refreshToken}` },
    withCredentials: true,
  }
);

/*
  Example enriched payload:
  {
    "messages": [
      { "role": "assistant", "content": "Sure, I can help with that." },
      { "role": "assistant", "content": "Please click the button below." }
    ],
    "navigationOptions": [
      { "label": "Reset Password", "action": "reset_password" },
      { "label": "Contact Support", "action": "contact_support" }
    ],
    "sessionId": "a1b2c3d4e5f6"
  }
*/
```

---  

## API Documentation  

### Authentication  

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/auth/register` | Register a new user (email + password). | ❌ |
| `POST` | `/api/auth/login` | Login and receive access/refresh tokens (set as HTTP‑only cookies). | ❌ |
| `POST` | `/api/auth/refresh-token` | Refresh an expired access token using the refresh token cookie. | ❌ |
| `POST` | `/api/auth/logout` | Invalidate refresh token and clear cookies. | ✅ (requires valid refresh token) |

### API‑Key Management  

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/api-key/generate` | Generate a new API key for the authenticated user. | ✅ |
| `GET` | `/api/api-key/list` | List all active API keys for the user. | ✅ |
| `DELETE` | `/api/api-key/revoke/:keyId` | Revoke a specific API key. | ✅ |

### Bot Management  

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/bot/create` | Create a new bot (standard or controlled). | ✅ |
| `GET` | `/api/bot/` | Retrieve all bots owned by the authenticated user. | ✅ |
| `GET` | `/api/bot/:botId` | Get details of a specific bot. | ✅ |
| `PUT` | `/api/bot/:botId` | Update bot configuration (prompts, system settings, etc.). | ✅ |
| `DELETE` | `/api/bot/:botId` | Delete a bot permanently. | ✅ |
| `POST` | `/api/bot/createControlledBot` | Shortcut for creating a website‑controlled bot. | ✅ |
| `POST` | `/api/bot/setupWebsiteControlledStyleBotConfig` | Apply UI style configuration to a controlled bot. | ✅ |
| `GET` | `/api/bot/getControlledBotById/:botId` | Retrieve a controlled bot’s stored schema. | ✅ |
| `POST` | `/api/bot/communicateWebsiteBot` | Send a user message to a website‑controlled bot and receive enriched response. | ✅ |

### AI Feature Management  

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/ai-features` | List all AI features and their current status per bot. | ✅ |
| `PATCH` | `/api/ai-features/:botId` | Enable/disable specific AI modules for a bot. | ✅ |

### Bot Analytics  

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/analytics/:botId` | Retrieve aggregated usage statistics for a bot. | ✅ |
| `GET` | `/api/analytics/:botId/events` | List raw event logs (messages, errors, timestamps). | ✅ |

### Common Response Format  

All successful responses follow:

```json
{
  "status": "success",
  "data": { /* endpoint‑specific payload */ }
}
```

Error responses:

```json
{
  "status": "error",
  "message": "Human‑readable error description",
  "code": "ERROR_CODE"
}
```

