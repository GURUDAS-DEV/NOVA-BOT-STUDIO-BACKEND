import 'dotenv/config';
import { Queue } from 'bullmq';
import * as IORedis from 'ioredis';

const IORedisCtor: any = (IORedis as any).default ?? IORedis;
const redisUrl =
    process.env.REDIS_TCP_URL ??
    process.env.REDIS_URL ??
    process.env.UPSTASH_REDIS_URL ??
    'redis://127.0.0.1:6379';

export const connection = new IORedisCtor(redisUrl, {
    maxRetriesPerRequest: null,
});

connection.on('error', (error: Error) => {
        console.error('BullMQ Redis connection error:', error.message);
});

export const scrapeQueue = new Queue('scrapeWebsite', { connection });