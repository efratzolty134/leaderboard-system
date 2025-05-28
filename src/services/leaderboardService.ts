/**
 * Leaderboard Service 
 * 
 * Implements the core functionality behind the leaderboard system.
 * Responsible for coordinating between PostgreSQL (user data) and Redis (ranking logic).
 * This service is used by the API layer
 */

import { PoolClient } from 'pg';
import pool from '../config/db';
import redisClient from '../config/redis';

// Types/Interfaces
interface User {
  user_id: number;
  user_name: string;
  image_url: string;
  total_score: number;
}

interface UserWithRank extends User {
  position: number;
}

interface UserContextResponse {
  user: UserWithRank;
  above: UserWithRank[];
  below: UserWithRank[];
}

/** Leaderboard class providing core ranking operations */
export class LeaderboardService{

  private readonly REDIS_SORTED_SET = 'leaderboard:scores';
  private readonly REDIS_HASH = 'users:metadata'
  private readonly MAX_CACHE_SIZE = 10000;

  constructor(
    private db: typeof pool,
    private redis: typeof redisClient  
  ) {}

/** First service - Add a new user with a score to postgreSQL and Redis*/
  async  createUser(username: string, score: number, imageUrl: string): Promise<void> {

    LeaderboardService.validateUsername(username);
    LeaderboardService.validateScore(score);
    LeaderboardService.validateImageUrl(imageUrl);
    
    const client: PoolClient = await this.db.connect()

    // Step 1: Add user to PostgreSQL
    try {
      await client.query('BEGIN');
      
      const result = await pool.query(
      'INSERT INTO users (user_name, total_score, image_url) VALUES ($1, $2, $3) RETURNING user_id',
      [username, score, imageUrl]
    );

    const user_id = result.rows[0].id;

    // Step 2: Add to Redis sorted set and hash
    await Promise.all([
        this.redis.zAdd(this.REDIS_SORTED_SET, { score, value: user_id.toString() }),
        this.redis.hSet(
          this.REDIS_HASH,
          user_id.toString(),
          JSON.stringify({ name: username, image: imageUrl })
        )
      ]);

      // Keep only top 10K users in Redis
      await this.redis.zRemRangeByRank(this.REDIS_SORTED_SET, this.MAX_CACHE_SIZE, -1);
      console.log(`User added successfully: ${username} (ID: ${user_id}, Score: ${score})`);
      } 
      
    catch (error) {
      await client.query('ROLLBACK');
      console.error('Error adding user:', error);
      throw error;
    } 

    finally {
      client.release();
    }
  }

/* Second service -  Update PostgreSQL and Redis*/
 async updateScore(user_id: number, newScore: number): Promise<void> {
  
   LeaderboardService.validateUserId(user_id);
   LeaderboardService.validateScore(newScore);

   if (newScore < 0) {
      throw new Error('Score must be non-negative');
    }
  const client: PoolClient = await this.db.connect();
  
  try {
    await client.query('BEGIN');

    // Step 1: update user's score in PostgreSQL
    const result = await client.query(
      'UPDATE users SET total_score = $1 WHERE id = $2',
      [newScore, user_id]
    );

     if (result.rows.length === 0) {
        throw new Error(`User with ID ${user_id} not found`);
      }

    // Step 2: Update Redis sorted set
    await this.redis.zAdd(this.REDIS_SORTED_SET, { score: newScore, value: user_id.toString() });
    // Keep only top 10K users in Redis
    await this.redis.zRemRangeByRank(this.REDIS_SORTED_SET, this.MAX_CACHE_SIZE, -1);
    
    await client.query('COMMIT');
    console.log(`Score updated successfully for user: ${user_id}, New Score: ${newScore})`);
  }

  catch{
    await client.query('ROLLBACK');
    console.error('Error updating user score:', Error);
    throw Error;
  }

  finally{
     client.release();
  }
 }

 /*Third service -  Get top N users by score*/
async getTopN(n: number = 100): Promise<UserWithRank[]> {
  try {

      // If n exceeds cache size, go to PostgreSQL
      if (n > this.MAX_CACHE_SIZE){
        const users = await this.getTopUsersFromDB(n);
        return users;
      }

      // Get user IDs from Redis sorted set (highest scores first)
      const userIds = await this.redis.zRevRange(
        this.REDIS_SORTED_SET,
        0,
        n - 1
      );
      
      // Handle null case and ensure it's an array of strings
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return [];
      }
      
      // Type assertion to ensure TypeScript knows it's string[]
      const userIdStrings = userIds as string[];
      
      // Get user data and scores
      const [userData, scores] = await Promise.all([
        this.getUserDataBatch(userIdStrings),
        this.redis.zmScore(this.REDIS_SORTED_SET, userIdStrings)
      ]);
      
      // Return just the array of users
      return userIdStrings.map((userId, index) => ({
        position: index + 1,
        user_id: parseInt(userId),
        user_name: userData[index]?.name || 'Unknown',
        image_url: userData[index]?.image || '',
        total_score: scores[index] || 0
      }));
      
    } catch (error) {
      console.error('Error getting top users:', error);
      throw error;
    }
  }
  

/* Fourth service - Get user's rank and 5 users above and below */
async  getUserAndSurroundings(user_id: number) {
   try {
      // Get user's rank and score from Redis
      const [rank, score, userData] = await Promise.all([
        this.redis.zRevRank(this.REDIS_SORTED_SET, user_id.toString()),
        this.redis.zScore(this.REDIS_SORTED_SET, user_id.toString()),
        this.redis.hGet(this.REDIS_HASH, user_id.toString())
      ]);
      
      // If user not in Redis cache, fallback to PostgreSQL
      if (rank === null || score === null) {
        return await this.getUserContextFromDB(user_id);
      }
      
      const userRank = rank + 1; // Convert to 1-based ranking
      const parsedUserData = userData ? JSON.parse(userData) : { name: 'Unknown', image: '' };
      
      const user: UserWithRank = {
        position: userRank,
        user_id: user_id,
        user_name: parsedUserData.name,
        image_url: parsedUserData.image,
        total_score: score
      };
      
      // Get 5 users above and below
      const totalCachedUsers = await this.redis.zCard(this.REDIS_SORTED_SET);
      const [above, below] = await Promise.all([
        this.getContextUsers(Math.max(0, rank - 5), rank - 1),
        this.getContextUsers(rank + 1, Math.min(rank + 5, totalCachedUsers - 1))
      ]);
      
      return { user, above, below };
      
    } catch (error) {
      console.error('Error getting user with context:', error);
      throw error;
    }
  }

/**helper functions */

/** Get user data for multiple users in batch using hash*/
private async getUserDataBatch(userIds: string[]): Promise<Array<{name: string, image: string} | null>> {
  const results = await this.redis.hmGet(this.REDIS_HASH, userIds);
  
  return results.map(result => 
    result ? JSON.parse(result) : null
  );
}

/**
 * Get top users directly from PostgreSQL (fallback method)
 * Used when limit exceeds cache size or Redis is unavailable
 */
private async getTopUsersFromDB(n: number): Promise<UserWithRank[]> {
  try {
    const result = await this.db.query(`
      SELECT 
        user_id,
        user_name,
        image_url,
        total_score,
        RANK() OVER (ORDER BY total_score DESC, user_id ASC) as position
      FROM users 
      ORDER BY total_score DESC, user_id ASC
      LIMIT $1
    `, [n]);

    return result.rows.map(row => ({
      position: row.position,
      user_id: row.user_id,
      user_name: row.user_name,
      image_url: row.image_url || '',
      total_score: row.total_score
    }));
    
  } catch (error) {
    console.error('Error getting top users from database:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to get top users from database: ${error.message}`);
    } 
    else {
    throw new Error('Failed to get top users from database: Unknown error');
  }
}
  }

/*Sync cache from database (rebuild Redis from PostgreSQL)*/
  async syncCacheFromDB(): Promise<void> {
    try {
      console.log('Starting cache sync from database...');
      
      // Clear existing Redis cache
      await Promise.all([
        this.redis.del(this.REDIS_SORTED_SET),
        this.redis.del(this.REDIS_HASH)
      ]);
      
      // Get top users from PostgreSQL
      const result = await this.db.query(`
        SELECT user_id, user_name, image_url, total_score 
        FROM users 
        ORDER BY total_score DESC, user_id ASC 
        LIMIT $1
      `, [this.MAX_CACHE_SIZE]);
      
      if (result.rows.length === 0) {
        console.log('No users found in database');
        return;
      }
      
      // Batch insert into Redis using multi/exec
      const multi = this.redis.multi();
      
      result.rows.forEach(user => {
        // Add to sorted set
        multi.zAdd(this.REDIS_SORTED_SET, { score: user.total_score, value: user.user_id.toString() });
        // Add user data to hash
        multi.hSet(
          this.REDIS_HASH,
          user.user_id.toString(),
          JSON.stringify({ name: user.user_name, image: user.image_url })
        );
      });
      
      await multi.exec();
      
      console.log(`Cache synced successfully: ${result.rows.length} users loaded`);
      
    } catch (error) {
      console.error('Error syncing cache from database:', error);
      throw error;
    }
  }


/** Get users in a specific rank range*/
  private async getContextUsers(startRank: number, endRank: number): Promise<UserWithRank[]> {
    if (startRank > endRank) return [];
    
    const userIds = await this.redis.zRevRange(this.REDIS_SORTED_SET, startRank, endRank);
    
    // Handle null case and ensure it's an array of strings
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) return [];
    
    // Type assertion to ensure TypeScript knows it's string[]
    const userIdStrings = userIds as string[];
    
    // Get user data and scores
    const [userData, scores] = await Promise.all([
      this.getUserDataBatch(userIdStrings),
      this.redis.zmScore(this.REDIS_SORTED_SET, userIdStrings)
    ]);
    
    return userIdStrings.map((userId, index) => ({
      position: startRank + index + 1,
      user_id: parseInt(userId),
      user_name: userData[index]?.name || 'Unknown',
      image_url: userData[index]?.image || '',
      total_score: scores[index] || 0
    }));
  }

 /**
   * Fallback to PostgreSQL when user not in cache
   */
  private async getUserContextFromDB(userId: number): Promise<UserContextResponse> {
    const result = await this.db.query(`
      WITH ranked_users AS (
        SELECT 
          user_id, user_name, image_url, total_score,
          RANK() OVER (ORDER BY total_score DESC, user_id ASC) as position
        FROM users
      ),
      user_context AS (
        SELECT 
          *,
          LAG(user_id, 1) OVER (ORDER BY position) as prev_id_1,
          LAG(user_id, 2) OVER (ORDER BY position) as prev_id_2,
          LAG(user_id, 3) OVER (ORDER BY position) as prev_id_3,
          LAG(user_id, 4) OVER (ORDER BY position) as prev_id_4,
          LAG(user_id, 5) OVER (ORDER BY position) as prev_id_5,
          LEAD(user_id, 1) OVER (ORDER BY position) as next_id_1,
          LEAD(user_id, 2) OVER (ORDER BY position) as next_id_2,
          LEAD(user_id, 3) OVER (ORDER BY position) as next_id_3,
          LEAD(user_id, 4) OVER (ORDER BY position) as next_id_4,
          LEAD(user_id, 5) OVER (ORDER BY position) as next_id_5
        FROM ranked_users
      )
      SELECT * FROM user_context WHERE user_id = $1
    `, [userId]);
    
    if (result.rows.length === 0) {
      throw new Error(`User with ID ${userId} not found`);
    }
    
    const userData = result.rows[0];
    const user: UserWithRank = {
      position: userData.position,
      user_id: userData.user_id,
      user_name: userData.user_name,
      image_url: userData.image_url,
      total_score: userData.total_score
    };
    
    // Note: This is a simplified fallback - in a real implementation,
    // you'd want to get the actual above/below users from the database
    return {
      user,
      above: [], // Simplified for assignment
      below: []  // Simplified for assignment
    };
  }

 static validateScore(score: number): void {
    // Check if score exists
    if (score === undefined || score === null) {
      throw new Error('Score is required');
    }

    // Check if score is a number
    if (typeof score !== 'number') {
      throw new Error('Score must be a number');
    }

    // Check if score is not NaN
    if (isNaN(score)) {
      throw new Error('Score must be a valid number');
    }

    // Check if score is an integer
    if (!Number.isInteger(score)) {
      throw new Error('Score must be an integer');
    }

    // Check if score is non-negative (your business rule)
    if (score < 0) {
      throw new Error('Score must be non-negative');
    }
  }

static validateUserId(userId: number): void {
    // Check if userId exists
    if (userId === undefined || userId === null) {
      throw new Error('User ID is required');
    }

    // Check if userId is a number
    if (typeof userId !== 'number') {
      throw new Error('User ID must be a number');
    }

    // Check if userId is not NaN
    if (isNaN(userId)) {
      throw new Error('User ID must be a valid number');
    }

    // Check if userId is a positive integer
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error('User ID must be a positive integer');
    }
    }

static validateImageUrl(imageUrl: string): void {
 
    // Check if imageUrl is string
    if (typeof imageUrl !== 'string') {
      throw new Error('Image URL must be a string');
    }

    // Basic URL format validation
    try {
      new URL(imageUrl);
    } catch {
      throw new Error('Image URL must be a valid URL');
    }
  }

  static validateUsername(username: string): void {
    // Check if username exists
    if (username === undefined || username === null) {
      throw new Error('Username is required');
    }

    // Check if username is string
    if (typeof username !== 'string') {
      throw new Error('Username must be a string');
    }

    // Check if username is empty or only whitespace
    if (username.trim().length === 0) {
      throw new Error('Username cannot be empty');
    }
  }
  }