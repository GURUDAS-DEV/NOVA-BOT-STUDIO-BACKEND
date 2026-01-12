# NOVA‑BOT‑STUDIO‑BACKEND
![Node.js](https://img.shields.io/badge/Node.js-18.x-green) ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue) ![License](https://img.shields.io/badge/License-MIT-yellow) ![Build](https://img.shields.io/github/actions/workflow/status/GURUDAS-DEV/NOVA-BOT-STUDIO-BACKEND/ci.yml?branch=main) ![Coverage](https://img.shields.io/codecov/c/github/GURUDAS-DEV/NOVA-BOT-STUDIO-BACKEND)  

**A modular, TypeScript‑based backend for managing AI bots, API keys, and user authentication.**  

---  

## Overview
NOVA‑BOT‑STUDIO‑BACKEND provides a clean, extensible framework for building and operating bot‑centric applications. It supports:

* **Bot lifecycle management** – create, update, delete, and run bots.  
* **AI feature toggling** – enable/disable advanced AI capabilities per bot.  
* **Secure API‑key handling** – generation, hashing, and revocation.  
* **Robust authentication** – JWT‑based login/registration with refresh tokens.  
* **Multi‑database support** – PostgreSQL for relational data, MongoDB for flexible storage.  
* **Redis caching** – fast look‑ups for API‑key validation and session data.  

Targeted at developers building SaaS bot platforms, internal automation tools, or any service that needs programmable bots with fine‑grained access control.

---  

## Features
| Feature | Description | Status |
|---------|-------------|--------|
| **Authentication** | JWT login, registration, refresh tokens, role‑based middleware. | ✅ Stable |
| **API‑Key Management** | Secure generation, hashing, revocation, Redis‑backed lookup. | ✅ Stable |
| **Bot Configuration** | CRUD for bot metadata, custom prompts, and system settings. | ✅ Stable |
| **AI Feature Management** | Toggle AI modules (e.g., text‑enhancer, validator) per bot. | ✅ Stable |
| **Advanced Bot Management** | Lifecycle helpers, scheduled clean‑up, versioning. | ✅ Stable |
| **Website Bot Communication** | Dedicated router (`/websiteBot/`) for real‑time website‑bot interactions. | ✅ Stable |
| **Redis Integration** | Centralised Redis client for caching API keys and session data. | ✅ Stable |
| **Multi‑DB Support** | PostgreSQL (relational) + MongoDB (document) – both initialized on server start. | ✅ Stable |
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
| **Cache** | Redis (via `ioredis`) | Fast key‑value look‑ups for API‑key validation |
| **Authentication** | `jsonwebtoken`, `bcrypt` | Secure token handling |
| **Validation / Sanitisation** | `class-validator`, custom sanitiser helpers | Prevent injection attacks |
| **Testing** | Jest & Supertest (dev dependencies) | Unit & integration testing |
| **Containerisation** | Docker (optional) | Consistent dev/prod environments |
| **CI/CD** | GitHub Actions (lint, test, build) | Automated quality gates |

---  

## Architecture
```
src/
├─ Database/                # PostgreSQL & MongoDB init helpers
├─ Redis/                   # Redis client singleton
├─ Email/                   # HTML email templates
├─ Middleware/              # auth & access guards
├─ Models/                  # Mongoose schemas & TypeORM entities
├─ Router/                  # Feature‑specific routers
│   ├─ Authentication/
│   ├─ API_Key_Management/
│   ├─ Bot_Management/
│   ├─ Bot_Configration/
│   ├─ AI_Feature_Management/
│   ├─ Advance_Bot_Management/
│   ├─ CommunicationWithBot/
│   │   └─ Website/
│   └─ Testing/
├─ controller/              # Business logic per feature
├─ utils/                   # Helpers (JWT, validation, etc.)
├─ index.ts                 # Server bootstrap
└─ Static/                  # Assets (logo, etc.)
```

* **Entry point (`index.ts`)** – sets up CORS, cookie parser, JSON body parsing, initializes DBs, connects Redis, registers routers, and starts the HTTP server.  
* **Routers** – each feature lives in its own router file, mounted under a versioned `/api/` namespace.  
* **Controllers** – thin layers that orchestrate service calls, keeping routers declarative.  
* **Middleware** – protects routes (`accessMiddleware`, `authMiddleware`).  
* **Redis** – used for fast API‑key look‑ups (`redis.get("apiKey:*")`) and can be extended for session caching.  

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

# 5️⃣ Start the server
npm run dev   # uses ts-node-dev for hot‑reloading
# or for production
npm run build && npm start
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

### Website Bot Communication
The new router `websiteBot/` serves endpoints used by front‑end widgets to interact with a bot in real time.

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
| | `PUT` | `/botConfig/:id` | Update a bot configuration |
| | `DELETE` | `/botConfig/:id` | Delete a bot configuration |
| **Bot Management** | `GET` | `/bot/` | Retrieve bots owned by the authenticated user |
| | `POST` | `/bot/` | Deploy a new bot instance |
| | `DELETE` | `/bot/:id` | Remove a bot |
| **AI Feature Management** | `PATCH` | `/aiFeatures/:botId` | Enable/disable AI modules for a bot |
| **Advanced Bot Controller** | `POST` | `/advanceBotController/start` | Start a bot with advanced lifecycle options |
| | `POST` | `/advanceBotController/stop` | Stop a running bot |
| **Website Bot** | `POST` | `/websiteBot/message` | Send a message to a website‑embedded bot and receive a reply |
| | `GET` | `/websiteBot/status/:botId` | Get current status of the website bot |
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

### Debugging
* Use `DEBUG=express:*` to see request logs.  
* Redis client can be inspected via `redis-cli` (`KEYS apiKey:*`).  

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

### Cloud (e.g., Railway, Render, Fly.io)
* Ensure environment variables are set in the platform UI.  
* Use the Docker image above or let the platform run `npm start` after installing dependencies.

### Performance Tips
* Enable Redis persistence (`appendonly yes`) for API‑key durability.  
* Use PostgreSQL connection pooling (`pg-pool`).  
* Set `keepAliveTimeout` in Express if behind a load balancer.

---  

## Contributing
1. Fork the repository.  
2. Create a feature branch (`git checkout -b feat/my‑feature`).  
3. Install dependencies and run tests (`npm test`).  
4. Make your changes, ensuring lint passes (`npm run lint`).  
5. Commit with a clear message and push (`git push origin feat/my‑feature`).  
6. Open a Pull Request – the CI pipeline will run lint, tests, and build checks.  

### Code Style
* **TypeScript** – strict mode enabled (`tsconfig.json`).  
* **ESLint** – Airbnb base config with TypeScript extensions.  
* **Prettier** – 2‑space indentation, single quotes.  

### Review Guidelines
* All new endpoints must have unit tests (`__tests__` folder).  
* Update the OpenAPI spec (`openapi.yaml`) if you add/modify routes.  
* Document any new environment variables in the **Configuration** section.

---  

## License
This project is licensed under the **MIT License** – see the [LICENSE](LICENSE) file for details.

---  

## Acknowledgments
* **Express.js** – web framework.  
* **TypeScript** – static typing.  
* **MongoDB** & **PostgreSQL** – data stores.  
* **Redis** – caching layer.  
* **Jest** – testing framework.  
* **Docker** – containerisation.  

---  

## Contact
Maintainer: **GURUDAS‑DEV** – <https://github.com/GURUDAS-DEV>  

For issues, feature requests, or questions, please open an **Issue** on GitHub.