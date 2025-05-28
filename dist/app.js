"use strict";
/**
 * Main application file
 *
 * - Loads environment variables
 * - Sets up middleware
 * - Mounts all API routes under the /api prefix
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const leaderboardRoutes_1 = __importDefault(require("./routes/leaderboardRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
// Middleware to parse incoming JSON bodies
app.use(express_1.default.json());
// Mount all leaderboard-related routes under /api
app.use('/api', leaderboardRoutes_1.default);
// Optional: Health check route
app.get('/', (req, res) => {
    res.send('Leaderboard API is running');
});
exports.default = app;
