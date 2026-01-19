# NOVA‑BOT‑STUDIO‑BACKEND
![Node.js](https://img.shields.io/badge/Node.js-18.x-green) ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue) ![License](https://img.shields.io/badge/License-MIT-yellow) ![Build](https://img.shields.io/github/actions/workflow/status/GURUDAS-DEV/NOVA-BOT-STUDIO-BACKEND/ci.yml?branch=main) ![Coverage](https://img.shields.io/codecov/c/github/GURUDAS-DEV/NOVA-BOT-STUDIO-BACKEND) ![Docker](https://img.shields.io/badge/Docker-✓-blue)

**A modular, TypeScript‑based backend for managing AI bots, API keys, user authentication, and bot analytics.**  

---  

## Overview
NOVA‑BOT‑STUDIO‑BACKEND provides a clean, extensible framework for building and operating bot‑centric applications. It supports:

* **Bot lifecycle management** – create, update, delete, and run bots.  
* **AI feature toggling** – enable/disable advanced AI capabilities per bot.  
* **Secure API‑key handling** – generation, hashing, and revocation.  
* **Robust authentication** – JWT‑based login/registration with refresh tokens.  
* **Bot analytics** – collect, store, and query usage metrics per bot.  
* **Multi‑database support** – PostgreSQL for relational data, MongoDB for flexible storage.  
* **Redis caching** – fast look‑ups for API‑key validation, session data, and website‑bot communication.  

Targeted at developers building SaaS bot platforms, internal automation tools, or any service that needs programmable bots with fine‑grained access control and insight into bot performance.

---  

## Features
| Feature | Description | Status |
|---------|-------------|--------|
| **Authentication** | JWT login, registration, refresh tokens, role‑based middleware. | ✅ Stable |
| **API‑Key Management** | Secure generation, hashing, revocation, Redis‑backed lookup. | ✅ Stable |
| **Bot Configuration** | CRUD for bot metadata, custom prompts, and system settings. | ✅ Stable |
| **Bot Configuration Retrieval** | `GET /botConfig/getConfig/:botId` – fetch a bot’s stored configuration (protected). | ✅ Stable |
| **AI Feature Management** | Toggle AI modules (e.g., text‑enhancer, validator) per bot. | ✅ Stable |
| **Advanced Bot Management** | Lifecycle helpers, scheduled clean‑up, versioning. | ✅ Stable |
| **Website Bot Communication** | Dedicated router (`/websiteBot/`) for real‑time website‑bot interactions, now backed by Redis for low‑latency messaging. | ✅ Stable |
| **Redis Integration** | Centralised Redis client for caching API keys, session data, and bot‑communication payloads. | ✅ Stable |
| **Bot Analytics** | Capture events (messages sent, errors, usage time) and expose aggregated stats via `/botAnalytics/` endpoints. | ✅ Stable |
| **Multi‑DB Support** | PostgreSQL (via `pg`) & MongoDB (via `mongoose`) – both initialized on server start. | ✅ Stable |
| **CORS Configuration** | Whitelisted origins (`http://localhost:3000`) with credentials support. | ✅ Stable |
| **Testing Utilities** | Ready‑made test router and controller for CI pipelines. | ✅ Stable |

---  

## Tech Stack
| Layer | Technology | Reason |
|-------|------------|--------|
| **Runtime** | Node.js 18 LTS | Modern async APIs, wide ecosystem |
| **Language** | TypeScript 5 | Static typing, IDE support |
| **Web Framework** | Express 4 | Minimalist, middleware‑centric |
| **Database** | PostgreSQL (via `pg`) & MongoDB (via `mongoose`) | Relational + flexible document storage |
| **Cache** | Redis (via `ioredis`) | Fast key‑value look‑ups for API‑key validation & bot messaging |
| **Authentication** | `jsonwebtoken`, `bcrypt` | Secure token handling |
| **Validation / Sanitisation** | `class-validator`, custom sanitiser helpers | Prevent injection attacks |
| **Testing** | Jest & Supertest (dev dependencies) | Unit & integration testing |
| **Containerisation** | Docker (optional) | Consistent dev/prod environments |
| **CI/CD** | GitHub Actions (lint, test, build) | Automated quality gates |
| **Utilities** | System Prompt utils (`TextEnhancer`, `TextValidator`, `ExampleValidator`, `Website`) | Reusable AI‑prompt processing helpers |

---  

## Architecture
```
/
├─ Database/                # PostgreSQL & MongoDB init helpers
├─ Redis/                   # Redis client singleton (used by API‑key & website‑bot layers)
├─ Email/                   # HTML email templates
├─ Middleware/              # auth & access guards
├─ Models/                  # Mongoose schemas & TypeORM entities
│   ├─ BotAnalytics.ts
│   └─ (other models)
├─ Router/                  # Feature‑specific routers
│   ├─ Authentication/
│   ├─ API_Key_Management/
│   ├─ Bot_Management/
│   ├─ Bot_Configration/
│   ├─ AI_Feature_Management/
│   ├─ Advance_Bot_Management/
│   ├─ BotAnalytics/
│   ├─ CommunicationWithBot/
│   │   └─ Website/
│   └─ Testing/
├─ controller/              # Business logic per feature
│   ├─ authentication/
│   ├─ AI_Feature_Management/
│   ├─ API_Key_Management/
│   ├─ AdvanceBotManagement/
│   ├─ BotAnalyticsManagement/
│   ├─ BotConfigrationController/
│   ├─ Bot_Management/
│   └─ Testing/
├─ utils/                   # Helpers (JWT, validation, system‑prompt utils, etc.)
├─ Static/                  # Assets (logo, etc.)
├─ index.ts                 # Server bootstrap
└─ .env.example             # Template for environment variables
```

* **Entry point (`index.ts`)** – sets up CORS, cookie parser, JSON body parsing, initializes DBs, connects Redis, registers routers, and starts the HTTP server.  
* **Routers** – each feature lives in its own router file, mounted under a versioned `/api/` namespace.  
* **Controllers** – thin layers that orchestrate service calls, keeping routers declarative.  
* **Middleware** – protects routes (`accessMiddleware`, `authMiddleware`).  
* **Redis** – powers both API‑key caching *and* the real‑time website‑bot communication channel, enabling sub‑millisecond message round‑trips.  

---  

## Installation
### Prerequisites
| Tool | Minimum Version |
|------|-----------------|
| Node | 18.x |
| npm | 9.x (or Yarn 1.22+) |
| PostgreSQL | 13 |
| MongoDB | 5 |
| Redis | 6 |
| Docker (optional) | 20.10+ |

### Steps
```bash
# 1️⃣ Clone the repo
git clone https://github.com/GURUDAS-DEV/NOVA-BOT-STUDIO-BACKEND.git
cd NOVA-BOT-STUDIO-BACKEND

# 2️⃣ Install dependencies
npm ci   # or `yarn install`

# 3️⃣ Set up environment variables
cp .env.example .env   # then edit .env with your DB credentials, JWT secret, etc.

# 4️⃣ Initialise databases (run migrations if needed) – see Database/README for details

# 5️⃣ Start the server (development)
npm run dev   # uses ts-node-dev for hot‑reloading

# 6️⃣ Or build & run for production
npm run build && npm start
```

#### Docker (recommended)
```bash
# Build the image
docker build -t nova-bot-studio-backend .

# Run the container
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

*Example `.env` snippet*:
```dotenv
PORT=9000
POSTGRES_URI=postgresql://postgres:password@localhost:5432/nova
MONGODB_URI=mongodb://localhost:27017/nova
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=yourAccessSecret
JWT_REFRESH_SECRET=yourRefreshSecret
CORS_ORIGINS=http://localhost:3000
```

---  

## Usage
### Running locally
```bash
npm run dev
```
The API will be reachable at `http://localhost:9000`.

### Health check
```bash
curl http://localhost:9000/ping
# => {"message":"Pong!"}
```

### Example: Register & Login
```typescript
import axios from 'axios';

await axios.post('http://localhost:9000/api/auth/register', {
  email: 'dev@example.com',
  password: 'StrongP@ssw0rd',
});

const loginRes = await axios.post('http://localhost:9000/api/auth/login', {
  email: 'dev@example.com',
  password: 'StrongP@ssw0rd',
});
const { accessToken, refreshToken } = loginRes.data;
```

### Example: Call a protected endpoint
```typescript
await axios.get('http://localhost:9000/api/bot/', {
  headers: { Cookie: `refreshToken=${refreshToken}` },
  withCredentials: true,
});
```

### Example: Retrieve a Bot Configuration
```typescript
await axios.get('http://localhost:9000/api/botConfig/getConfig/12345', {
  headers: { Cookie: `refreshToken=${refreshToken}` },
  withCredentials: true,
});
```

### Example: Fetch Bot Analytics
```typescript
await axios.get('http://localhost:9000/api/botAnalytics/summary/12345', {
  headers: { Cookie: `refreshToken=${refreshToken}` },
  withCredentials: true,
});
```

### Website Bot Communication
The router `websiteBot/` serves endpoints used by front‑end widgets to interact with a bot in real time. Thanks to Redis integration, messages are queued and responded to with sub‑millisecond latency.

```bash
POST http://localhost:9000/websiteBot/message
{
  "botId": "12345",
  "userMessage": "Hello!"
}
```

---  

## API Documentation
> Base URL: `http://<host>:<port>/api/`

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
| | `GET` | `/botConfig/getConfig/:botId` | **Fetch a specific bot’s configuration** (protected) |
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

**Authentication** – All routes under `/api/` (except `/auth/*`) require a valid `refreshToken` cookie. The middleware validates the JWT and injects `req.user`.

**Error format**
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
# Install dev dependencies (already done via npm ci)
npm run dev   # starts ts-node-dev with hot reload
```

### Running tests
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
### Docker (recommended)
```dockerfile
# Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY package*.json ./
RUN npm ci --production
EXPOSE 9000
CMD ["node", "dist/index.js"]
```

Build & run:
```bash
docker build -t nova-bot-studio-backend .
docker run -d -p 9000:9000 --env-file .env nova-bot-studio-backend
```

### Cloud Platforms (Railway, Render, Fly.io, etc.)
1. Push the repository to the platform.  
2. Set the same environment variables defined in `.env.example`.  
3. Choose the Docker build option or let the platform run `npm install && npm start`.  

### Production Tips
* Enable Redis AOF (`appendonly yes`) for durability of cached API keys.  
* Use PostgreSQL connection pooling (`pg-pool`) and tune `max`/`idleTimeoutMillis`.  
* Set `keepAliveTimeout` in Express when behind a load balancer (`server.keepAliveTimeout = 61000`).  

---  

## Contributing
We welcome contributions! Please follow these steps:

1. **Fork the repository** and create your feature branch (`git checkout -b feature/awesome-feature`).  
2. **Write code** adhering to the existing style (ESLint + Prettier).  
3. **Add tests** for new functionality.  
4. **Run the full test suite** (`npm test`) and ensure coverage stays above the project threshold.  
5. **Commit** with a clear message and push to your fork.  
6. **Open a Pull Request** targeting `main`.  
7. PRs will be automatically linted, tested, and built via GitHub Actions.  

### Code Review Guidelines
* Keep changes focused – one feature or bug fix per PR.  
* Update documentation (README, inline JSDoc) when public APIs change.  
* Ensure any new environment variables are added to `.env.example`.  

---  

## License & Credits
**License:** MIT © 2024 GURUDAS‑DEV. See the [LICENSE](LICENSE) file for details.

### Contributors
- **Gurudas Dev** – Project lead & core maintainer  
- *(Add your name here when you contribute!)*

### Acknowledgments
*