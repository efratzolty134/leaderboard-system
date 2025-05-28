/** this file initializes and exports a single Redis client.
 * The client connects to Redis using a URL from environment variables
 * (defaulting to localhost)*/

import {createClient} from 'redis';
import dotenv from 'dotenv'; 

dotenv.config()

const redisClient = createClient({
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
    .catch((err) => console.error('failed to connect to Redis',err));

export default redisClient;



 



