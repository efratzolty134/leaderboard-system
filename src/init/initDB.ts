/**this script is intended for the leaderboard db initialization.
 * It creates the "Users" table if it doesn't exist. can be run once
 * with the command npm run init-db */

import pool from '../config/db';

async function initDB(){

    try {
        await pool.query(`
            CREATE TABLE IF NOT exists users(
            user_id SERIAL PRIMARY KEY,
            user_name TEXT NOT NULL UNIQUE,
            image_url TEXT,
            total_score INTEGER NOT NULL DEFAULT 0
            )`
        );
        console.log('Successfully created users table');

        /**Index user score column for better performance */
        await pool.query(`
            CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_score_desc 
            ON users (total_score DESC, user_id ASC)
        `);
        console.log('Successfully created score index');

        console.log('Database initialization completed successfully');
        process.exit(0);
    }

    catch(err){
        console.error('Error in Database initialization', err);
        process.exit(1);
    }
}

initDB();

