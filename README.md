
## User Leaderboard System
A high-performance leaderboard API built with Node.js, PostgreSQL, and Redis, designed for Kubernetes deployment.
Key features include user creation, score updates, top-N retrieval, and contextual leaderboard views.

## System Design & Architecture        
                    ┌─────────────────────────────────────┐
                    │           CLIENT LAYER              │
                    │                                     │
                    │  ┌─────────────┐  ┌─────────────┐  │
                    │  │   Browser   │  │   Mobile    │  │
                    │  │    (Web)    │  │    (App)    │  │
                    │  └─────────────┘  └─────────────┘  │
                    └──────────────┬──────────────────────┘
                                   │ HTTP Requests
                                   │ (REST API)
                    ┌──────────────▼──────────────────────┐
                    │          API GATEWAY                │
                    │                                     │
                    │  ┌─────────────────────────────┐    │
                    │  │      Express.js Server      │    │
                    │  │     (Node.js + TypeScript)  │    │
                    │  │                             │    │
                    │  │  Routes → Controllers →     │    │
                    │  │       Leaderboard Service   │    │
                    │  └─────────────────────────────┘    │
                    └──────────────┬──────────────────────┘
                                   │
                       ┌───────────┴───────────┐
                       │                       │
                       │ Dual Data Strategy    │
                       │                       │
            ┌──────────▼─────────┐   ┌─────────▼──────────┐
            │                    │   │                    │
            │    REDIS CACHE     │   │   POSTGRESQL DB    │
            │   (Performance)    │   │  (Source of Truth) │
            │                    │   │                    │
            │ ┌────────────────┐ │   │ ┌────────────────┐ │
            │ │ Sorted Set     │ │   │ │     users      │ │
            │ │leaderboard:    │ │   │ │                │ │
            │ │scores          │ │◄──┼─┤ ┌────────────┐ │ │
            │ │{score→user_id} │ │   │ │ │ Performance│ │ │
            │ │                │ │   │ │ │   Index    │ │ │
            │ │ O(log N + K)   │ │   │ │ │(score DESC)│ │ │
            │ └────────────────┘ │   │ │ └────────────┘ │ │
            │                    │   │ │                │ │
            │ ┌────────────────┐ │   │ │   ACID         │ │
            │ │ Hash Table     │ │   │ │   Transactions │ │
            │ │users:metadata  │ │   │ │   Durability   │ │
            │ │{id→user_data}  │ │   │ │                │ │
            │ │                │ │   │ └────────────────┘ │
            │ │ O(1) Lookup    │ │   │                    │
            │ └────────────────┘ │   │                    │
            └────────────────────┘   └────────────────────┘
                     │                         │
                     └─────────┬───────────────┘
                               │
                    ┌──────────▼──────────┐
                    │    DATA FLOW        │
                    │                     │
                    │ Writes: PG → Redis  │
                    │ Reads:  Redis → PG  │
                    │                     │
                    │ Cache: Top 10K      │
                    │ Fallback: Full DB   │
                    └─────────────────────┘

## PostgreSQL Schema (Source of Truth)

-- Users table: Core entity storing all user data
```sql
CREATE TABLE users (
  user_id SERIAL PRIMARY KEY,            -- Auto-incrementing primary key
  user_name TEXT NOT NULL UNIQUE,        -- Username (unique constraint)
  image_url TEXT,                        -- Profile image URL (nullable)
  total_score INTEGER NOT NULL DEFAULT 0 -- User's current score
);

-- To ensure fast leaderboard queries at scale, the following composite index is created:
CREATE INDEX CONCURRENTLY idx_users_score_desc 
ON users (total_score DESC, user_id ASC);
```

## Scalability Design Decisions:

- **Hybrid Architecture**: Combines Redis (for fast, in-memory access) with PostgreSQL (for durability and long-term storage), balancing performance with reliability.
- **Sorted Sets**: Used in Redis to store user scores, enabling O(log N) operations for both ranking lookups and score updates — highly efficient for leaderboard logic.
- **Memory Limits**: The Redis cache is limited to the top 10K users, ensuring predictable memory consumption while optimizing for the most commonly queried data.
- **Hash Storage**: User metadata (name, image) is stored in Redis Hashes, enabling O(1) access and batch retrievals via HMGET method, reducing lookup overhead.
- **Parallel Processing**: Leaderboard ranks and user metadata are retrieved in parallel from separate Redis structures, minimizing latency and offloading load from the database.

## Local Deployment (via Docker Compose)
Deployment & Usage (Local Environment)
This project supports local deployment using Docker and Docker Compose.

**Prerequisites**
- Docker
- Docker Compose

**Quick Start**
- Clone the repository and navigate to the project directory:
- git clone https://github.com/yourusername/leaderboard-system.git
- cd leaderboard-system
- Start all services (PostgreSQL, Redis, API server):
```bash
    docker compose up --build
```
This will:
- Build the Node.js app from the Dockerfile

- Spin up PostgreSQL and Redis from official images

- Initialize the database

## Access the API
Once all services are up, access the API at:
http://localhost:3000

## Development Commands
### Start services in foreground (with logs)
docker-compose up

### Rebuild and start services
docker-compose up --build

### Stop all services
docker-compose down

### Stop and remove all data
docker-compose down -v

### View logs
- docker-compose logs -f api
- docker-compose logs -f postgres
- docker-compose logs -f redis

## API Endpoints

**POST /users**
Create a new user.

**Request Body:**
```{
```json
  "username": "string",
  "score": number,
  "imageUrl": "string"
}
```

---

**POST /users/:id/score**
Update a user's score.

**Path Parameter:**
- `id`: User ID

**Request Body:**
```
{
```json
  "score": number
}
```
---

**GET /leaderboard/top/:n**
Retrieve the top 'n' users in the leaderboard.

---

**GET /leaderboard/user/:id/context**
Get a user's ranking and surrounding users (up to 5 above and 5 below).

---

## Environment Variables
The application requires the following environment variables. You can provide them via a `.env` file or directly in your deployment environment.

| Variable       | Description              | Default             |
|----------------|--------------------------|---------------------|
| `PORT`         | API server port          | `3000`              |
| `DB_HOST`      | PostgreSQL hostname      | `postgres`          |
| `DB_PORT`      | PostgreSQL port          | `5432`              |
| `DB_NAME`      | Database name            | `leaderboard`       |
| `DB_USER`      | Database username        | `postgres`          |
| `DB_PASSWORD`  | Database password        | `password`          |
| `REDIS_URL`    | Redis connection URL     | `redis://redis:6379` |


## Container Health Checks
- API: HTTP GET to http://localhost:3000/
- PostgreSQL: pg_isready command
- Redis: redis-cli ping command

## Kubernetes-Ready
This project is designed with Kubernetes compatibility in mind:
- **Stateless API Container**: All data is stored externally in PostgreSQL and Redis
- **Health Checks**: Included for readiness/liveness probes.
- **Non-root User**: Follows container security best practices.
- **Resource efficiency**: Alpine Linux base images

## AWS Cloud Architecture

This system is designed to scale effectively in a production-grade cloud environment using AWS-managed services. Below is a proposed architecture mapping local components to their cloud-native equivalents:

| Component              | Local Implementation            | AWS Equivalent                     | Purpose                                                             |
|------------------------|----------------------------------|------------------------------------|---------------------------------------------------------------------|
| API Server             | Node.js + Express in Docker     | ECS (Fargate) or EKS               | Deploy scalable stateless containers                               |
| Reverse Proxy / API    | Express Routes                  | API Gateway                        | Entry point for REST API traffic                                   |
| Relational Database    | PostgreSQL                      | Amazon RDS (PostgreSQL)            | Managed relational database                                         |
| In-Memory Cache        | Redis                           | Amazon ElastiCache (Redis)         | High-speed cache for leaderboard reads                             |
| Environment Variables  | `.env` file                     | AWS Secrets Manager / Parameter Store | Secure configuration management                                 |
| Container Build        | Dockerfile                      | ECS Task Definition                | Defines how to build/deploy containerized app                      |
| Service Orchestration  | docker-compose                  | ECS Service or CloudFormation      | Manage multi-container deployment                                  |

## Testing

Unit tests are not yet included, but the system is designed to support scalable and robust testing.

### Recommended Edge Cases to Test:

- **Redis Failover**  
  Simulate Redis unavailability during peak traffic.  
  _Expected:_ Fallback to PostgreSQL; API remains functional with degraded performance.

- **Heavy Concurrent Access**  
  Test with multiple simultaneous score updates and leaderboard reads.  
  _Expected:_ Data consistency and no race conditions.

- **Malformed or Incomplete Requests**  
  Missing required fields (e.g., `score`, `user_id`) or incorrect data types.  
  _Expected:_ Return `400 Bad Request` with clear validation errors.

- **Top-N Beyond Cache Limit**  
  Request top N users where N > `MAX_CACHE_SIZE`.  
  _Expected:_ Serve from PostgreSQL fallback and ensure stable performance.

- **Leaderboard Ties**  
  Multiple users with the same score.  
  _Expected:_ Tie-breaking should work as defined (by `user_id`).

## Future Enhancement
While the system uses Redis as a high-performance cache for the top 10,000 users, it does not yet include a background process to periodically sync the cache with PostgreSQL. In the meantime a manual syncCacheFromDB()() function is provided in src/services/leaderboardService and can be used to repopulate the cache from the database as needed.
