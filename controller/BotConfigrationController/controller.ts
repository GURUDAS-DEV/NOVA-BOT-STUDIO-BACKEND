import type { Request, Response } from "express";
import { sanitizeAPIResponse } from "../../utils/helper/SantizingApi.js";
import { botConfiguration } from "../../Models/BotConfiguration.js";
import { BotStructureModel } from "../../Models/BotStructure.js";

export const setConfigController = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { botId, userId, botStyle, botType, websiteType, otherWebsiteType, tone, verbosity, behaviorDescription, OwnerInformation, additionalInformation, examples, apiEndpoint, responseFormat, apiUsageRules }  = req.body;

        if (!botId || !userId || !botType || !websiteType || !tone || !verbosity || !behaviorDescription || !examples ) {
            return res.status(404).json({ message: "Required All Neccessary fields in a proper manner!" });
        };

        const bot = await BotStructureModel.findById(botId);
        if (!bot) {
            return res.status(404).json({ message: "Bot not found!" });
        }

        const botConfigExists = await botConfiguration.findOne({ botId : botId });
        if (botConfigExists) {
            return res.status(405).json({ message: "Bot Configuration already exists!" });
        }

        let websiteContext : string = websiteType;
        if (websiteType === "Other" && otherWebsiteType) {
            websiteContext = otherWebsiteType;
        }
        
        const newBotConfig = await botConfiguration.insertOne({
            botId, 
            userId,
            style : botStyle || 'free-style',
            config : {
                botType, websiteType: websiteContext, tone, verbosity, behaviorDescription, OwnerInformation, additionalInformation, examples, apiEndpoint, responseFormat, apiUsageRules
            },
            configStatus : 'config'
        });
        if(!newBotConfig) {
            return res.status(500).json({ message: "Failed to set Bot Configuration!" });
        }

        bot.status = 'inactive';
        await bot.save();

        return res.status(200).json({ message: "Bot is being successfully set!" });
    }
    catch (e) {
        console.error("Error in setConfigController:", e);
        return res.status(500).json({ message: "Internal Server Error!" });
    }
}

export const testUserGivenApiController = async (req: Request, res: Response): Promise<Response> => {
    try {
        let { apiEndpoint } = req.body;

        if (!apiEndpoint) {
            return res.status(404).json({ message: "API Endpoint is required!" });
        }
        apiEndpoint = apiEndpoint.trim();

        try {
            const response = await fetch(apiEndpoint);
            if (!response.ok) {
                return res.status(400).json({ message: "API Endpoint is not reachable!" });
            }

            const data = await response.json();
            if (!data) {
                return res.status(400).json({ message: "API Endpoint did not return valid JSON!" });
            }

            const result = sanitizeAPIResponse(data);
            if (!result) {
                return res.status(400).json({ message: "API Response could not be sanitized!" });
            }
            return res.status(200).json({ message: "API is valid and working fine!", result });
        }
        catch (e) {
            return res.status(400).json({ message: "API Endpoint is not reachable!"});
        }

    }
    catch (e) {
        return res.status(500).json({ message: "Internal Server Error!" });
    }

}