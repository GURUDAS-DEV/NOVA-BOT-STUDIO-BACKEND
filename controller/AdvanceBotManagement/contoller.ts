import type { Request, Response } from "express";
import { generateAPIKey } from "../../utils/helper/APIKeyGenerator.js";
import { BotStructureModel } from "../../Models/BotStructure.js";
import { botConfiguration } from "../../Models/BotConfiguration.js";
import { transistionBotLifecycle } from "../../utils/helper/botLifecycle.js";
import { supabase } from "../../Database/postgresql.js";
import { hash } from "bcrypt-ts";
import { hashApiKey } from "../../utils/helper/APIKeyHashing.js";


export const startBotController = async(req : Request, res : Response) : Promise<Response> => {
    try{
        const { botId } = req.body;
        const userId = (req as any).user?.userId;

        if(!botId || !userId){
            return res.status(400).json({ message : "Bot ID and User ID are required."});
        }
        const botDetails = await BotStructureModel.findById(botId);
        if(!botDetails){
            return res.status(404).json({ message : "Bot not found."});
        }

        if(botDetails.userId !== userId){
            return res.status(403).json({ message : "Unauthorized access to the bot."});
        }

        const botConfig = await botConfiguration.find({botId : botId});
        if(!botConfig){
            return res.status(404).json({ message : "Bot configuration not found."});
        }
        
        const Generated_API_KEY = generateAPIKey();
        const hashedApiKey = hashApiKey(Generated_API_KEY);
        console.log(botDetails.status);

        const { data , error } = await supabase.from("API_KEY").insert({
            botId : botId,
            HashedApiKey : hashedApiKey,
            isRevoked : false,
        });

        if(error){
            return res.status(500).json({ message : "Error storing API key.", error : error.message });
        }

        botDetails.status = transistionBotLifecycle(botDetails.status, 'active');
        await botDetails.save();

        return res.status(200).json({ message : "Bot started successfully.", apiKey : Generated_API_KEY });
    }
    catch(e){
        console.error("Error in startBotController:", e);   
        return res.status(500).json({ message : "Internal Server Error", error : (e as Error).message });
    }
}