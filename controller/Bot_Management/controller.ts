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



export const getBotDetailsForHomePageController = async(req : Request, res : Response) : Promise<Response> => {
    try{
        const userId = (req as any).user?.userId;
        if(!userId){
            return res.status(400).json({ message : "User ID is required" });
        }

        const bots = await BotStructureModel.find({ userId }).sort({ created_at: -1 });
        if(!bots){
            return res.status(404).json({ message : "No bots found for this user" });
        }

        let noOfBots = bots.length;
        let noOfActiveBots = bots.filter((bot) => bot.status === "active").length;
        const recentBots = bots.slice(0, 4);        

        return res.status(200).json({ message : "BOT LISTS FOR HOMEPAGE", noOfActiveBots, noOfBots, recentBots });
    }
    catch(e){
        return res.status(500).json({ message : "Internal Server Error", e });
    }

}


export const getAllBotsForManagePageController = async(req : Request, res : Response) : Promise<Response> => {
    try{
        const userId = (req as any).user?.userId;
        let { cursor } = req.query as { cursor : string };

        if(!userId){
            return res.status(400).json({ message : "User ID is required" });
        }

        if(cursor === "null" || cursor === "undefined"){
            cursor = new Date().toISOString();
        }

        const limit = 10;
        const query : any = {userId};

        if(cursor){
            query.created_at = { $lt : new Date(cursor as string) };
        }

        const bots = await BotStructureModel.find(query)
            .sort({ created_at : -1 })
            .limit(limit + 1); 

        if(!bots || bots.length === 0){
            return res.status(404).json({ message : "No bots found for this user" });
        }   

        const hasMore = bots.length > limit;
        if(hasMore)
            bots.pop();
    
        const nextCursor = bots.length > 0 ? bots[bots.length - 1]?.created_at : null;
        const totalBots = await BotStructureModel.countDocuments({ userId });

        return res.status(200).json({ message : "Bots Details!!!", cursor : nextCursor, bots, hasMore, totalBots });
    }
    catch(e){
        console.log(e);
        return res.status(500).json({ message : "Internal Server Error", e });
    }
}


export const deleteBotController = async(req : Request, res : Response) : Promise<Response> => {
    try{
        const userId = (req as any).user?.userId;
        const { botId } = req.body;
        if(!userId){
            return res.status(400).json({ message : "User ID is required" });
        }

        const bot = await BotStructureModel.findByIdAndDelete(botId);
        if(!bot){
            return res.status(404).json({ message : "Bot not found" });
        }

        return res.status(200).json({ message : "Bot Deleted Successfully" });
    }
    catch(e){
        return res.status(500).json({ message : "Internal Server Error", e });
    }
}