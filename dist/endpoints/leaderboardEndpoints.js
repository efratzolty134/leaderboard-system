"use strict";
/**
 * Leaderboard Endpoints
 *
 * Defines the HTTP request handlers for the leaderboard API.
 * Each function maps to a specific route and delegates logic to the service layer.
 *   */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserAndSurroundingsHandler = exports.getTopUsersHandler = exports.updateUserScoreHandler = exports.addUserHandler = void 0;
const leaderboardService_1 = require("../services/leaderboardService");
const db_1 = __importDefault(require("../config/db"));
const redis_1 = __importDefault(require("../config/redis"));
// Create service instance
const leaderboardService = new leaderboardService_1.LeaderboardService(db_1.default, redis_1.default);
/**
 * POST /api/users
 * Creates a new user in the system with a given score and optional image URL.
 * Delegates creation to the service layer (PostgreSQL + Redis).
 * Responds with success or validation/server error.
 */
const addUserHandler = async (req, res) => {
    try {
        const { user_name, total_score, image_url } = req.body;
        if (!user_name || total_score === undefined) {
            res.status(400).json({ error: 'Missing user_name or total_score' });
            return;
        }
        await leaderboardService.createUser(user_name, total_score, image_url || '');
        res.status(201).json({ message: 'User created successfully' });
    }
    catch (err) {
        console.error('Error in addUser:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.addUserHandler = addUserHandler;
/**
 * PUT /api/users/:id/score
 * Updates the total score of an existing user based on their user ID.
 * Updates both PostgreSQL and Redis.
 * Responds with confirmation or error if input is invalid or update fails.
 */
const updateUserScoreHandler = async (req, res) => {
    try {
        const userId = Number(req.params.id);
        const { total_score } = req.body;
        if (isNaN(userId) || total_score === undefined) {
            res.status(400).json({ error: 'Invalid user ID or total_score' });
            return;
        }
        await leaderboardService.updateScore(userId, total_score);
        res.status(200).json({ message: 'Score updated successfully' });
    }
    catch (err) {
        console.error('Error in updateUserScore:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.updateUserScoreHandler = updateUserScoreHandler;
/**
 * GET /api/leaderboard/top/:n
 * Retrieves the top N users from the leaderboard, ranked by score.
 * Combines data from Redis (ranking) and PostgreSQL (user details).
 * Returns an array of user objects or an error response.
 */
const getTopUsersHandler = async (req, res) => {
    try {
        const n = Number(req.params.n);
        if (isNaN(n) || n <= 0) {
            res.status(400).json({ error: 'Invalid number' });
            return;
        }
        const users = await leaderboardService.getTopN(n);
        res.status(200).json(users);
    }
    catch (err) {
        console.error('Error in getTopUsers:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getTopUsersHandler = getTopUsersHandler;
/**
 * GET /api/leaderboard/user/:id/context
 * Fetches a specific user's rank and the 5 users ranked above and below.
 * Uses Redis for fast lookup and PostgreSQL for user information.
 * Returns a leaderboard slice or 404 if user not found.
 */
const getUserAndSurroundingsHandler = async (req, res) => {
    try {
        const userId = Number(req.params.id);
        if (isNaN(userId)) {
            res.status(400).json({ error: 'Invalid user ID' });
            return;
        }
        const result = await leaderboardService.getUserAndSurroundings(userId);
        if (!result) {
            res.status(404).json({ error: 'User not found in leaderboard' });
            return;
        }
        res.status(200).json(result);
    }
    catch (err) {
        console.error('Error in getUserAndSurroundingsHandler:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.getUserAndSurroundingsHandler = getUserAndSurroundingsHandler;
