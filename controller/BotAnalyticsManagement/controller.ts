import type { Request, Response } from "express";
import { BotAnalyticsModel } from "../../Models/BotAnalytics.js";

export const getAnalyticsDataController = async(req : Request, res : Response) : Promise<Response> => {
    try{
        const botId = req.params.botId;
        console.log("Bot ID:", botId);
        if(!botId){
            console.log("Bot ID missing in request params");
            return res.status(400).json({ message : "Bot ID is required."});
        }

        const analyticsData = await BotAnalyticsModel.find({ botId : botId });
        if(!analyticsData || analyticsData.length === 0){
            return res.status(404).json({ message : "No analytics data found for this bot."});  
        }

        return res.status(200).json({message : "Analytics data fetched successfully", result  : analyticsData});
    }
    catch(error){
        console.error("Error in getAnalyticsDataController:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}