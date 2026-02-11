import type { Request, Response, NextFunction } from "express"
import { getRedisClient } from "../../Redis/connect.js";

export const LimitBotCommunication = async (req : Request, res : Response, next : NextFunction) : Promise<Response | void> =>{
    try{
        const redisClient = getRedisClient();
        if(!redisClient)
            return res.status(500).json({ message : "Server is currently Facing some issue, Please Try Again Later."});

        const botId = (req as any).botId;
        if(!botId){
            return res.status(400).json({ message : "Bot ID is required"});
        }

        const key = `rateLimiting:BotCommunication:${botId}`;
        const current = await redisClient.incr(key);
        if(current === 1){
            await redisClient.expire(key, 60);
        }

        if(current > 10){
            return res.status(429).json({ message : "Too Many Requests. Please Try Again Later."});
        }

        next();
        
    }
    catch( error : any ){
        console.log("Rate Limting Failed : ",error);
        return res.status(500).json({ message : "Server is currently Facing some issue, Please Try Again Later."});
    }
}