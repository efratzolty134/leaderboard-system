"use strict";
/** this file initializes and exports a single Redis client.
 * The client connects to Redis using a URL from environment variables
 * (defaulting to localhost)*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const redis_1 = require("redis");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const redisClient = (0, redis_1.createClient)({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
});
/**Listen to Redis client error events and log them to the console */
redisClient.on('error', (err) => {
    console.error('Redis connection error', err);
});
/*Connection attempt to Redis client.If successful, log a confirmation message.
//Otherwise, catch and log the error.*/
redisClient.connect()
    .then(() => console.log('successfully connected to Redis'))
    .catch((err) => console.error('failed to connect to Redis', err));
exports.default = redisClient;
