import type { Request, Response } from "express";
import { BotStructureModel } from "../../Models/BotStructure.js";


export const createBotController = async(req : Request, res : Response) : Promise<Response> => {
    try{
        const { userId, botName, botDescription, botAvatar, platform, purpose, intelligenceSource } = req.body;

        const createdBot = BotStructureModel.create({
            userId,
            botName,
            botDescription,
            botAvatar,
            platform,
            purpose,
            intelligenceSource,
            status: "draft",
        })
        if(!createdBot){
            return res.status(400).json({ message : "Failed to create bot" });
        }

        
        return res.status(200).json({ message : "Bot created successfully" });
    }
    catch(error){
        return res.status(500).json({ message : "Internal Server Error", error });
    }
};