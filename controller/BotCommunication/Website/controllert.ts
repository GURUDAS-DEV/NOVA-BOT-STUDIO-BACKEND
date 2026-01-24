import type { Request, Response } from "express";
import { getRedisClient } from "../../../Redis/connect.js";
import { BotStructureModel } from "../../../Models/BotStructure.js";
import { botConfiguration } from "../../../Models/BotConfiguration.js";
import { freeStyleWebsiteBotPrompt, getToolDefinitions, fetchData } from "../../../utils/System_Prompt/Website.js";
import { OpenAI } from "openai";
import { BotAnalyticsModel } from "../../../Models/BotAnalytics.js";
import type mongoose from "mongoose";
import crypto from "crypto";
import { ControlledBotModel } from "../../../Models/ControlledBotSchema.js";
import { ControlledBotNodeModel } from "../../../Models/ControlledBotNodes.js";
import { ControlledBotEdgeModel } from "../../../Models/ControlledBotEdges.js";
import { apiConstructorSystemPrompt } from "../../../utils/System_Prompt/ApiConstructor.js";
import { sanitizeAPIResponse } from "../../../utils/helper/SantizingApi.js";
import { summarizingApiResultSystemPrompt } from "../../../utils/System_Prompt/summarizingApiResult.js";

//----------------------------------------------------------------------------------------------------------------//
//----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------Helper and miscellaneous functions -------------------------------------//
//----------------------------------------------------------------------------------------------------------------//
//----------------------------------------------------------------------------------------------------------------//
const redis = getRedisClient();

// Interfaces for Controlled Bot Flow
interface ControlledBotDetail {
    name: string;
    status: string;
    platform: string;
    entryNodeId: mongoose.Types.ObjectId;
}

interface FormattedOption {
    optionId: mongoose.Types.ObjectId;
    intent: string;
    toNodeId: mongoose.Types.ObjectId;
    order: number;
}

interface NodeWithOptions {
    currentNode: any;
    options: FormattedOption[];
}

interface SessionDetail {
    currentNodeId: string;
    previousNodeId: string | null;
}

interface apiConstructorTemplate {
    success: boolean;
    confidence?: number;
    apiRequest?: {
        method: "GET";
        endpoint: string;
        queryParams: Object;
    };
    error?: Object;
}

const getFromRedisStringOnly = async (redisKey: string): Promise<any> => {
    try {
        const data = await redis.get(redisKey);
        if (data) {
            return typeof data === 'string' ? JSON.parse(data) : data;
        }
        return null;
    }
    catch (e) {
        console.error("Error in getFromRedisStringOnly:", e);
        return null;
    }
};

//----------------------------------------------------------------------------------------------------------------//
//----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------Helper Functions ends here---------------------------------------------//
//----------------------------------------------------------------------------------------------------------------//
//----------------------------------------------------------------------------------------------------------------//



export const analyticsInsertionHelper = async (botId: any, apiHashKey: string, model: string, latency: number, tokenIn: number, tokenOut: number, totalToken: number, eventType: string): Promise<void> => {
    try {

        const insertingAnalytics = BotAnalyticsModel.insertOne({
            botId,
            apiHashKey,
            timestamp: new Date(),
            eventType,
            usage: {
                model,
                tokenIn: tokenIn,
                tokenOut: tokenOut,
                totalToken: totalToken,
            },
            performance: {
                latency: latency,
            },
            context: {
                plan: "free",
                region: "us-east-1",
            }
        });
        if (!insertingAnalytics) {
            console.error("Failed to insert bot analytics");
            return;
        }
        console.log("Bot analytics inserted successfully");
    }
    catch (e) {
        console.error("Error in analticsInsertionHelper:", e);
    }

}

export const freestyleWebsiteBotController = async (req: Request, res: Response): Promise<Response> => {
    try {
        const botId = (req as any).botId;
        const { clientId } = req.cookies;
        const { userMessage } = req.body;
        let apiKey = req.headers['authorization']?.split(' ')[1];
        if (apiKey) {
            apiKey = crypto.createHash('sha256').update(apiKey).digest('hex');
        }

        if (!botId || !userMessage) {
            return res.status(400).json({ message: "Bot ID and userMessage are required." });
        }


        const botDetails = await getFromRedisStringOnly(`WebsiteBotDetails:${botId}`);
        let botStatus = null, botConfig = null, botName = "CuteBot";

        if (botDetails) {
            // Check if botDetails is already an object (some Redis clients auto-parse JSON)
            const parsedDetails = typeof botDetails === 'string' ? JSON.parse(botDetails) : botDetails;
            botStatus = { status: parsedDetails.status };
            botConfig = { config: parsedDetails.config };
            botName = parsedDetails.botName || "CuteBot";
        }
        else {
            botStatus = await BotStructureModel.findOne({ _id: botId, platform: 'Website' });
            if (!botStatus) {
                return res.status(404).json({ message: "Bot not found." });
            }

            botConfig = await botConfiguration.findOne({ botId: botId });
            if (!botConfig) {
                return res.status(404).json({ message: "Bot configuration not found." });
            }

            await redis.set(`WebsiteBotDetails:${botId}`, JSON.stringify({
                status: botStatus.status,
                botName: botStatus.botName,
                config: botConfig.config,
            }), { ex: 1800 }); //cache for 30 minutes
        };

        if (botStatus.status !== 'active') {
            return res.status(403).json({ message: "Bot is not active." });
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
            botType: config.botType || "General Purpose",
            tone: config.tone || "Friendly",
            verbosity: config.verbosity || "Concise",
            websiteType: config.websiteType || "E-commerce",
            description: config.behaviorDescription || "A helpful website assistant bot.",
            ownerInformation: config.OwnerInformation || "No owner information provided.",
            AdditionalInformation: config.additionalInformation || "No additional information provided.",
            examples: examplesText,
            apiIntegration: hasApiIntegration,
            apiEndpoint: config.apiEndpoint || "",
            apiResponseFormat: config.responseFormat || "",
            apiUsageRule: config.apiUsageRules || "",
        });

        const openai = new OpenAI({
            apiKey: process.env.TEXT_ENHANCER_API_KEY,
            baseURL: "https://api.groq.com/openai/v1",
        });

        //fetching last messages from redis
        let newClientId = clientId;
        let lastMessages = [];
        const redisKey = `WebsiteBotChatHistory:${botId}:${newClientId}`;

        if (!clientId) {
            const generatedId = crypto.randomUUID();
            newClientId = generatedId;
            res.cookie('clientId', generatedId, {
                maxAge: 60 * 60 * 1000,
            });
        }
        else {
            // Limit to last 4 messages (2 turns) to reduce token usage
            const storedMessages = await redis.lrange(redisKey, -4, -1);

            if (storedMessages && storedMessages.length > 0) {
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
        let tokenIn: number = 0;
        let tokenOut: number = 0;
        let totalToken: number = 0;
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
            tokenIn = response.usage?.prompt_tokens === undefined ? 0 : tokenIn + response.usage?.prompt_tokens || 0;
            tokenOut = response.usage?.completion_tokens === undefined ? 0 : tokenOut + response.usage?.completion_tokens || 0;
            totalToken = tokenIn + tokenOut;

            if (!response?.choices?.length) {
                return res.status(500).json({ error: "Failed to get response from OpenAI" });
            }

            const message = response.choices[0] === undefined ? { content: "Something went Wrong!" } : response.choices[0].message;

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
        if (lastMessageLenght >= 4) {
            // Keep only last 4 messages (2 conversation turns)
            await redis.ltrim(redisKey, -3, -1);
        }
        await redis.rpush(redisKey, JSON.stringify({ role: "user", content: userMessage }));
        await redis.rpush(redisKey, JSON.stringify({ role: "assistant", content: finalResponse }));
        await redis.expire(redisKey, 60 * 60); // 1 hour expiry
        latency = new Date().getTime() - latency;

        // Insert analytics
        (async () => {
            await analyticsInsertionHelper(botId, apiKey || "NOT_FOUND", "openai/gpt-oss-safeguard-20b", latency, tokenIn, tokenOut, totalToken, "request");
        })()

        return res.status(200).json({ message: finalResponse });
    }
    catch (e) {
        console.error("Error in freestyleWebsiteBotController:", e);
        return res.status(500).json({ message: "Internal server error" });
    }
}



export const controlledStyleWebsiteBotController = async (req: Request, res: Response): Promise<Response> => {
    try {
        // Validate and get bot ID
        const { botId } = req.body;
        if (!botId) {
            return res.status(400).json({ message: "Bot ID is required." });
        }

        // Handle session ID - create or retrieve
        let { sessionId } = req.cookies;
        if (!sessionId) {
            sessionId = crypto.randomUUID();
            res.cookie('sessionId', sessionId, {
                maxAge: 60 * 60 * 1000, // 1 hour
            });
        }

        // Setup Redis keys
        const redisKeyForBot = `controlledBotFirstNode:${botId}`;
        const sessionalRedisKey = `controlledBotSessionDetail:${botId}:${sessionId}`;
        const redisKeyForNodes = (nodeId: string) => `controlledBotNodes:${botId}:${nodeId}`;

        // Fetch and validate bot details
        let botDetails: ControlledBotDetail | null = await getFromRedisStringOnly(redisKeyForBot);
        if (!botDetails) {
            const botDBDetails = await ControlledBotModel.findById(botId);
            if (!botDBDetails) {
                return res.status(404).json({ message: "Bot not found or deleted by owner." });
            }

            if (botDBDetails.status !== 'active') {
                return res.status(403).json({ message: "Bot is not active." });
            }

            botDetails = {
                name: botDBDetails.name,
                status: botDBDetails.status,
                platform: botDBDetails.platform,
                entryNodeId: botDBDetails.entryNodeId,
            };

            await redis.set(redisKeyForBot, JSON.stringify(botDetails), { ex: 86400 });
        } else {
            botDetails = typeof botDetails === 'string' ? JSON.parse(botDetails) : botDetails;
        }

        // Check for existing session
        const sessionalBotDetails = await getFromRedisStringOnly(sessionalRedisKey);

        // New session - start from initial node
        if (!sessionalBotDetails) {
            const initialNodeId = botDetails?.entryNodeId;
            if (!initialNodeId) {
                return res.status(500).json({ message: "Bot entry node is not Found. Contact bot owner. Thanks for using us." });
            }

            // Try to get initial node from Redis
            const initialNodeDataFromRedis = await getFromRedisStringOnly(redisKeyForNodes(initialNodeId.toString()));

            if (!initialNodeDataFromRedis) {
                // Fetch from database
                const initialNodeFromDb = await ControlledBotNodeModel.findOne({ _id: initialNodeId, botId: botId });
                if (!initialNodeFromDb) {
                    return res.status(500).json({ message: "Bot entry node data is corrupted or not found. Contact bot owner. Thanks for using us." });
                }

                // Handle initial node based on executor type
                return await processInitialNode(initialNodeFromDb, initialNodeId.toString(), botId, redisKeyForNodes, sessionalRedisKey, res);
            } else {
                // Found in Redis - process and return
                return await processInitialNodeFromRedis(initialNodeDataFromRedis, initialNodeId.toString(), redisKeyForNodes, sessionalRedisKey, sessionId, res);
            }
        } else {
            // Existing session - continue from current node
            const { input, GO_BACK, END_CHAT } = req.body;
            const sessionCurrentNodeId = (sessionalBotDetails as any)?.currentNodeId;

            if (!sessionCurrentNodeId) {
                return res.status(500).json({ message: "Session data is corrupted. Please start a new session." });
            }

            // Handle END_CHAT universally
            if (END_CHAT) {
                try {
                    await redis.del(sessionalRedisKey);
                    res.clearCookie('sessionId');
                } catch { }
                return res.status(200).json({ message: "Conversation ended. Thank you!" });
            }

            let currentNodeDataFromRedis = await getFromRedisStringOnly(redisKeyForNodes(sessionCurrentNodeId));
            if (!currentNodeDataFromRedis) {
                const currentNodeDataFromDb = await ControlledBotNodeModel.findOne({ _id: sessionCurrentNodeId, botId: botId });
                if (!currentNodeDataFromDb) {
                    return res.status(500).json({ message: "Current node data not found. Please start a new session." });
                }

                // Cache the node based on type
                currentNodeDataFromRedis = await cacheNodeByType(currentNodeDataFromDb, sessionCurrentNodeId, botId, redisKeyForNodes);
            }

            const currentNodeData = currentNodeDataFromRedis?.currentNode;
            if (!currentNodeData) {
                return res.status(500).json({ message: "Current node data is corrupted. Please start a new session." });
            }

            // Handle GO_BACK universally (across executors)
            if (GO_BACK) {
                const previousNodeId = (sessionalBotDetails as any)?.previousNodeId;
                if (!previousNodeId) {
                    return res.status(400).json({ message: "No previous node to go back to." });
                }
                let previousNodeDataFromRedis = await getFromRedisStringOnly(redisKeyForNodes(previousNodeId.toString()));
                if (!previousNodeDataFromRedis) {
                    const previousNodeDataFromDb = await ControlledBotNodeModel.findOne({ _id: previousNodeId, botId: botId });
                    if (!previousNodeDataFromDb) {
                        return res.status(500).json({ message: "Previous node data not found. Please start a new session." });
                    }
                    previousNodeDataFromRedis = await cacheNodeByType(previousNodeDataFromDb, previousNodeId.toString(), botId, redisKeyForNodes);
                    previousNodeDataFromRedis = previousNodeDataFromDb as any;
                }
                previousNodeDataFromRedis = previousNodeDataFromRedis;
                await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: previousNodeId.toString(), previousNodeId: null }), { ex: 60 * 60 });

                console.log("Previous Node Data from Redis:(inside, 496)", previousNodeDataFromRedis);
                if (previousNodeDataFromRedis?.currentNode.executor === 'none' && previousNodeDataFromRedis?.currentNode?.output?.mode === 'options') {
                    console.log("Previous Node Data Options:(inside, 499)", previousNodeDataFromRedis.options);
                    return res.status(200).json({ type: "options", nodeData1: previousNodeDataFromRedis });
                } else if (previousNodeDataFromRedis?.currentNode.executor === 'none' && previousNodeDataFromRedis?.currentNode?.output?.mode === 'text') {
                    console.log("Previous Node Data Options:(inside, 501)", previousNodeDataFromRedis.options);
                    return res.status(200).json({ type: "text", nodeData2: previousNodeDataFromRedis, back: { label: "Go Back", _id: "GO_BACK" }, end: { label: "End Chat", _id: "END_CHAT" } });
                } else if (previousNodeDataFromRedis?.currentNode.executor === 'input') {
                    console.log("Previous Node Data Options:(inside, 503)", previousNodeDataFromRedis.options);
                    return res.status(200).json({ type: "input", nodeData3: previousNodeDataFromRedis, back: { label: "Go Back", _id: "GO_BACK" }, end: { label: "End Chat", _id: "END_CHAT" } });
                }
            }


            // Process options node
            if (currentNodeData.executor === 'none' && currentNodeData.output?.mode === 'options') {
                const currentNodeOptions = currentNodeDataFromRedis.options as FormattedOption[];
                const nextNodeId = currentNodeOptions.find((option) => option.intent === input || String(option.optionId) === input)?.toNodeId;


                if (!nextNodeId) {
                    return res.status(400).json({ message: "Invalid option selected. Please select a valid option." });
                }

                let nextNodeDataFromRedis = await getFromRedisStringOnly(redisKeyForNodes(nextNodeId.toString()));

                if (!nextNodeDataFromRedis) {
                    const nextNodeDataFromDb = await ControlledBotNodeModel.findOne({ _id: nextNodeId, botId: botId });
                    if (!nextNodeDataFromDb) {
                        return res.status(500).json({ message: "Next node data not found. Please start a new session." });
                    }

                    // Cache the next node
                    nextNodeDataFromRedis = await cacheNodeByType(nextNodeDataFromDb, nextNodeId.toString(), botId, redisKeyForNodes);
                }

                nextNodeDataFromRedis = nextNodeDataFromRedis?.currentNode || nextNodeDataFromRedis;
                // Return next node
                if (nextNodeDataFromRedis?.executor === 'none' && nextNodeDataFromRedis?.output?.mode === 'options') {

                    await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: nextNodeId.toString(), previousNodeId: sessionCurrentNodeId }), { ex: 60 * 60 });
                    return res.status(200).json({ type: "options", nodeData: nextNodeDataFromRedis });
                }
                else if (nextNodeDataFromRedis?.executor === 'none' && nextNodeDataFromRedis?.output?.mode === 'text') {
                    await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: nextNodeId.toString(), previousNodeId: sessionCurrentNodeId }), { ex: 60 * 60 });//1 hr
                    return res.status(200).json({ type: "text", nodeData: nextNodeDataFromRedis.output.text, back: { label: "Go Back", _id: "GO_BACK" }, end: { label: "End Chat", _id: "END_CHAT" } });
                }
                else if (nextNodeDataFromRedis?.executor === 'input') {

                    await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: nextNodeId.toString(), previousNodeId: sessionCurrentNodeId }), { ex: 60 * 60 });//1 hr
                    return res.status(200).json({ type: "input", nodeData: nextNodeDataFromRedis, back: { label: "Go Back", _id: "GO_BACK" }, end: { label: "End Chat", _id: "END_CHAT" } });
                }
                else if (nextNodeDataFromRedis?.executor === 'api' && nextNodeDataFromRedis?.output?.mode === 'text') {
                    const apiNode = (nextNodeDataFromRedis as any)?.currentNode || nextNodeDataFromRedis;
                    const reqInfo = extractApiRequest(apiNode?.apiConfig);

                    if (!reqInfo || !reqInfo.endpoint) {
                        return res.status(500).json({ message: "API configuration is missing or invalid for the next node." });
                    }
                    const fullApiUrl = buildUrl(reqInfo.endpoint, reqInfo.queryParams || {});
                    const apiData = await callingConstructApiUponUserInput(fullApiUrl);

                    await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: nextNodeId.toString(), previousNodeId: sessionCurrentNodeId }), { ex: 60 * 60 });//1 hr
                    return res.status(200).json({ type: "api", message: apiData, back: { label: "Go Back", _id: "GO_BACK" }, end: { label: "End Chat", _id: "END_CHAT" } });
                }

                else if (nextNodeDataFromRedis?.executor === 'api' && nextNodeDataFromRedis?.output?.mode === 'options') {
                    const apiNode = (nextNodeDataFromRedis as any)?.currentNode || nextNodeDataFromRedis;
                    const reqInfo = extractApiRequest(apiNode?.apiConfig);

                    if (!reqInfo || !reqInfo.endpoint) {
                        return res.status(500).json({ message: "API configuration is missing or invalid for the next node." });
                    }

                    // Build full API URL
                    const fullApiUrl = buildUrl(reqInfo.endpoint, reqInfo.queryParams || {});

                    // Fetch raw API data (bypass sanitizer to keep full list)
                    const rawResponse = await fetch(fullApiUrl);
                    if (!rawResponse.ok) {
                        return res.status(500).json({ message: "Failed to fetch data from API." });
                    }
                    const rawJson = await rawResponse.json();

                    // Normalize to an array while keeping as many items as possible
                    let normalizedResults: any[] = [];
                    if (Array.isArray(rawJson)) {
                        normalizedResults = rawJson;
                    } else if (rawJson && Array.isArray((rawJson as any).samples)) {
                        // If upstream still sends samples array, use it directly
                        normalizedResults = (rawJson as any).samples;
                    } else if (rawJson && typeof rawJson === "object") {
                        normalizedResults = Object.values(rawJson as Record<string, any>);
                    } else if (rawJson) {
                        normalizedResults = [rawJson];
                    }

                    if (!normalizedResults || normalizedResults.length === 0) {
                        return res.status(500).json({ message: "API response is invalid or empty." });
                    }

                    // Take top 4 results
                    const topFourResults = normalizedResults.slice(0, 4);
                    // Convert API response to options using LLM
                    const generatedOptions = await convertApiResponseToOptions(topFourResults, apiNode?.title || "API Options");

                    if (!generatedOptions || generatedOptions.length === 0) {
                        return res.status(500).json({ message: "Failed to generate options from API response." });
                    }

                    // Format options with temporary IDs for frontend
                    const formattedOptionsForFrontend = generatedOptions.map((opt: any, index: number) => ({
                        optionId: `api_option_${index}`,
                        intent: opt.label || opt.intent || `Option ${index + 1}`,
                        value: opt.value || opt.intent,
                        order: index,
                    }));

                    // Prepare node data with options
                    const nodeDataWithOptions = {
                        currentNode: apiNode,
                        options: formattedOptionsForFrontend,
                        isApiGenerated: true,
                    };

                    await redis.set(redisKeyForNodes(nextNodeId.toString()), JSON.stringify(nodeDataWithOptions), { ex: 60 * 60 });
                    await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: nextNodeId.toString(), previousNodeId: sessionCurrentNodeId }), { ex: 60 * 60 });
                    return res.status(200).json({ type: "options", nodeData: nodeDataWithOptions });
                }
            }
            else if (currentNodeData.executor === 'none' && currentNodeData.output?.mode === 'text') {
                const { GO_BACK, END_CHAT } = req.body;
                if (GO_BACK) {
                    const previousNodeId = (sessionalBotDetails as any)?.previousNodeId;
                    if (!previousNodeId) {
                        return res.status(400).json({ message: "No previous node to go back to." });
                    }
                    let previousNodeDataFromRedis = await getFromRedisStringOnly(redisKeyForNodes(previousNodeId.toString()));
                    if (!previousNodeDataFromRedis) {
                        const previousNodeDataFromDb = await ControlledBotNodeModel.findOne({ _id: previousNodeId, botId: botId });
                        if (!previousNodeDataFromDb) {
                            return res.status(500).json({ message: "Previous node data not found. Please start a new session." });
                        }
                        // Cache the previous node
                        previousNodeDataFromRedis = await cacheNodeByType(previousNodeDataFromDb, previousNodeId.toString(), botId, redisKeyForNodes);

                        previousNodeDataFromRedis = previousNodeDataFromDb;
                    };

                    previousNodeDataFromRedis = previousNodeDataFromRedis?.currentNode || previousNodeDataFromRedis;
                    await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: previousNodeId.toString(), previousNodeId: null }), { ex: 60 * 60 });
                    return res.status(200).json({ type: "text", nodeData: previousNodeDataFromRedis, back: { label: "Go Back", _id: "GO_BACK" }, end: { label: "End Chat", _id: "END_CHAT" } });
                }

                await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: sessionCurrentNodeId, previousNodeId: sessionalBotDetails.previousNodeId }), { ex: 60 * 60 });
                return res.status(200).json({ type: "text", nodeData: currentNodeData.output.text, back: { label: "Go Back", _id: "GO_BACK" }, end: { label: "End Chat", _id: "END_CHAT" } });
            }
            else if (currentNodeData.executor === 'input') {
                if (!input) {
                    return res.status(400).json({ message: "A Valid Input is required for this node." });
                }

                const nextNodeId = currentNodeData.inputConfig?.nextNodeId;
                if (!nextNodeId) {
                    return res.status(500).json({ message: "Next node ID is not configured properly. Contact bot owner. Thanks for using us." });
                }
                // Fetch next node based on input
                let nextNodeDataFromRedis = await getFromRedisStringOnly(redisKeyForNodes(nextNodeId.toString()));
                if (!nextNodeDataFromRedis) {
                    const nextNodeDataFromDb = await ControlledBotNodeModel.findOne({ _id: nextNodeId, botId: botId });
                    if (!nextNodeDataFromDb) {
                        return res.status(500).json({ message: "Next node data not found. Please start a new session." });
                    }

                    // Cache the next node
                    nextNodeDataFromRedis = await cacheNodeByType(nextNodeDataFromDb, nextNodeId.toString(), botId, redisKeyForNodes);
                    nextNodeDataFromRedis = nextNodeDataFromDb;
                };

                nextNodeDataFromRedis = nextNodeDataFromRedis?.currentNode || nextNodeDataFromRedis;

                // Return next node
                if (nextNodeDataFromRedis?.executor === 'none' && nextNodeDataFromRedis?.output?.mode === 'options') {
                    await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: nextNodeId.toString(), previousNodeId: sessionalBotDetails.previousNodeId }), { ex: 60 * 60 });
                    return res.status(200).json({ type: "options", nodeData: nextNodeDataFromRedis });
                }

                else if (nextNodeDataFromRedis?.executor === 'none' && nextNodeDataFromRedis?.output?.mode === 'text') {
                    await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: nextNodeId.toString(), previousNodeId: sessionalBotDetails.previousNodeId }), { ex: 60 * 60 });
                    return res.status(200).json({ type: "text", nodeData: nextNodeDataFromRedis, back: { label: "Go Back", _id: "GO_BACK" }, end: { label: "End Chat", _id: "END_CHAT" } });
                }

                else if (nextNodeDataFromRedis?.executor === 'input') {
                    await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: nextNodeId.toString(), previousNodeId: sessionalBotDetails.previousNodeId }), { ex: 60 * 60 });
                    return res.status(200).json({ type: "input", nodeData: nextNodeDataFromRedis, back: { label: "Go Back", _id: "GO_BACK" }, end: { label: "End Chat", _id: "END_CHAT" } });
                }

                else if (nextNodeDataFromRedis?.executor === 'api' && nextNodeDataFromRedis?.output?.mode === 'text') {

                    const apiFormatFromLLM: apiConstructorTemplate = await constructApiUponUserInput(nextNodeDataFromRedis.apiConfig, input);

                    if (!apiFormatFromLLM.success) {
                        return res.status(500).json({ message: apiFormatFromLLM.error || "API construction failed. Please try again." });
                    }

                    if (apiFormatFromLLM.confidence && apiFormatFromLLM.confidence < 0.5) {
                        return res.status(200).json({ message: "I'm not confident enough to make the API call based on your input. Could you please rephrase or provide more details?" });
                    }

                    const constructedApiEndpoint = apiFormatFromLLM.apiRequest?.endpoint || "";
                    const constructedApiQueryParams = apiFormatFromLLM.apiRequest?.queryParams || {};
                    const fullApiUrl = buildUrl(constructedApiEndpoint, constructedApiQueryParams);

                    const response = await callingConstructApiUponUserInput(fullApiUrl);
                    if (!response) {
                        return res.status(500).json({ message: response || "API call failed. Please try again." });
                    }

                    const responseToSend = await generatingResponseFromApiResult(input, response);
                    await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: nextNodeId.toString(), previousNodeId: sessionalBotDetails.previousNodeId }), { ex: 60 * 60 });
                    return res.status(200).json({ type: "api", message: responseToSend, back: { label: "Go Back", _id: "GO_BACK" }, end: { label: "End Chat", _id: "END_CHAT" } });
                }

                else if (nextNodeDataFromRedis?.executor === 'api' && nextNodeDataFromRedis?.output?.mode === 'options') {
                    const apiEndpoint = nextNodeDataFromRedis.apiConfig?.endpointKey;
                    if (!apiEndpoint) {
                        return res.status(500).json({ message: "API endpoint is not configured properly. Contact bot owner. Thanks for using us." });
                    }

                    const response = await fetch(apiEndpoint);
                    if (!response.ok) {
                        return res.status(500).json({ message: "API call failed. Please try again." });
                    }

                    const rawJson = await response.json();

                    // Normalize to an array while keeping as many items as possible
                    let normalizedResults: any[] = [];
                    if (Array.isArray(rawJson)) {
                        normalizedResults = rawJson;
                    } else if (rawJson && Array.isArray((rawJson as any).samples)) {
                        // If upstream still sends samples array, use it directly
                        normalizedResults = (rawJson as any).samples;
                    } else if (rawJson && typeof rawJson === "object") {
                        normalizedResults = Object.values(rawJson as Record<string, any>);
                    } else if (rawJson) {
                        normalizedResults = [rawJson];
                    }

                    if (!normalizedResults || normalizedResults.length === 0) {
                        return res.status(500).json({ message: "API response is invalid or empty." });
                    }

                    // Take top 4 results
                    const topFourResults = normalizedResults.slice(0, 4);

                    // Convert API response to options using LLM
                    const generatedOptions = await convertApiResponseToOptions(topFourResults, nextNodeDataFromRedis?.title || "API Options");
                    if (!generatedOptions || generatedOptions.length === 0) {
                        return res.status(500).json({ message: "Failed to generate options from API response." });
                    }
                    // Format options with temporary IDs for frontend
                    const formattedOptionsForFrontend = generatedOptions.map((opt: any, index: number) => ({
                        optionId: `api_option_${index}`,
                        intent: opt.label || opt.intent || `Option ${index + 1}`,
                        value: opt.value || opt.intent,
                        order: index,
                    }));
                    // Prepare node data with options
                    const nodeDataWithOptions = {
                        currentNode: nextNodeDataFromRedis,
                        options: formattedOptionsForFrontend,
                        isApiGenerated: true,
                    };

                    await redis.set(redisKeyForNodes(nextNodeId.toString()), JSON.stringify(nodeDataWithOptions), { ex: 60 * 60 });
                    await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: nextNodeId.toString(), previousNodeId: sessionCurrentNodeId }), { ex: 60 * 60 });
                    return res.status(200).json({ type: "options", nodeData: nodeDataWithOptions });
                }

                return res.status(200).json({ message: "Current node expects user input. Please provide the required input." });
            }
            else if (currentNodeData.executor === 'api' && currentNodeData.output?.mode === 'options') {

                const currentNodeOptions = currentNodeDataFromRedis.options as FormattedOption[];
                const optionName = currentNodeOptions.find((option) => option.intent === input || String(option.optionId) === input)?.intent;

                const nextNodeId = currentNodeData.apiConfig?.nextNodeId;
                if (!nextNodeId) {
                    return res.status(400).json({ message: "Next Node is not being configured properly." });
                }

                let nextNodeDataFromRedis = await getFromRedisStringOnly(redisKeyForNodes(nextNodeId.toString()));

                if (!nextNodeDataFromRedis) {
                    const nextNodeDataFromDb = await ControlledBotNodeModel.findOne({ _id: nextNodeId, botId: botId });
                    if (!nextNodeDataFromDb) {
                        return res.status(500).json({ message: "Next node data not found. Please start a new session." });
                    }

                    // Cache the next node
                    nextNodeDataFromRedis = await cacheNodeByType(nextNodeDataFromDb, nextNodeId.toString(), botId, redisKeyForNodes);
                }

                nextNodeDataFromRedis = nextNodeDataFromRedis?.currentNode || nextNodeDataFromRedis;


                if (nextNodeDataFromRedis?.executor === 'none' && nextNodeDataFromRedis?.output?.mode === 'options') {

                    await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: nextNodeId.toString(), previousNodeId: sessionCurrentNodeId }), { ex: 60 * 60 });
                    return res.status(200).json({ type: "options", nodeData: nextNodeDataFromRedis });
                }
                else if (nextNodeDataFromRedis?.executor === 'none' && nextNodeDataFromRedis?.output?.mode === 'text') {
                    await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: nextNodeId.toString(), previousNodeId: sessionCurrentNodeId }), { ex: 60 * 60 });//1 hr
                    return res.status(200).json({ type: "text", nodeData: nextNodeDataFromRedis.output.text, back: { label: "Go Back", _id: "GO_BACK" }, end: { label: "End Chat", _id: "END_CHAT" } });
                }
                else if (nextNodeDataFromRedis?.executor === 'input') {

                    await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: nextNodeId.toString(), previousNodeId: sessionCurrentNodeId }), { ex: 60 * 60 });//1 hr
                    return res.status(200).json({ type: "input", nodeData: nextNodeDataFromRedis, back: { label: "Go Back", _id: "GO_BACK" }, end: { label: "End Chat", _id: "END_CHAT" } });
                }
                else if(nextNodeDataFromRedis?.executor === 'api' && nextNodeDataFromRedis?.output?.mode === 'text') {
                    const apiNode = (nextNodeDataFromRedis as any)?.currentNode || nextNodeDataFromRedis;
                    const reqInfo = extractApiRequest(apiNode?.apiConfig);
                    if (!reqInfo || !reqInfo.endpoint) {
                        return res.status(500).json({ message: "API configuration is missing or invalid for the next node." });
                    }

                    const fullApiUrl = buildUrl(reqInfo.endpoint, reqInfo.queryParams || {});
                    const apiData = await callingConstructApiUponUserInput(fullApiUrl);

                    await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: nextNodeId.toString(), previousNodeId: sessionCurrentNodeId }), { ex: 60 * 60 });//1 hr
                    return res.status(200).json({ type: "api", message: apiData, back: { label: "Go Back", _id: "GO_BACK" }, end: { label: "End Chat", _id: "END_CHAT" } });
                }
                else if(nextNodeDataFromRedis?.executor === 'api' && nextNodeDataFromRedis?.output?.mode === 'options') {
                    const apiNode = (nextNodeDataFromRedis as any)?.currentNode || nextNodeDataFromRedis;
                    const reqInfo = extractApiRequest(apiNode?.apiConfig);

                    if (!reqInfo || !reqInfo.endpoint) {
                        return res.status(500).json({ message: "API configuration is missing or invalid for the next node." });
                    }
                    // Build full API URL
                    const fullApiUrl = buildUrl(reqInfo.endpoint, reqInfo.queryParams || {});  
                    // Fetch raw API data (bypass sanitizer to keep full list)
                    const rawResponse = await fetch(fullApiUrl);
                    if (!rawResponse.ok) {
                        return res.status(500).json({ message: "Failed to fetch data from API." });
                    }   
                    const rawJson = await rawResponse.json();   

                    // Normalize to an array while keeping as many items as possible
                    let normalizedResults: any[] = [];  
                    if (Array.isArray(rawJson)) {
                        normalizedResults = rawJson;
                    }       
                    else if (rawJson && Array.isArray((rawJson as any).samples)) {
                        // If upstream still sends samples array, use it directly
                        normalizedResults = (rawJson as any).samples;
                    }
                    else if (rawJson && typeof rawJson === "object") {
                        normalizedResults = Object.values(rawJson as Record<string, any>);
                    }
                    else if (rawJson) {
                        normalizedResults = [rawJson];
                    }

                    if (!normalizedResults || normalizedResults.length === 0) {
                        return res.status(500).json({ message: "API response is invalid or empty." });
                    }

                    // Take top 4 results
                    const topFourResults = normalizedResults.slice(0, 4);
                    // Convert API response to options using LLM
                    const generatedOptions = await convertApiResponseToOptions(topFourResults, apiNode?.title || "API Options");
                    if (!generatedOptions || generatedOptions.length === 0) {
                        return res.status(500).json({ message: "Failed to generate options from API response." });
                    }

                    // Format options with temporary IDs for frontend
                    const formattedOptionsForFrontend = generatedOptions.map((opt: any, index: number) => ({
                        optionId: `api_option_${index}`,
                        intent: opt.label || opt.intent || `Option ${index + 1}`,
                        value: opt.value || opt.intent,
                        order: index,
                    }));

                    // Prepare node data with options
                    const nodeDataWithOptions = {  
                        currentNode: apiNode,
                        options: formattedOptionsForFrontend,
                        isApiGenerated: true,

                    };
                    await redis.set(redisKeyForNodes(nextNodeId.toString()), JSON.stringify(nodeDataWithOptions), { ex: 60 * 60 });
                    await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: nextNodeId.toString(), previousNodeId: sessionCurrentNodeId }), { ex: 60 * 60 });
                    return res.status(200).json({ type: "options", nodeData: nodeDataWithOptions });
                }

            }

        }

        return res.status(200).json({ message: "Controlled Style Website Bot Controller" });
    } catch (e) {
        console.error("Error in controlledStyleWebsiteBotController:", e);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// Helper to process initial node from database
const processInitialNode = async (
    nodeData: any,
    nodeId: string,
    botId: string,
    redisKeyForNodes: (id: string) => string,
    sessionalRedisKey: string,
    res: Response
): Promise<Response> => {
    console.log("Initial Node Data from DB:", nodeData);
    if (nodeData.executor === 'none' && nodeData.output?.mode === 'options') {
        const optionsFromDb = await ControlledBotEdgeModel.find({ fromNodeId: nodeData._id }).sort({ order: 1 });
        if (!optionsFromDb || optionsFromDb.length === 0) {
            return res.status(500).json({ message: "Bot options are not configured properly. Contact bot owner. Thanks for using us." });
        }

        const formattedOptions: FormattedOption[] = optionsFromDb.map((option) => ({
            optionId: option._id,
            intent: option.intent,
            toNodeId: option.toNodeId,
            order: option.order,
        }));

        const nodeWithOptions: NodeWithOptions = {
            currentNode: nodeData,
            options: formattedOptions,
        };

        await redis.set(redisKeyForNodes(nodeId), JSON.stringify(nodeWithOptions), { ex: 86400 });
        await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: nodeId, previousNodeId: null }), { ex: 60 * 60 });

        return res.status(200).json({ type: "options", nodeData: nodeWithOptions });
    } else if (nodeData.executor === 'none' && nodeData.output?.mode === 'text') {
        await redis.set(redisKeyForNodes(nodeId), JSON.stringify(nodeData), { ex: 86400 });
        await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: nodeId, previousNodeId: null }), { ex: 60 * 60 });
        return res.status(200).json({ type: "text", nodeData, back: { label: "Go Back", _id: "GO_BACK" }, end: { label: "End Chat", _id: "END_CHAT" } });
    } else if (nodeData.executor === 'input') {
        await redis.set(redisKeyForNodes(nodeId), JSON.stringify(nodeData), { ex: 86400 });
        await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: nodeId, previousNodeId: null }), { ex: 60 * 60 });
        return res.status(200).json({ type: "input", nodeData, back: { label: "Go Back", _id: "GO_BACK" }, end: { label: "End Chat", _id: "END_CHAT" } });
    } else if (nodeData.executor === 'api' && nodeData.output?.mode === 'text') {
        const apiEndpoint = nodeData.apiConfig?.endpointKey;
        if (!apiEndpoint) {
            return res.status(500).json({ message: "API endpoint is not configured properly. Contact bot owner. Thanks for using us." });
        }

        const response = await callingConstructApiUponUserInput(apiEndpoint);
        if (!response) {
            return res.status(500).json({ message: "API call failed. Please try again." });
        }

        console.log("API Node Data: ", response);
        return res.status(200).json({ type: "api", message: response, back: { label: "Go Back", _id: "GO_BACK" }, end: { label: "End Chat", _id: "END_CHAT" } });
    }
    else if( nodeData.executor === 'api' && nodeData.output?.mode === 'options') {
        const apiNode = nodeData;
        const reqInfo = extractApiRequest(apiNode?.apiConfig);
        if (!reqInfo || !reqInfo.endpoint) {
            return res.status(500).json({ message: "API configuration is missing or invalid for the next node." });
        }
        // Build full API URL
        const fullApiUrl = buildUrl(reqInfo.endpoint, reqInfo.queryParams || {});
        // Fetch raw API data (bypass sanitizer to keep full list)
        const rawResponse = await fetch(fullApiUrl);
        if (!rawResponse.ok) {
            return res.status(500).json({ message: "Failed to fetch data from API." });
        }   
        const rawJson = await rawResponse.json();
        // Normalize to an array while keeping as many items as possible
        let normalizedResults: any[] = [];
        if (Array.isArray(rawJson)) {
            normalizedResults = rawJson;
        } else if (rawJson && Array.isArray((rawJson as any).samples)) {
            // If upstream still sends samples array, use it directly
            normalizedResults = (rawJson as any).samples;
        } else if (rawJson && typeof rawJson === "object") {
            normalizedResults = Object.values(rawJson as Record<string, any>);
        } else if (rawJson) {
            normalizedResults = [rawJson];
        }
        if (!normalizedResults || normalizedResults.length === 0) {
            return res.status(500).json({ message: "API response is invalid or empty." });
        }

        // Take top 4 results
        const topFourResults = normalizedResults.slice(0, 4);
    
        // Convert API response to options using LLM

        const generatedOptions = await convertApiResponseToOptions(topFourResults, apiNode?.title || "API Options");
        if (!generatedOptions || generatedOptions.length === 0) {
            return res.status(500).json({ message: "Failed to generate options from API response." });
        }
        // Format options with temporary IDs for frontend
        const formattedOptionsForFrontend = generatedOptions.map((opt: any, index: number) => ({
            optionId: `api_option_${index}`,
            intent: opt.label || opt.intent || `Option ${index + 1}`,
            value: opt.value || opt.intent,
            order: index,
        }));
        // Prepare node data with options
        const nodeDataWithOptions = {
            currentNode: apiNode,
            options: formattedOptionsForFrontend,
            isApiGenerated: true,
        };
        await redis.set(redisKeyForNodes(nodeId), JSON.stringify(nodeDataWithOptions), { ex: 86400 });
        await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: nodeId, previousNodeId: null }), { ex: 60 * 60 });
        return res.status(200).json({ type: "options", nodeData: nodeDataWithOptions });
    }

    return res.status(500).json({ message: "Node type not recognized." });
};

// Helper to process initial node from Redis
const processInitialNodeFromRedis = async (
    nodeDataFromRedis: any,
    nodeId: string,
    redisKeyForNodes: (id: string) => string,
    sessionalRedisKey: string,
    sessionId: string,
    res: Response
): Promise<Response> => {

    const nodeData = nodeDataFromRedis.currentNode || nodeDataFromRedis;
    console.log("Initial Node Data from DB:", nodeData);

    if (nodeData.executor === 'none' && nodeData.output?.mode === 'options') {
        await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: nodeId, previousNodeId: null }), { ex: 60 * 60 });
        return res.status(200).json({ type: "options", nodeData: nodeDataFromRedis });
    } else if (nodeData.executor === 'none' && nodeData.output?.mode === 'text') {
        await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: nodeId, previousNodeId: null }), { ex: 60 * 60 });
        return res.status(200).json({ type: "text", nodeData, back: { label: "Go Back", _id: "GO_BACK" }, end: { label: "End Chat", _id: "END_CHAT" } });
    } else if (nodeData.executor === 'input') {
        await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: nodeId, previousNodeId: null }), { ex: 60 * 60 });
        return res.status(200).json({ type: "input", nodeData, back: { label: "Go Back", _id: "GO_BACK" }, end: { label: "End Chat", _id: "END_CHAT" } });
    } else if (nodeData.executor === 'api' && nodeData.output?.mode === 'text') {
        const apiEndpoint = nodeData.apiConfig?.endpointKey;
        if (!apiEndpoint) {
            return res.status(500).json({ message: "API endpoint is not configured properly. Contact bot owner. Thanks for using us." });
        }
        const response = await callingConstructApiUponUserInput(apiEndpoint);
        if (!response) {
            return res.status(500).json({ message: "API call failed. Please try again." });
        }

        console.log("API Node Data: ", response);

        return res.status(200).json({ type: "api", message: response, back: { label: "Go Back", _id: "GO_BACK" }, end: { label: "End Chat", _id: "END_CHAT" } });

    }
    else if (nodeData.executor === 'api' && nodeData.output?.mode === 'options') {
        const apiNode = (nodeData as any)?.currentNode || nodeData;
        const reqInfo = extractApiRequest(apiNode?.apiConfig);

        if (!reqInfo || !reqInfo.endpoint) {
            return res.status(500).json({ message: "API configuration is missing or invalid for the next node." });
        }

        // Build full API URL
        const fullApiUrl = buildUrl(reqInfo.endpoint, reqInfo.queryParams || {});

        // Fetch raw API data (bypass sanitizer to keep full list)
        const rawResponse = await fetch(fullApiUrl);
        if (!rawResponse.ok) {
            return res.status(500).json({ message: "Failed to fetch data from API." });
        }
        const rawJson = await rawResponse.json();

        // Normalize to an array while keeping as many items as possible
        let normalizedResults: any[] = [];
        if (Array.isArray(rawJson)) {
            normalizedResults = rawJson;
        } else if (rawJson && Array.isArray((rawJson as any).samples)) {
            // If upstream still sends samples array, use it directly
            normalizedResults = (rawJson as any).samples;
        } else if (rawJson && typeof rawJson === "object") {
            normalizedResults = Object.values(rawJson as Record<string, any>);
        } else if (rawJson) {
            normalizedResults = [rawJson];
        }

        if (!normalizedResults || normalizedResults.length === 0) {
            return res.status(500).json({ message: "API response is invalid or empty." });
        }

        // Take top 4 results
        const topFourResults = normalizedResults.slice(0, 4);
        // Convert API response to options using LLM
        const generatedOptions = await convertApiResponseToOptions(topFourResults, apiNode?.title || "API Options");

        if (!generatedOptions || generatedOptions.length === 0) {
            return res.status(500).json({ message: "Failed to generate options from API response." });
        }

        // Format options with temporary IDs for frontend
        const formattedOptionsForFrontend = generatedOptions.map((opt: any, index: number) => ({
            optionId: `api_option_${index}`,
            intent: opt.label || opt.intent || `Option ${index + 1}`,
            value: opt.value || opt.intent,
            order: index,
        }));

        // Prepare node data with options
        const nodeDataWithOptions = {
            currentNode: apiNode,
            options: formattedOptionsForFrontend,
            isApiGenerated: true,
        };

        await redis.set(redisKeyForNodes(nodeId), JSON.stringify(nodeDataWithOptions), { ex: 86400 });
        await redis.set(sessionalRedisKey, JSON.stringify({ currentNodeId: nodeData._id.toString(), previousNodeId: nodeData._id.toString() }), { ex: 60 * 60 });
        return res.status(200).json({ type: "options", nodeData: nodeDataWithOptions });



    }


    return res.status(500).json({ message: "Node type not recognized." });
};

// Helper to cache node based on its type
const cacheNodeByType = async (
    nodeData: any,
    nodeId: string,
    botId: string,
    redisKeyForNodes: (id: string) => string
): Promise<any> => {
    if (nodeData.executor === 'none' && nodeData.output?.mode === 'options') {
        const optionsFromDb = await ControlledBotEdgeModel.find({ fromNodeId: nodeData._id }).sort({ order: 1 });
        if (!optionsFromDb || optionsFromDb.length === 0) {
            return null;
        }

        const formattedOptions: FormattedOption[] = optionsFromDb.map((option) => ({
            optionId: option._id,
            intent: option.intent,
            toNodeId: option.toNodeId,
            order: option.order,
        }));

        const nodeWithOptions: NodeWithOptions = {
            currentNode: nodeData,
            options: formattedOptions,
        };

        await redis.set(redisKeyForNodes(nodeId), JSON.stringify(nodeWithOptions), { ex: 86400 });
        return nodeWithOptions;
    } else if (nodeData.executor === 'none' && nodeData.output?.mode === 'text') {
        await redis.set(redisKeyForNodes(nodeId), JSON.stringify({ currentNode: nodeData }), { ex: 86400 });
        return { currentNode: nodeData };
    } else if (nodeData.executor === 'input') {
        await redis.set(redisKeyForNodes(nodeId), JSON.stringify({ currentNode: nodeData }), { ex: 86400 });
        return { currentNode: nodeData };
    } else if (nodeData.executor === 'api') {
        await redis.set(redisKeyForNodes(nodeId), JSON.stringify({ currentNode: nodeData }), { ex: 86400 });
        return { currentNode: nodeData };
    }

    return null;
};

const constructApiUponUserInput = async (apiTemplate: any, userInput: string) => {
    try {
        if (!apiTemplate || !userInput) {
            return null;
        }


        const openai = new OpenAI({
            apiKey: process.env.API_FOR_API_CONSTRUCTOR,
            baseURL: "https://api.groq.com/openai/v1",
        });

        const response = await openai.chat.completions.create({
            model: "openai/gpt-oss-safeguard-20b",
            messages: [
                { role: "system", content: apiConstructorSystemPrompt },
                { role: "user", content: `API Template: ${JSON.stringify(apiTemplate)}\nUser Input: ${userInput}` }
            ]
        });

        console.log(response.usage?.completion_tokens)
        if (!response || !response.choices || response.choices.length === 0) {
            const output = {
                success: false,
                error: {
                    code: "ERROR_CODE",
                    message: "Code not found",
                    severity: "CRITICAL",
                    suggestion: "Please try again later."
                }
            };
            return output;
        }
        const message = response.choices[0] ? response.choices[0].message : null;
        if (!message || !message.content) {
            const output = {
                success: false,
                error: {
                    code: "ERROR_CODE",
                    message: "Code not found",
                    severity: "CRITICAL",
                    suggestion: "Please try again later."
                }
            };
            return output;
        }

        message.content = message.content.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsedContent = typeof message.content === 'string' ? JSON.parse(message.content) : message.content;
        return parsedContent;
    }

    catch (e) {
        throw e;
    }
}

function buildUrl(endpoint: string, queryParams: Object): string {
    const url = new URL(endpoint);
    Object.entries(queryParams || {}).forEach(([key, val]) => {
        if (val === null || val === undefined) return;
        if (Array.isArray(val)) {
            val.forEach(v => url.searchParams.append(key, String(v)));
        } else {
            url.searchParams.set(key, String(val));
        }
    });
    return url.toString();
}

// Extract endpoint and query params from apiConfig in a tolerant way
function extractApiRequest(apiConfig: any): { endpoint: string; queryParams?: Object } | null {
    console.log("Extracting API Request from Config:", apiConfig);
    if (!apiConfig) return null;
    const endpoint = apiConfig?.apiRequest?.endpointKey || apiConfig?.endpointKey || "";
    const queryParams = apiConfig?.apiRequest?.queryParams || apiConfig?.queryParams || {};
    return { endpoint, queryParams };
}

// Invoke API and summarize without requiring user input
async function invokeApiAndSummarize(apiConfig: any, titleFallback: string): Promise<string> {
    const info = extractApiRequest(apiConfig);
    if (!info || !info.endpoint) throw new Error("Invalid API configuration");
    const url = buildUrl(info.endpoint, info.queryParams || {});
    const apiData = await callingConstructApiUponUserInput(url);
    const message = await generatingResponseFromApiResult(titleFallback || "API Node Response", apiData);
    return message as string;
}

const callingConstructApiUponUserInput = async (apiEndpoint: string) => {
    try {
        const response = await fetch(apiEndpoint);
        if (response.ok) {
            const data = await response.json();
            const sanitizedData = sanitizeAPIResponse(data);
            return sanitizedData.samples || [];
        }
        throw new Error("Failed to fetch data");
    }
    catch (e) {
        throw e;
    }
}


export const generatingResponseFromApiResult = async (input: string, apiResponseData: any) => {
    try {
        if (!input || !apiResponseData) {
            return {
                success: false,
                message: "Invalid input or API response data."
            };
        }

        const openai = new OpenAI({
            apiKey: process.env.API_KEY_FOR_API_CALLING_IN_CONTROLLED_BOT,
            baseURL: "https://api.groq.com/openai/v1",
        });

        const response = await openai.chat.completions.create({
            model: "openai/gpt-oss-safeguard-20b",
            messages: [
                { role: "system", content: summarizingApiResultSystemPrompt },
                { role: "user", content: `User Input: ${input}\nAPI Response Data: ${JSON.stringify(apiResponseData)}` }
            ]
        });
        console.log(response.usage?.completion_tokens)

        if (!response || !response.choices || response.choices.length === 0) {
            return {
                success: false,
                message: "Failed to generate response from API data."
            };
        }
        const message = response.choices[0] ? response.choices[0].message : null;
        if (!message || !message.content) {
            return {
                success: false,
                message: "Failed to generate response from API data."
            };
        }

        let result = message.content;
        return result;
    }
    catch (e) {
        throw e;
    }

}

// Convert API response to options using LLM
const convertApiResponseToOptions = async (apiData: any[], contextTitle: string = "API Options") => {
    try {
        if (!apiData || apiData.length === 0) {
            throw new Error("No API data provided");
        }

        // Ensure we have at least some data to work with (up to 4 items)
        const dataToProcess = apiData.slice(0, 4);
        const dataCount = dataToProcess.length;
        console.log(`Converting ${dataCount} API items to options using LLM`);

        const openai = new OpenAI({
            apiKey: process.env.API_KEY_FOR_API_CALLING_IN_CONTROLLED_BOT,
            baseURL: "https://api.groq.com/openai/v1",
        });

        const systemPrompt = `You are an expert at converting API responses into user-friendly options for a chatbot.

Your task:
1. You will receive ${dataCount} items from an API response
2. Create EXACTLY ${dataCount} options - one for each item
3. Extract the most relevant information from each item
4. Create clear, concise option labels that users can understand
5. Return ONLY a valid JSON array with EXACTLY ${dataCount} objects

Required format (MUST be valid JSON array):
[
  {
    "label": "Clear, user-friendly option text (max 60 characters)",
    "value": "Relevant value or identifier from API data",
    "intent": "Short intent description"
  }
]

CRITICAL RULES:
- MUST return exactly ${dataCount} objects in the array
- Each object MUST have: label, value, and intent fields
- Labels must be clear, concise, and actionable
- Values must be unique identifiers or keys from the data
- Intent should describe what this option represents
- Return ONLY the JSON array, no additional text, explanation, or code blocks
- Do not use code blocks like \`\`\`json\`\`\`
- If API data has fields like 'name', 'title', 'id', use them
- If any field is missing, create a reasonable default based on context`;

        const response = await openai.chat.completions.create({
            model: "openai/gpt-oss-safeguard-20b",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Context: ${contextTitle}\n\nAPI Data (${dataCount} items) to convert:\n${JSON.stringify(dataToProcess, null, 2)}\n\nGenerate exactly ${dataCount} options.` }
            ],
            temperature: 0.3,
        });

        console.log("LLM Token Usage for Options Conversion:", response.usage?.completion_tokens);

        if (!response || !response.choices || response.choices.length === 0) {
            throw new Error("Failed to get response from LLM");
        }

        const message = response.choices[0]?.message;
        if (!message || !message.content) {
            throw new Error("No content in LLM response");
        }

        // Clean up response - remove code blocks if present
        let cleanedContent = message.content
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .replace(/^[\s]*\[/, '[') // Remove leading whitespace before [
            .replace(/\][\s]*$/, ']') // Remove trailing whitespace after ]
            .trim();

        // Parse the JSON response
        const parsedOptions = JSON.parse(cleanedContent);

        if (!Array.isArray(parsedOptions)) {
            throw new Error("LLM response is not an array");
        }

        // If LLM returns fewer options than expected, pad with fallback
        if (parsedOptions.length < dataCount) {
            console.warn(`LLM returned ${parsedOptions.length} options, expected ${dataCount}. Padding with fallback options.`);

            // Create fallback options for missing items
            for (let i = parsedOptions.length; i < dataCount; i++) {
                const item = dataToProcess[i];
                parsedOptions.push({
                    label: item?.name || item?.title || `Option ${i + 1}`,
                    value: item?.id || item?.value || String(i),
                    intent: `Option ${i + 1}`,
                });
            }
        }

        // Return exactly the number of options we have (up to 4)
        return parsedOptions.slice(0, dataCount);
    } catch (e) {
        console.error("Error in convertApiResponseToOptions:", e);

        // Fallback: create basic options from raw data
        const fallbackOptions = apiData.slice(0, 4).map((item, index) => ({
            label: item?.name || item?.title || item?.text || `Option ${index + 1}`,
            value: item?.id || item?.value || item?.key || String(index),
            intent: item?.description || `Option ${index + 1}`,
        }));

        console.log(`Returning ${fallbackOptions.length} fallback options`);
        return fallbackOptions;
    }
}