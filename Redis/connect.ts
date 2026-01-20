
import { Redis } from "@upstash/redis";
let redis: Redis | null = null; 
export const getRedisClient = (): Redis => { 
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL as string,
      token: process.env.UPSTASH_REDIS_REST_TOKEN as string,
    });

    if(redis)
      console.log("Upstash Redis client initialized");
    else  
      console.log("Failed to initialize Upstash Redis client"); 
  }
  return redis;
};
 