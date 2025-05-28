# explanation of the assignment


# System Design & Architecture        
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

Performance Characteristics:

| Operation        | Data Source        | Time Complexity |
| ---------------- | ------------------ | --------------- |
| Get Top 100      | Redis ZSET + HASH  | O(log N + 100)  |
| Get User Rank    | Redis ZSET         | O(log N)        |
| Add User         | PostgreSQL + Redis | O(log N)        |
| Update Score     | PostgreSQL + Redis | O(log N)        |
| Get User Context | Redis ZSET + HASH  | O(log N + 11)   |


### PostgreSQL Schema (Source of Truth)

-- Users table: Core entity storing all user data
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,           -- Auto-incrementing primary key
    user_name TEXT NOT NULL UNIQUE,       -- Username (unique constraint)
    image_url TEXT,                       -- Profile image URL (nullable)
    total_score INTEGER NOT NULL DEFAULT 0 -- User's current score
);

-- Critical performance index for leaderboard queries
CREATE INDEX CONCURRENTLY idx_users_score_desc 
ON users (total_score DESC, user_id ASC);

### Scalability Design Decisions:

- **Hybrid Architecture**: Combines Redis (for fast, in-memory access) with PostgreSQL (for durability and long-term storage), balancing performance with reliability.
- **Sorted Sets**: Used in Redis to store user scores, enabling O(log N) operations for both ranking lookups and score updates — highly efficient for leaderboard logic.
- **Memory Limits**: The Redis cache is limited to the top 10K users, ensuring predictable memory consumption while optimizing for the most commonly queried data.
- **Hash Storage**: User metadata (name, image) is stored in Redis Hashes, enabling O(1) access and batch retrievals via HMGET method, reducing lookup overhead.
- **Parallel Processing**: Leaderboard ranks and user metadata are retrieved in parallel from separate Redis structures, minimizing latency and offloading load from the database.

### Using the deployed system






#### Future Enhancement
While the system uses Redis as a high-performance cache for the top 10,000 users, it does not yet include a background process to periodically sync the cache with PostgreSQL. In the meantime a manual syncCacheFromDB()() function is provided in src/services/leaderboardService and can be used to repopulate the cache from the database as needed.
