"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const leaderboardEndpoints_1 = require("../endpoints/leaderboardEndpoints");
const router = express_1.default.Router();
/**
 * POST /api/users
 * Adds a new user with a score and optional image.
 */
router.post('/users', leaderboardEndpoints_1.addUserHandler);
/**
 * PUT /api/users/:id/score
 * Updates the total score of a specific user.
 */
router.put('/users/:id/score', leaderboardEndpoints_1.updateUserScoreHandler);
/**
 * GET /api/leaderboard/top/:n
 * Returns the top N users by score.
 */
router.get('/leaderboard/top/:n', leaderboardEndpoints_1.getTopUsersHandler);
/**
 * GET /api/leaderboard/user/:id/context
 * Returns a user's rank and 5 users above and below.
 */
router.get('/leaderboard/user/:id/context', leaderboardEndpoints_1.getUserAndSurroundingsHandler);
exports.default = router;
