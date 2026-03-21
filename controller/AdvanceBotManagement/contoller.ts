import type { Request, Response } from "express";
import { generateAPIKey } from "../../utils/helper/APIKeyGenerator.js";
import { BotStructureModel } from "../../Models/BotStructure.js";
import { botConfiguration } from "../../Models/BotConfiguration.js";
import { transistionBotLifecycle } from "../../utils/helper/botLifecycle.js";
import { supabase } from "../../Database/postgresql.js";
import { hash } from "bcrypt-ts";
import { hashApiKey } from "../../utils/helper/APIKeyHashing.js";
import { ControlledBotModel } from "../../Models/ControlledBotSchema.js";
import { getDiscordClientId } from "../../integrations/Discord/discordClient.js";


export const startBotController = async(req : Request, res : Response) : Promise<Response> => {
    try{
        const { botId } = req.body;
        const userId = (req as any).user?.userId;

        if(!botId || !userId){
            return res.status(400).json({ message : "Bot ID and User ID are required."});
        }
        let botDetails = await BotStructureModel.findById(botId);
        if(!botDetails){
            botDetails = await ControlledBotModel.findById(botId);
            if(!botDetails)
                return res.status(404).json({ message : "Bot not found."});
        }

        if(botDetails?.userId !== userId){
            return res.status(403).json({ message : "Unauthorized access to the bot."});
        }

        if(botDetails.platform === "Telegram"){
             botDetails.status = transistionBotLifecycle(botDetails.status, 'active');
            await botDetails.save();
            
            return res.status(200).json({ message : "Telegram Bot started successfully." });
        }

        // ─── Discord Bot ───
        if(botDetails.platform === "Discord"){
            botDetails.status = transistionBotLifecycle(botDetails.status, 'active');
            await botDetails.save();
            
            const clientId = getDiscordClientId();
            if(!clientId){
                return res.status(500).json({ 
                    message : "Discord bot not ready. Please try again in a moment.", 
                    error: "CLIENT_ID not available yet"
                });
            }

            const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&scope=bot%20applications.commands&permissions=274877975552`;
            
            return res.status(200).json({ 
                message : "Discord Bot started successfully.", 
                clientId,
                botId: String(botDetails._id),
                inviteUrl,
            });
        }

        const botConfig = await botConfiguration.find({botId : botId});
        if(!botConfig){
            return res.status(404).json({ message : "Bot configuration not found."});
        }
        console.log("ENTERED")
        
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