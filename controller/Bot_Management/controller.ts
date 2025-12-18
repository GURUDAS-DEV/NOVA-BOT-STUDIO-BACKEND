import type { Request, Response } from "express";
import { BotStructureModel } from "../../Models/BotStructure.js";
import { transistionBotLifecycle } from "../../utils/helper/botLifecycle.js";


//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//----------------------------------------------Create bot controller---------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//

export const createBotController = async (req: Request, res: Response): Promise<Response> => {
    try {
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
        if (!createdBot) {
            return res.status(400).json({ message: "Failed to create bot" });
        }


        return res.status(200).json({ message: "Bot created successfully" });
    }
    catch (error) {
        return res.status(500).json({ message: "Internal Server Error", error });
    }
};


//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------Get Bot Details for Home Page-------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//

export const getBotDetailsForHomePageController = async (req: Request, res: Response): Promise<Response> => {
    try {
        const userId = (req as any).user?.userId;
        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        const bots = await BotStructureModel.find({ userId }).sort({ created_at: -1 });
        if (!bots) {
            return res.status(404).json({ message: "No bots found for this user" });
        }

        let noOfBots = bots.length;
        let noOfActiveBots = bots.filter((bot) => bot.status === "active").length;
        const recentBots = bots.slice(0, 4);

        return res.status(200).json({ message: "BOT LISTS FOR HOMEPAGE", noOfActiveBots, noOfBots, recentBots });
    }
    catch (e) {
        return res.status(500).json({ message: "Internal Server Error", e });
    }

}

//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//-------------------------------------------Get All Bots for Manage Page------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//

export const getAllBotsForManagePageController = async (req: Request, res: Response): Promise<Response> => {
    try {
        const userId = (req as any).user?.userId;
        let { cursor } = req.query as { cursor: string };

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        if (cursor === "null" || cursor === "undefined") {
            cursor = new Date().toISOString();
        }

        const limit = 10;
        const query: any = { userId };

        if (cursor) {
            query.created_at = { $lt: new Date(cursor as string) };
        }

        const bots = await BotStructureModel.find(query)
            .where({ status: { $ne: "deleted" } })
            .sort({ created_at: -1 })
            .limit(limit + 1);

        if (!bots || bots.length === 0) {
            return res.status(404).json({ message: "No bots found for this user" });
        }

        const hasMore = bots.length > limit;
        if (hasMore)
            bots.pop();

        const nextCursor = bots.length > 0 ? bots[bots.length - 1]?.created_at : null;
        const totalBots = await BotStructureModel.countDocuments({ userId }).where({ status: { $ne: "deleted" } });

        return res.status(200).json({ message: "Bots Details!!!", cursor: nextCursor, bots, hasMore, totalBots });
    }
    catch (e) {
        console.log(e);
        return res.status(500).json({ message: "Internal Server Error", e });
    }
}


//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//----------------------------------------------Delete Bot Controller----------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//



export const deleteBotController = async (req: Request, res: Response): Promise<Response> => {
    try {
        const userId = (req as any).user?.userId;
        const { botId } = req.body;
        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        const bot = await BotStructureModel.findById(botId);
        if (!bot) {
            return res.status(404).json({ message: "Bot not found" });
        }

        if (bot.userId !== userId) {
            return res.status(403).json({ message: "Forbidden: You don't have permission to delete this bot" });
        }

        bot.status = transistionBotLifecycle(bot.status as any, "deleted");
        bot.deleted_at = new Date();
        await bot.save();
        return res.status(200).json({ message: "Bot Deleted Successfully" });
    }
    catch (e) {
        return res.status(500).json({ message: "Internal Server Error", e });
    }
}


//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//------------------------------------Get Deleted Bot Controllers(recycle bin)------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//

export const getDeletedBotsController = async (req: Request, res: Response): Promise<Response> => {

    try {
        const userId = (req as any).user?.userId;
        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        };

        const deletedBots = await BotStructureModel.find({ userId }).where({ status: "deleted" }).sort({ created_at: -1 });

        if (!deletedBots || deletedBots.length === 0) {
            return res.status(404).json({ message: "No deleted bots found" });
        }

        return res.status(200).json({ message: "Deleted Bots fetched successfully", deletedBots });
    }
    catch (e) {
        return res.status(500).json({ message: "Internal Server Error", e });
    }
}

//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------Restore Deleted Bot Controller------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//

export const restoreDeletedBotController = async (req: Request, res: Response): Promise<Response> => {
    try {
        const userId = (req as any).user?.userId;
        const { botId } = req.body;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }
        if(!botId){
            return res.status(400).json({ message: "Bot ID is required" });
        }

        const bot = await BotStructureModel.findById(botId);
        if (!bot) {
            return res.status(404).json({ message: "Bot not found" });
        }

        if(bot.userId !== userId){
            return res.status(403).json({ message: "Forbidden: You don't have permission to restore this bot" });
        }

        bot.status = transistionBotLifecycle(bot.status as any, "draft");
        bot.deleted_at = null;
        await bot.save();

        return res.status(200).json({ message: "Bot Restored Successfully" });
    }
    catch (e) {
        return res.status(500).json({ message: "Internal Server Error", e });
    }
}

//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------Permanently Delete Bot Controller--------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//

export const permanentlyDeleteBotController = async (req: Request, res: Response): Promise<Response> => {
    try{
        const userId = (req as any).user?.userId;
        const { botId } = req.body;

        if(!userId || !botId){
            return res.status(400).json({ message: "User ID and bot ID bot are required! But not provided" });
        }

        const bot = await BotStructureModel.findByIdAndDelete(botId);
        if(!bot){
            return res.status(404).json({ message: "Bot not found" });
        }
        return res.status(200).json({ message: "Bot Permanently Deleted Successfully", bot });
    }
    catch(e){
        return res.status(500).json({ message: "Internal Server Error", e });
    }

}