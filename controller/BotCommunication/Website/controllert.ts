import type { Request, Response } from "express";
import { getRedisClient } from "../../../Redis/connect.js";
import { BotStructureModel } from "../../../Models/BotStructure.js";
import { botConfiguration } from "../../../Models/BotConfiguration.js";
import { freeStyleWebsiteBotPrompt, getToolDefinitions, fetchData } from "../../../utils/System_Prompt/Website.js";
import OpenAI from "openai";
import { BotAnalyticsModel } from "../../../Models/BotAnalytics.js";
import type mongoose from "mongoose";
import crypto from "crypto";
import { ControlledBotModel } from "../../../Models/ControlledBotSchema.js";
import { ControlledBotNodeModel } from "../../../Models/ControlledBotNodes.js";
import { ControlledBotEdgeModel } from "../../../Models/ControlledBotEdges.js";

export const analyticsInsertionHelper = async(botId : any, apiHashKey : string, model : string, latency : number, tokenIn : number, tokenOut : number, totalToken : number, eventType : string) : Promise<void> => {
    try{

        const insertingAnalytics = BotAnalyticsModel.insertOne({
            botId,
            apiHashKey,
            timestamp : new Date(),
            eventType,
            usage : {
                model,
                tokenIn : tokenIn,
                tokenOut : tokenOut,
                totalToken : totalToken,
            },
            performance : {
                latency : latency,
            },
            context : {
                plan : "free",
                region : "us-east-1",
            }
        });
        if(!insertingAnalytics){
            console.error("Failed to insert bot analytics");
            return;
        }
        console.log("Bot analytics inserted successfully");
    }
    catch(e){
        console.error("Error in analticsInsertionHelper:", e);
    }

}

export const freestyleWebsiteBotController = async(req : Request, res : Response) : Promise<Response> =>{
    try{    
        const botId = (req as any).botId;
        const { clientId } = req.cookies;
        const {userMessage} = req.body;
        let apiKey = req.headers['authorization']?.split(' ')[1];
        if(apiKey){
            apiKey = crypto.createHash('sha256').update(apiKey).digest('hex');
        }

        if(!botId || !userMessage){
            return res.status(400).json({ message : "Bot ID and userMessage are required."});
        }

        const redis = getRedisClient();
        const botDetails = await redis.get(`WebsiteBotDetails:${botId}`);
        let botStatus = null, botConfig = null, botName = "CuteBot";

        if(botDetails){
            // Check if botDetails is already an object (some Redis clients auto-parse JSON)
            const parsedDetails = typeof botDetails === 'string' ? JSON.parse(botDetails) : botDetails;
            botStatus = { status: parsedDetails.status };
            botConfig = { config: parsedDetails.config };
            botName = parsedDetails.botName || "CuteBot";
        }
        else{
            botStatus = await BotStructureModel.findOne({ _id: botId, platform: 'Website' });
            if(!botStatus){
                return res.status(404).json({ message : "Bot not found."});
            }

            botConfig = await botConfiguration.findOne({ botId: botId });
            if(!botConfig){
                return res.status(404).json({ message : "Bot configuration not found."});
            }

            await redis.set(`WebsiteBotDetails:${botId}`, JSON.stringify({
                status : botStatus.status,
                botName : botStatus.botName,
                config : botConfig.config,
            }), { ex: 1800 }); //cache for 30 minutes
        };

        if(botStatus.status !== 'active'){
            return res.status(403).json({ message : "Bot is not active."});
        }

        const config = botConfig?.config || {};

        // Normalize examples: supports stored stringified JSON or already-parsed arrays
        let examples: unknown = config.examples;
        if (typeof examples === 'string') {
            try {
                const parsed = JSON.parse(examples);
                examples = parsed;
            } catch (err) {
                console.warn("Failed to parse examples JSON, defaulting to empty array", err);
                examples = [];
            }
        }
        if (!Array.isArray(examples)) {
            examples = [];
        }
        config.examples = examples;

        // Convert examples into prompt-ready text (aligned with testing controller)
        const examplesText = Array.isArray(config.examples) && config.examples.length
            ? config.examples
                .map((example: { question?: string; answer?: string }, idx: number) => `Example ${idx + 1}:
User: ${example.question || ""}
Bot: ${example.answer || ""}`)
                .join("\n\n")
            : undefined;

        const hasApiIntegration = Boolean(config.apiEndpoint || config.apiIntegration);

        const systemPrompt = freeStyleWebsiteBotPrompt({
            botName: botName || "SampleBot",
            botType : config.botType || "General Purpose",
            tone : config.tone || "Friendly",
            verbosity : config.verbosity || "Concise",
            websiteType : config.websiteType || "E-commerce",
            description : config.behaviorDescription || "A helpful website assistant bot.",
            ownerInformation : config.OwnerInformation || "No owner information provided.",
            AdditionalInformation : config.additionalInformation || "No additional information provided.",
            examples : examplesText,
            apiIntegration : hasApiIntegration,
            apiEndpoint : config.apiEndpoint || "",
            apiResponseFormat : config.responseFormat || "",
            apiUsageRule : config.apiUsageRules || "",
        });

        const openai = new OpenAI({
            apiKey: process.env.TEXT_ENHANCER_API_KEY,
            baseURL: "https://api.groq.com/openai/v1",
        });

        //fetching last messages from redis
        let newClientId = clientId;
        let lastMessages = [];
        const redisKey = `WebsiteBotChatHistory:${botId}:${newClientId}`;

        if(!clientId){
            const generatedId = crypto.randomUUID();
            newClientId = generatedId;
            res.cookie('clientId', generatedId, {
                maxAge : 60*60*1000,
            });
        }
        else{
            // Limit to last 4 messages (2 turns) to reduce token usage
            const storedMessages = await redis.lrange(redisKey, -4, -1);

            if(storedMessages && storedMessages.length > 0){
                lastMessages = storedMessages.map(msg => typeof msg === 'string' ? JSON.parse(msg) : msg);  
            }
        }

        const apiUsageRules = config.apiUsageRules || "";
        const tools = hasApiIntegration ? getToolDefinitions(hasApiIntegration, apiUsageRules) : [];

        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: "system", content: systemPrompt },
            ...lastMessages,
            { role: "user", content: userMessage }
        ];

        let finalResponse = "";
        let iterations = 0;
        const maxIterations = 5; // Prevent infinite loops
        let tokenIn : number = 0;
        let tokenOut : number = 0;
        let totalToken : number = 0;
        let latency = new Date().getTime();

        while (iterations < maxIterations) {
            iterations++;

            const requestParams: any = {
                model: "openai/gpt-oss-safeguard-20b",
                messages,
            };

            if (tools.length > 0) {
                requestParams.tools = tools;
            }

            const response = await openai.chat.completions.create(requestParams);
            tokenIn =  response.usage?.prompt_tokens === undefined ? 0 : tokenIn + response.usage?.prompt_tokens|| 0;
            tokenOut = response.usage?.completion_tokens === undefined ? 0 : tokenOut + response.usage?.completion_tokens|| 0;
            totalToken = tokenIn + tokenOut;

            if (!response?.choices?.length) {
                return res.status(500).json({ error: "Failed to get response from OpenAI" });
            }

            const message = response.choices[0] === undefined  ? {content : "Something went Wrong!"} : response.choices[0].message;

            if ((message as any).tool_calls && (message as any).tool_calls.length > 0) {
                messages.push({
                    role: "assistant",
                    content: message.content || "",
                    tool_calls: (message as any).tool_calls as any,
                });

                for (const toolCall of (message as any).tool_calls) {
                    try {
                        let toolResult = "";

                        if (toolCall.function.name === "fetch_external_data") {
                            // Parse tool arguments - LLM decides parameter names based on API usage rules
                            let args: any = {};
                            try {
                                const rawArgs = toolCall.function.arguments;
                                args = typeof rawArgs === "string" ? JSON.parse(rawArgs || "{}") : (rawArgs || {});
                            } catch (parseErr) {
                                console.warn("Failed to parse tool arguments; using empty args", parseErr);
                                args = {};
                            }

                            const { endpoint, queryParams } = args;
                            if (!endpoint) {
                                toolResult = "Error: Missing endpoint in tool arguments";
                            } else {
                                const params = new URLSearchParams();

                                // LLM provides queryParams with dynamic parameter names (q, category, product, etc.)
                                if (queryParams && typeof queryParams === "object") {
                                    Object.entries(queryParams).forEach(([key, value]) => {
                                        if (value !== null && value !== undefined) {
                                            params.append(key, String(value));
                                        }
                                    });
                                }

                                const queryString = params.toString();
                                const apiUrl = queryString
                                    ? (endpoint.includes("?") ? `${endpoint}&${queryString}` : `${endpoint}?${queryString}`)
                                    : endpoint;

                                console.log("Query Params from LLM:", queryParams);
                                console.log("Built Query String:", queryString);
                                console.log("Fetching data from API URL:", apiUrl);
                                const data = await fetchData(apiUrl);
                                toolResult = JSON.stringify(data, null, 2);
                            }
                        }

                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: toolResult,
                        } as any);
                    } catch (toolError: any) {
                        console.error("Tool execution error:", toolError);
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: `Error: ${toolError.message || "Failed to fetch data"}`,
                        } as any);
                    }
                }
            } else {
                finalResponse = message.content || "";
                break;
            }
        }

        

        if (!finalResponse) {
            return res.status(500).json({ error: "Failed to get final response from LLM" });
        }

        // Update chat history in Redis
        const lastMessageLenght = lastMessages.length;
        if(lastMessageLenght >= 4){
            // Keep only last 4 messages (2 conversation turns)
            await redis.ltrim(redisKey, -3, -1);
        }
        await redis.rpush(redisKey, JSON.stringify({ role: "user", content: userMessage }));
        await redis.rpush(redisKey, JSON.stringify({ role: "assistant", content: finalResponse }));
        await redis.expire(redisKey, 60 * 60); // 1 hour expiry
        latency = new Date().getTime() - latency;

        // Insert analytics
        (async()=>{
            await analyticsInsertionHelper(botId, apiKey || "NOT_FOUND", "openai/gpt-oss-safeguard-20b", latency, tokenIn, tokenOut, totalToken, "request");
        })()

        return res.status(200).json({ message: finalResponse });
    }
    catch(e){
        console.error("Error in freestyleWebsiteBotController:", e);
        return res.status(500).json({ message: "Internal server error" });
    }
}



export const controlledStyleWebsiteBotController = async(req : Request, res : Response) : Promise<Response> =>{
    try{
        //getting and validating data of bot.
        const { botId } = req.body;
        if(!botId){
            return res.status(400).json({ message : "Bot ID is required."});
        }

        let { sessionId } = req.cookies;
        if(!sessionId){
            const generatedId = crypto.randomUUID();
            sessionId = generatedId;
            res.cookie('sessionId', generatedId, {
                maxAge : 60*60*1000,//1 hour
            });
        };
        //until here we gets and validate bot data.

        //creating bot details and session details redis keys for fetching first node of data from either redis or db.
        const redis = getRedisClient();
        const redisKeyForBot = `controlledWebsiteBotFirstNode:${botId}`;
        const sessionalRedisKey = `controlledWebsiteBotSessionDetail:${botId}:${sessionId}`;
        
        //Finding bot details from redis, if not found then from db and storing it in redis for next time use.
        let botDetails = await redis.get(redisKeyForBot);
        if(!botDetails){
            const botDBDetails = await ControlledBotModel.findById(botId);
            if(!botDBDetails){
                return res.status(404).json({ message : "Bot not found or deleted by owner."});//0.01% chance of hiting this thing.
            }
            botDetails = {
                name : botDBDetails.name,
                status : botDBDetails.status,
                platform : botDBDetails.platform,
                entryNodeId : botDBDetails.entryNodeId,
            };

            if(!botDetails ||  botDBDetails.status !== 'active'){
                return res.status(403).json({ message : "Bot is not active."});
            };

            await redis.set(redisKeyForBot, JSON.stringify(botDetails), { ex: 3600 });//set for 1 hr. 
        }
        else{
            botDetails = typeof botDetails === 'string' ? JSON.parse(botDetails) : botDetails;
        }

        //finding the ongoing session to retrive where user left (from redis), if not found(means user is requesting for first time or redis has lost the data),then creating new session. 
        const sessionalBotDetails = await redis.get(sessionalRedisKey);
        if(!sessionalBotDetails){
            const initialNodeDetails = await ControlledBotNodeModel.findOne({ botId : botId, _id : (botDetails as any).entryNodeId})
            if(!initialNodeDetails){
                return res.status(500).json({ message : "Bot configuration error. Please contact bot owner."});
            }

            const optionsForIntialNode = await ControlledBotEdgeModel.find({ fromNodeId : initialNodeDetails._id});
            console.log("Initial Node Options:", optionsForIntialNode);
        }


        return res.status(200).json({ message: "Controlled Style Website Bot Controller - To be implemented." });
    }
    catch(e){
        console.error("Error in controlledStyleWebsiteBotController:", e);
        return res.status(500).json({ message: "Internal server error" });
    }
}