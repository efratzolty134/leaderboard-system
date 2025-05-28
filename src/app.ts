/**
 * Main application file
 * 
 * - Loads environment variables
 * - Sets up middleware
 * - Mounts all API routes under the /api prefix
 */

import express from 'express';
import dotenv from 'dotenv';
import leaderboardRoutes from './routes/leaderboardRoutes';

dotenv.config();

const app = express();

// Middleware to parse incoming JSON bodies
app.use(express.json());

// Mount all leaderboard-related routes under /api
app.use('/api', leaderboardRoutes);

// Optional: Health check route
app.get('/', (req, res) => {
  res.send('Leaderboard API is running');
});

export default app;