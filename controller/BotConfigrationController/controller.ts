import type { Request, Response } from "express";
import { sanitizeAPIResponse } from "../../utils/helper/SantizingApi.js";
import { botConfiguration } from "../../Models/BotConfiguration.js";
import { BotStructureModel } from "../../Models/BotStructure.js";
import { ControlledBotModel } from "../../Models/ControlledBotSchema.js";
import { ControlledBotEdgeModel } from "../../Models/ControlledBotEdges.js";
import { ControlledBotNodeModel } from "../../Models/ControlledBotNodes.js";
import type { constructedControlledBot } from "../../utils/types/ConstructedControlledBot.js";

export const getConfigController = async (req: Request, res: Response): Promise<Response> => {
    try{
        const userId = (req as any).user?.userId;
        const { botId }  = req.params;

        if(!userId || !botId){
            return res.status(400).json({ message : "User ID and Bot ID are required."});
        }

        const botConfig = await botConfiguration.findOne({botId : botId.toString()});
        if(!botConfig){
            return res.status(404).json({ message : "Bot Configuration not found."});
        }

        return res.status(200).json({ message : "Bot Configuration fetched successfully.", botConfig });
    }
    catch(e){
        return res.status(500).json({ message : "Internal Server Error!" });
    }
}

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
        bot.currentState = 'configure';
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

            const result = sanitizeAPIResponse(data, 2);
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

export const updateConfigController = async (req: Request, res: Response): Promise<Response> => {
    try{
        const { config, botId } = req.body;

        if(!botId || !config){
            return res.status(400).json({ message : "Bot ID and Config are required."});
        }

        if(typeof config !== 'object'){
            return res.status(400).json({ message : "Config must be an object."});
        }

        if(!config.botType || !config.websiteType || !config.tone || !config.verbosity || !config.behaviorDescription || !config.examples){
            return res.status(400).json({ message : "Config is missing required fields."});
        }
        const botStatus = await BotStructureModel.findById(botId);
        if(!botStatus){
            return res.status(404).json({ message : "Bot not found."});
        }

        if(botStatus.status === 'deleted' || botStatus.status === 'draft'){
            return res.status(400).json({ message : `Cannot update config for a bot with status: ${botStatus.status}`});
        }

        const botConfig = await botConfiguration.findOne({ botId : botId });
        if(!botConfig){
            return res.status(404).json({ message : "Bot Configuration not found."});
        }

        botConfig.config = config;
        await botConfig.save();

        return res.status(200).json({ message : "Updated Config successfully" });
    }
    catch(e){
        return res.status(500).json({ message : "Internal Server Error!", error : e });
    }
}

export const getControlledBotConfigController = async (req: Request, res: Response): Promise<Response> => {
    try{
        const {botId} = req.params;
        console.log("Received botId:", botId);
        if(!botId)
            return res.status(400).json({ message : "Bot ID is required." });

        const botModel = await ControlledBotModel.findById(botId);
        if(!botModel)
            return res.status(404).json({ message : "Bot not found." });

        const botNodes = await ControlledBotNodeModel.find({ botId : botId });
        if(!botNodes)
            return res.status(200).json({ });

        const BotEdges = await ControlledBotEdgeModel.find({botId : botId});

        const constructedBot : constructedControlledBot = {
            _id : botModel._id,
            name : botModel.name,
            platform : botModel.platform,
            userId : botModel.userId,
            node : botNodes.map(node =>{
                return {
                    executor : node.executor,
                    title : node.title,
                    message : node.message,
                    apiConfig : node.apiConfig?{
                        endpointKey : node.apiConfig.endpointKey ?? null,
                        method : node.apiConfig.method,
                        nextNodeId : node.apiConfig.nextNodeId?.toString() || "",
                        timeoutMs : node.apiConfig.timeoutMs ?? null,
                        queryParameter : node.apiConfig.queryParameter || undefined,
                    } : null,
                    output : node.output?{
                        mode : node.output.mode,
                        optionCount : node.output.optionCount,
                    }: null,
                    options : BotEdges.filter(edge => edge.fromNodeId.toString() === node._id.toString()).map(edge => {
                        return {
                            intent : edge.intent,
                            toNodeId : edge.toNodeId.toString(),
                            order : edge.order,
                            _id : edge._id,
                            botId : edge.botId
                        }
                    })
                }
            })
        }

        return res.status(200).json({ message : "Bot Configuration fetched successfully.", data: constructedBot});
    }
    catch(e){
        console.log("Error in getControlledBotConfigController:", e);
        return res.status(500).json({ message : "Internal Server Error!", error : e });
    }
}