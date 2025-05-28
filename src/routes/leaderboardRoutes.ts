/**
 * Leaderboard Routes
 * 
 * Maps HTTP routes to their corresponding endpoint handler functions.
 * Mounted under the '/api' path prefix in app.ts.
 * 
 * Routes included:
 * - POST   /api/users                     → addUserHandler
 * - PUT    /api/users/:id/score          → updateUserScoreHandler
 * - GET    /api/leaderboard/top/:n       → getTopNUsersHandler
 * - GET    /api/leaderboard/user/:id/context → getUserAndSurroundingsHandler
 */

import express from 'express';
import {
    addUserHandler,
    updateUserScoreHandler,
    getTopUsersHandler,
    getUserAndSurroundingsHandler
} from '../endpoints/leaderboardEndpoints';

const router = express.Router();

/**
 * POST /api/users
 * Adds a new user with a score and optional image.
 */
router.post('/users', addUserHandler);

/**
 * PUT /api/users/:id/score
 * Updates the total score of a specific user.
 */
router.put('/users/:id/score', updateUserScoreHandler);

/**
 * GET /api/leaderboard/top/:n
 * Returns the top N users by score.
 */
router.get('/leaderboard/top/:n', getTopUsersHandler);

/**
 * GET /api/leaderboard/user/:id/context
 * Returns a user's rank and 5 users above and below.
 */
router.get('/leaderboard/user/:id/context', getUserAndSurroundingsHandler);

export default router;