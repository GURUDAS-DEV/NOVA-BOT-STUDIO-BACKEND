import { BotStructureModel } from "../../../Models/BotStructure.js";

export const updateScrapingStatus = async (botId : string, status : "notOpted" | "running" | "completed" | "failed") : Promise<void> =>{
    try{
        const bot = await BotStructureModel.findById(botId);
        if(!bot){
            throw new Error(`Bot with ID ${botId} not found.`);
            return;
        }
        if(!helperFunction(bot.scrapeStatus, status)){
            console.error(`Invalid status transition from ${bot.scrapeStatus} to ${status} for bot ${botId}.`);
            throw new Error(`Invalid status transition from ${bot.scrapeStatus} to ${status}.`);
            return;
        }
        const updateStatus = await BotStructureModel.findByIdAndUpdate(botId, { scrapeStatus: status });
        if(!updateStatus){
            console.error(`Failed to update scraping status for bot ${botId}.`);
            throw new Error(`Failed to update scraping status for bot ${botId}.`);
        }
    }
    catch(error){
        console.error(`Error updating scraping status for bot ${botId}:`, error);
    }
};

const helperFunction = (currentStatus : "notOpted" | "running" | "completed" | "failed", nextStatus : "notOpted" | "running" | "completed" | "failed") => {
    // Helper function to determine if the status transition is valid
    const validTransitions: Record<string, string[]> = {
        "notOpted": ["running", "failed"],
        "running": ["completed", "failed", "notOpted"],
        "completed": [],
        "failed": ["running"],
    };

    return validTransitions[currentStatus]?.includes(nextStatus) || false;
};