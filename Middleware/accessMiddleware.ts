import type { Request, Response, NextFunction } from "express";
import { hashApiKey } from "../utils/helper/APIKeyHashing.js";
import { getRedisClient } from "../Redis/connect.js";
import { supabase } from "../Database/postgresql.js";

export const accessMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try{
        const apiKeyHeader = req.headers.authorization;
        if(!apiKeyHeader || !apiKeyHeader.startsWith("Bearer ")){
            return res.status(401).json({ message: "API key is missing in the request headers." });
        }

        const apiKey = apiKeyHeader.split(" ")[1];
        if(!apiKey){
            return res.status(401).json({ message: "API key is missing in the request headers." });
        }
        const redis = getRedisClient();
        const hashedApiKey = hashApiKey(apiKey);
        
        
        const cachedBotId = await redis.get(`apiKey:${hashedApiKey}`);
        if(cachedBotId){
            (req as any).botId = cachedBotId;
            return next();
        }

        const { data, error } = await supabase.from("API_KEY").select("*").eq("HashedApiKey", hashedApiKey).eq("isRevoked", false).single();
        if(error || !data){
            return res.status(401).json({ message: "You are using a invalid or revoked API key." });
        }
        
        const botId = data.botId;
        //store in redis :
        await redis.set(`apiKey:${hashedApiKey}`, botId, { ex: 3600 }); //cache for 1 hour
        (req as any).botId = botId;
        return next();
    }
    catch(error){
        console.error("Error in accessMiddleware:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}