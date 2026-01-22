import type { Request, Response } from "express";
import { BotStructureModel } from "../../Models/BotStructure.js";
import { supabase } from "../../Database/postgresql.js";
import { generateAPIKey } from "../../utils/helper/APIKeyGenerator.js";
import { hashApiKey } from "../../utils/helper/APIKeyHashing.js";
import { getRedisClient } from "../../Redis/connect.js";
import { ControlledBotModel } from "../../Models/ControlledBotSchema.js";
import { pipeline } from "stream";


export const APIKeyForWebsiteController = async(req : Request, res : Response) : Promise<Response> => {
    try{
        const userId = (req as any).user?.userId;
        if(!userId){
            return res.status(400).json({ message : "User ID is required."});
        }

        const freeStyleBots = BotStructureModel.collection.name;


        const pipeline : any[] = [
            { $match: { userId, status : { $nin: ['deleted', 'draft'] } } },
            {
                $project: {
                    _id : 1,
                    platform : "$platform",
                    name : "$name",
                    status : 1,
                    style : 1,
                    createdAt : 1,
                },
            },
            {
                $unionWith : {
                    coll : freeStyleBots,
                    pipeline : [
                        { $match: { userId, status : { $nin: ['deleted', 'draft'] } } },
                        {
                            $project : {
                                _id : 1, 
                                platform : "$platform",
                                name : "$botName",
                                status : 1,
                                style : 1,
                                createdAt : "$created_at",
                            },
                        },
                    ],
                },
            },
        ];
        pipeline.push({ $sort : { createdAt : -1 } });

        const websiteBots = await ControlledBotModel.aggregate(pipeline);

        if(!websiteBots || websiteBots.length === 0){
            return res.status(404).json({ message : "No website bots found for this user."});
        }
               

        return res.status(200).json({message : "Bot list fetched successfully", bots : websiteBots});
    }
    catch(error){
        return res.status(500).json({ message: "Internal server error" });
    }
}

export const GenerateNewApiKeyForWebsiteController = async(req : Request, res : Response) : Promise<Response> =>{
    try{

        const userId = (req as any).user?.userId;
        const { botId } = req.body;

        if(!userId || !botId){
            return res.status(400).json({ message : "User ID and Bot ID are required."});
        }

        let bot = await BotStructureModel.findOne({ _id: botId, platform: 'Website' });
        if(!bot){
            bot = await ControlledBotModel.findOne({ _id: botId, platform: 'Website' });
            if(!bot)
                return res.status(404).json({ message : "Bot not found."});
        }

        const {data , error} = await supabase.from('API_KEY').update({ isRevoked : true }).eq('botId', botId).eq('isRevoked', false).select("HashedApiKey");

        const redis = getRedisClient();
        if(data && data.length > 0){
            await redis.del(`apiKey:${(data[0] as any).HashedApiKey}`); //delete cached api key if exists
        }

        if(error)
            return res.status(500).json({ message: "Failed to revoke existing API keys." });

        const newApiKey = generateAPIKey();
        const hashedApiKey = hashApiKey(newApiKey);

        const {data : insertionData, error :insertionError} = await supabase.from("API_KEY").insert({botId, HashedApiKey: hashedApiKey, isRevoked: false});

        if(insertionError){
            return res.status(500).json({ message: "Failed to generate new API key." });
        }

        return res.status(200).json({ message: "New API key generated successfully", apiKey : newApiKey } );
    }
    catch(e){
        return res.status(500).json({ message: "Internal server error" });
    }
}