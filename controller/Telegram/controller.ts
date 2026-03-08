import type { Request, Response } from "express";
import { BotStructureModel } from "../../Models/BotStructure.js";
import { botConfiguration } from "../../Models/BotConfiguration.js";
import { getRedisClient } from "../../Redis/connect.js";
import { freeStyleWebsiteBotPrompt, getToolDefinitions, fetchData } from "../../utils/System_Prompt/Website.js";
import { OpenAI } from "openai";
import crypto from "crypto";
import { supabase } from "../../Database/postgresql.js";
import { analyticsInsertionHelper } from "../BotCommunication/Website/controllert.js";
import { ControlledBotModel } from "../../Models/ControlledBotSchema.js";
import { ControlledBotNodeModel } from "../../Models/ControlledBotNodes.js";
import { ControlledBotEdgeModel } from "../../Models/ControlledBotEdges.js";

const redis = getRedisClient();

const TELEGRAM_GENERIC_ISSUE_MESSAGE = "There was a problem while processing your request. Please try again in a moment.";

const redactSensitiveQueryParamsForLog = (rawUrl: string): string => {
    try {
        const parsed = new URL(rawUrl);
        const sensitiveKeys = ["token", "api_key", "apikey", "key", "authorization", "auth", "password"];

        for (const [paramKey] of parsed.searchParams.entries()) {
            const lowerKey = paramKey.toLowerCase();
            const isSensitive = sensitiveKeys.some((key) => lowerKey.includes(key));
            if (isSensitive) {
                parsed.searchParams.set(paramKey, "***redacted***");
            }
        }

        return parsed.toString();
    } catch {
        return rawUrl;
    }
};

const isHttpUrl = (value: string): boolean => {
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
        return false;
    }
};

const resolveExternalApiUrl = (
    endpoint: unknown,
    queryParams: Record<string, unknown> | undefined,
    configuredApiEndpoint: unknown
): { url: string | null; resolution: string; reason?: string } => {
    const rawEndpoint = typeof endpoint === "string" ? endpoint.trim() : "";
    const baseEndpoint = typeof configuredApiEndpoint === "string" ? configuredApiEndpoint.trim() : "";

    let workingUrl = "";
    let resolution = "";

    if (rawEndpoint && isHttpUrl(rawEndpoint)) {
        workingUrl = rawEndpoint;
        resolution = "absolute-endpoint";
    } else if (rawEndpoint && baseEndpoint && isHttpUrl(baseEndpoint)) {
        try {
            workingUrl = new URL(rawEndpoint, baseEndpoint).toString();
            resolution = "resolved-with-configured-base";
        } catch {
            return {
                url: null,
                resolution: "invalid",
                reason: "Unable to resolve endpoint against configured API endpoint",
            };
        }
    } else if (!rawEndpoint && baseEndpoint && isHttpUrl(baseEndpoint)) {
        workingUrl = baseEndpoint;
        resolution = "configured-base-only";
    } else {
        return {
            url: null,
            resolution: "invalid",
            reason: "Endpoint is missing or invalid and no valid configured API endpoint is available",
        };
    }

    try {
        const parsedUrl = new URL(workingUrl);
        if (queryParams && typeof queryParams === "object") {
            Object.entries(queryParams).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    parsedUrl.searchParams.set(key, String(value));
                }
            });
        }

        return { url: parsedUrl.toString(), resolution };
    } catch {
        return {
            url: null,
            resolution: "invalid",
            reason: "Resolved URL is not valid",
        };
    }
};

const buildIssueMessage = (operation: string): string => {
    return `There was a problem while ${operation}. Please try again in a moment.`;
};

const sendTelegramTextMessage = async (botToken: string, chatId: string | number, text: string): Promise<boolean> => {
    if (!botToken || !chatId || !text) {
        console.warn("[Telegram][sendMessage] Missing required input", {
            hasBotToken: Boolean(botToken),
            hasChatId: Boolean(chatId),
            hasText: Boolean(text),
        });
        return false;
    }

    try {
        const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                chat_id: chatId,
                text,
            })
        });
        const data = await telegramResponse.json();

        if (!telegramResponse.ok) {
            console.error("[Telegram][sendMessage] Failed to send message", data);
            return false;
        }

        return true;
    } catch (error) {
        console.error("[Telegram][sendMessage] Exception while sending message", error);
        return false;
    }
};

const notifyTelegramIssue = async (botToken: string, chatId: string | number, operation?: string): Promise<void> => {
    const issueMessage = operation ? buildIssueMessage(operation) : TELEGRAM_GENERIC_ISSUE_MESSAGE;
    await sendTelegramTextMessage(botToken, chatId, issueMessage);
};

const getFromRedisStringOnly = async (redisKey: string): Promise<any> => {
    try {
        const data = await redis.get(redisKey);
        if (data) {
            return typeof data === "string" ? JSON.parse(data) : data;
        }
        return null;
    }
    catch (e) {
        console.error("Error in getFromRedisStringOnly:", e);
        return null;
    }
};

type EmbeddingStorageRow = {
    content: string;
    embedding: number[] | string | null;
};

const parseStoredEmbedding = (value: EmbeddingStorageRow["embedding"]): number[] | null => {
    if (!value) return null;
    if (Array.isArray(value)) {
        return value.filter((item): item is number => typeof item === "number" && Number.isFinite(item));
    }

    if (typeof value === "string") {
        try {
            const normalized = value.replace(/^{/, "[").replace(/}$/, "]");
            const parsed = JSON.parse(normalized);
            if (Array.isArray(parsed)) {
                return parsed
                    .map((item) => Number(item))
                    .filter((item) => Number.isFinite(item));
            }
        } catch {
            return null;
        }
    }

    return null;
};

const cosineSimilarity = (a: number[], b: number[]): number => {
    if (!a.length || !b.length || a.length !== b.length) return -1;

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        const ai = a[i] ?? 0;
        const bi = b[i] ?? 0;
        dot += ai * bi;
        normA += ai * ai;
        normB += bi * bi;
    }

    if (normA === 0 || normB === 0) return -1;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

const retrieveRAGContext = async (botId: string, userQuery: string, topK: number = 3): Promise<string | null> => {
    try {
        const embeddingClient = new OpenAI({
            apiKey: process.env.GEMINI_API_KEY,
            baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
        });

        const embeddingResponse = await embeddingClient.embeddings.create({
            model: "gemini-embedding-001",
            input: userQuery.trim(),
        });

        if (!embeddingResponse.data?.[0]?.embedding) {
            console.warn("RAG: Failed to generate query embedding");
            return null;
        }

        const queryEmbedding = embeddingResponse.data[0].embedding;

        const { data: documents, error } = await supabase
            .from("embeddingstorage")
            .select("content, embedding")
            .eq("botId", botId)
            .limit(200);

        if (error) {
            console.warn("RAG: Supabase query error:", error.message);
            return null;
        }

        if (!documents || documents.length === 0) {
            return null;
        }

        const rankedDocuments = (documents as EmbeddingStorageRow[])
            .map((doc) => {
                const embedding = parseStoredEmbedding(doc.embedding);
                if (!embedding || !doc.content) return null;

                const similarity = cosineSimilarity(queryEmbedding, embedding);
                return similarity < 0 ? null : { content: doc.content, similarity };
            })
            .filter((doc): doc is { content: string; similarity: number } => !!doc)
            .filter((doc) => doc.similarity >= 0.5)
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, topK);

        if (rankedDocuments.length === 0) {
            return null;
        }

        const contextChunks = rankedDocuments.map((doc, idx: number) => {
            const truncatedContent = doc.content.length > 400
                ? doc.content.substring(0, 400) + "..."
                : doc.content;
            return `[${idx + 1}] ${truncatedContent}`;
        });

        return contextChunks.join("\n\n");
    } catch (err) {
        console.warn("RAG: Retrieval failed:", err);
        return null;
    }
};

type TelegramConfigPayload = {
    botId?: string;
    userId?: string;
    config?: Record<string, any>;
    botStyle?: string;
    botType?: string;
    websiteType?: string;
    otherWebsiteType?: string;
    tone?: string;
    verbosity?: string;
    behaviorDescription?: string;
    OwnerInformation?: string;
    additionalInformation?: string;
    examples?: unknown;
    apiEndpoint?: string;
    responseFormat?: string;
    apiUsageRules?: string;
};

const toTelegramConfigObject = (payload: TelegramConfigPayload): Record<string, any> => {
    if (payload.config && typeof payload.config === "object") {
        return payload.config;
    }

    let websiteContext = payload.websiteType || "Telegram";
    if (payload.websiteType === "Other" && payload.otherWebsiteType) {
        websiteContext = payload.otherWebsiteType;
    }

    return {
        botType: payload.botType || "General Purpose",
        websiteType: websiteContext,
        tone: payload.tone || "Friendly",
        verbosity: payload.verbosity || "Concise",
        behaviorDescription: payload.behaviorDescription || "A helpful Telegram assistant bot.",
        OwnerInformation: payload.OwnerInformation || "No owner information provided.",
        additionalInformation: payload.additionalInformation || "No additional information provided.",
        examples: payload.examples || [],
        apiEndpoint: payload.apiEndpoint || "",
        responseFormat: payload.responseFormat || "",
        apiUsageRules: payload.apiUsageRules || "",
    };
};

const normalizeExamples = (examples: unknown): any[] => {
    if (Array.isArray(examples)) return examples;
    if (typeof examples === "string") {
        try {
            const parsed = JSON.parse(examples);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
};

const looksLikeConfigSavePayload = (body: TelegramConfigPayload): boolean => {
    return Boolean(body?.botId && (body?.config || body?.botType || body?.behaviorDescription || body?.tone || body?.examples));
};

const normalizeBotStyle = (style?: string): "free-style" | "controlled-style" => {
    return style === "controlled-style" ? "controlled-style" : "free-style";
};

export const validateBotTokenController = async (req: Request, res: Response): Promise<Response> => {

    try {
        const { botToken } = req.params;
        if (!botToken) {
            return res.status(400).json({ message: "Bot token is required." });
        }

        const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
        const data = await response.json();

        if (response.status !== 200 || !data.ok) {
            return res.status(400).json({ message: "Invalid Telegram bot token.", data: data });
        }

        return res.status(200).json({ message: "Bot token is valid." });
    }
    catch (error) {
        return res.status(500).json({ message: "An error occurred while validating the bot token.", error: (error as Error).message });
    }
}

export const SaveTelegramBotConfigurationController = async (req: Request, res: Response): Promise<Response> => {

    try {

        const { userId, botId, botStyle, botType, websiteType, otherWebsiteType, tone, verbosity, behaviorDescription, OwnerInformation, additionalInformation, examples, apiEndpoint, responseFormat, apiUsageRules, botToken } = req.body;

        if (!userId || !botId) {
            return res.status(400).json({ message: "Important fields are required." });
        }

        //fetchign bot to ensure it exists and belongs to the user
        const bot = await BotStructureModel.findOne({ _id: botId, platform: "Telegram" });
        if (!bot) {
            return res.status(404).json({ message: "Bot not found." });
        }

        // Normalize bot style
        const configObject = toTelegramConfigObject({ botId, userId, botStyle, botType, websiteType, otherWebsiteType, tone, verbosity, behaviorDescription, OwnerInformation, additionalInformation, examples, apiEndpoint, responseFormat, apiUsageRules });

        const normalizedExamples = normalizeExamples(configObject.examples);
        configObject.examples = normalizedExamples;


        // Construct webhook URL
        const baseUrl = process.env.TELEGRAM_WEBHOOK_BASE_URL || `${req.protocol}://${req.get("host")}`;
        const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/Telegram/webhook/${botId}`;

        // Register webhook with Telegram
        const hookRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: webhookUrl }),
        });
        const hookData = await hookRes.json();

        if (hookRes.status !== 200 || !hookData.ok) {
            return res.status(400).json({ message: "Failed to register webhook.", data: hookData });
        }

        const botConfig = await botConfiguration.insertOne({
            botId,
            userId,
            config: configObject,
            webhookUrl: webhookUrl,
            botToken: botToken,
            webhookRegistered: true,
            configStatus: 'config',
        });

        if (!botConfig) {
            return res.status(500).json({ message: "Failed to save bot configuration." });
        }

        bot.status = "inactive";
        bot.currentState = "configure";
        await bot.save();

        return res.status(200).json({ message: "Telegram bot configuration saved successfully.", botConfig: botConfig._id });
    }
    catch (error) {
        console.error("Error in SaveTelegramBotConfigurationController:", error);
        return res.status(500).json({ message: "An error occurred while saving Telegram bot configuration.", error: (error as Error).message });
    }
}




export const CommunicateWithTelegramFreeStyleBotController = async (req: Request, res: Response): Promise<void> => {
    try {
        await ProcessUserQueryForTelegramFreeStyleBotController(req, res);
    }
    catch (e) {
        console.error("Error in CommunicateWithTelegramFreeStyleBotController:", e);
        res.sendStatus(500);
        return;
    }
}



export const ProcessUserQueryForTelegramFreeStyleBotController = async (req: Request, res: Response): Promise<void> => {
    let chatId: string | number | undefined;
    let botTokenForErrorNotification = "";

    try {

        const update = req.body;
        chatId = update?.message?.chat?.id;
        const userMessage = update?.message?.text;
        const { botId } = req.params;

        if (!botId || !chatId || !userMessage) {
            // Telegram sends many update types (joins, callbacks, media). Ignore non-text updates gracefully.
            res.sendStatus(404);
            return;
        }

        const botDetails = await getFromRedisStringOnly(`TelegramBotDetails:${botId}`);
        let botStatus: any = null;
        let botConfig: any = null;
        let botName = "CuteBot";
        let scrapeStatus = "notOpted";
        let botToken = "";

        if (botDetails) {
            const parsedDetails = typeof botDetails === "string" ? JSON.parse(botDetails) : botDetails;
            botStatus = { status: parsedDetails.status };
            botConfig = { config: parsedDetails.config };
            botName = parsedDetails.botName || "CuteBot";
            scrapeStatus = parsedDetails.scrapeStatus || "notOpted";
            botToken = parsedDetails.botToken || "";
            botTokenForErrorNotification = botToken;
        }
        else {
            botStatus = await BotStructureModel.findOne({ _id: botId, platform: "Telegram" });
            if (!botStatus) {
                res.sendStatus(404);
                return;
            }

            botConfig = await botConfiguration.findOne({ botId: botId });
            if (!botConfig) {
                await notifyTelegramIssue(botStatus.botToken || "", chatId, "loading the bot configuration");
                res.sendStatus(200);
                return;
            }

            scrapeStatus = (botStatus as any).scrapeStatus || "notOpted";
            botToken = botConfig.botToken || botStatus.botToken || "";
            botTokenForErrorNotification = botToken;

            await redis.set(`TelegramBotDetails:${botId}`, JSON.stringify({
                status: botStatus.status,
                botName: botStatus.botName,
                config: botConfig.config,
                scrapeStatus: scrapeStatus,
                botToken,
            }), { ex: 1800 });
        }

        if (!botToken) {
            const tokenRecord = await botConfiguration.findOne(
                { botId },
                { botToken: 1, config: 1 }
            );

            if (tokenRecord?.botToken) {
                botToken = tokenRecord.botToken;
                botTokenForErrorNotification = botToken;

                if (!botConfig) {
                    botConfig = { config: tokenRecord.config || {} };
                }

                await redis.set(`TelegramBotDetails:${botId}`, JSON.stringify({
                    status: botStatus?.status,
                    botName,
                    config: botConfig?.config || {},
                    scrapeStatus,
                    botToken,
                }), { ex: 1800 });
            } else {
                console.error("[Telegram][Flow] botToken not found in botConfiguration", { botId });
            }
        }

        if (botStatus.status !== "active") {
            await notifyTelegramIssue(botToken, chatId, "serving requests because this bot is inactive");
            res.sendStatus(200);
            return;
        }

        const config = botConfig?.config || {};

        let examples: unknown = config.examples;
        if (typeof examples === "string") {
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

        const examplesText = Array.isArray(config.examples) && config.examples.length
            ? config.examples
                .map((example: { question?: string; answer?: string }, idx: number) => `Example ${idx + 1}:\nUser: ${example.question || ""}\nBot: ${example.answer || ""}`)
                .join("\n\n")
            : undefined;

        const hasApiIntegration = Boolean(config.apiEndpoint || config.apiIntegration);

        const systemPrompt = freeStyleWebsiteBotPrompt({
            botName: botName || "SampleBot",
            botType: config.botType || "General Purpose",
            tone: config.tone || "Friendly",
            verbosity: config.verbosity || "Concise",
            websiteType: config.websiteType || "Telegram",
            channel: "telegram",
            description: config.behaviorDescription || "A helpful Telegram assistant bot.",
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

        let lastMessages: any[] = [];
        const redisKey = `TelegramBotChatHistory:${botId}:${chatId}`;
        const storedMessages = await redis.lrange(redisKey, -4, -1);

        if (storedMessages && storedMessages.length > 0) {
            lastMessages = storedMessages.map(msg => typeof msg === "string" ? JSON.parse(msg) : msg);
        }

        const apiUsageRules = config.apiUsageRules || "";
        const tools = hasApiIntegration ? getToolDefinitions(hasApiIntegration, apiUsageRules) : [];

        let ragContext: string | null = null;
        if (scrapeStatus === "completed") {
            ragContext = await retrieveRAGContext(botId, userMessage, 3);
        }

        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: "system", content: systemPrompt },
            ...(ragContext ? [{ role: "system" as const, content: `Relevant website information:\n${ragContext}\n\nUse this context to answer user questions accurately. Cite the relevant section numbers when applicable.` }] : []),
            ...lastMessages,
            { role: "user", content: userMessage }
        ];

        let finalResponse = "";
        let iterations = 0;
        const maxIterations = 5;
        let tokenIn = 0;
        let tokenOut = 0;
        let totalToken = 0;
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
                break;
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
                        const toolTraceId = `${botId}:${chatId}:${toolCall.id || crypto.randomUUID()}`;

                        if (toolCall.function.name === "fetch_external_data") {
                            let args: any = {};
                            try {
                                const rawArgs = toolCall.function.arguments;
                                args = typeof rawArgs === "string" ? JSON.parse(rawArgs || "{}") : (rawArgs || {});
                            } catch (parseErr) {
                                console.warn("Failed to parse tool arguments; using empty args", parseErr);
                                args = {};
                            }

                            const { endpoint, queryParams } = args;

                            const resolvedUrl = resolveExternalApiUrl(
                                endpoint,
                                queryParams && typeof queryParams === "object" ? (queryParams as Record<string, unknown>) : undefined,
                                config.apiEndpoint
                            );

                            if (!resolvedUrl.url) {
                                toolResult = `Error: ${resolvedUrl.reason || "Invalid endpoint"}`;
                            } else {
                                const safeApiUrl = redactSensitiveQueryParamsForLog(resolvedUrl.url);
                                const fetchStart = Date.now();

                                const data = await fetchData(resolvedUrl.url);
                                const durationMs = Date.now() - fetchStart;
                                const responseType = Array.isArray(data) ? "array" : typeof data;
                                const itemCount = Array.isArray(data) ? data.length : undefined;

                                toolResult = JSON.stringify(data, null, 2);
                            }
                        }

                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: toolResult,
                        } as any);
                    } catch (toolError: any) {
                        console.error("[Telegram][Tool] Tool execution error", {
                            toolName: toolCall?.function?.name,
                            toolCallId: toolCall?.id,
                            error: toolError,
                        });
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
            await notifyTelegramIssue(botToken, chatId);
            finalResponse = "Sorry, I could not generate a response right now. Please try again.";
        }

        const lastMessageLength = lastMessages.length;
        if (lastMessageLength >= 4) {
            await redis.ltrim(redisKey, -3, -1);
        }
        await redis.rpush(redisKey, JSON.stringify({ role: "user", content: userMessage }));
        await redis.rpush(redisKey, JSON.stringify({ role: "assistant", content: finalResponse }));
        await redis.expire(redisKey, 60 * 60);
        latency = new Date().getTime() - latency;

        (async () => {
            // await analyticsInsertionHelper(botId, apiKey || "NOT_FOUND", "openai/gpt-oss-safeguard-20b", latency, tokenIn, tokenOut, totalToken, "request");
        })();

        const sent = await sendTelegramTextMessage(botToken, chatId, finalResponse);

        if (!sent) {
            console.error("[Telegram][Flow] Failed to deliver message to Telegram", { botId, chatId });
            res.sendStatus(500);
            return;
        }
        res.sendStatus(200);
        return;
    }
    catch (e) {
        console.error("Error in ProcessUserQueryForTelegramFreeStyleBotController:", e);
        const botTokenFromRequest = botTokenForErrorNotification || req.body?.botToken || req.query?.botToken || req.headers?.["x-bot-token"];

        if (chatId && typeof botTokenFromRequest === "string" && botTokenFromRequest) {
            await notifyTelegramIssue(botTokenFromRequest, chatId);
        }
        res.sendStatus(500);
        return;
    }
}

type TelegramControlledOption = {
    optionId: string;
    intent: string;
    toNodeId: string;
    order: number;
};

type TelegramControlledNodeContainer = {
    currentNode: any;
    options: TelegramControlledOption[];
};

type TelegramControlledSession = {
    currentNodeId: string;
    previousNodeId: string | null;
    retryCount?: number;
};

const parseTelegramControlledInput = (update: any): { chatId?: string | number; userInput?: string } => {
    const callbackData = update?.callback_query?.data;
    const callbackChatId = update?.callback_query?.message?.chat?.id;
    if (callbackData && callbackChatId) {
        return { chatId: callbackChatId, userInput: String(callbackData) };
    }

    const text = update?.message?.text;
    const chatId = update?.message?.chat?.id;
    if (text && chatId) {
        return { chatId, userInput: String(text) };
    }

    return {};
};

const normalizeControlledInput = (value: string): string => value.trim().toLowerCase();

const getControlledTelegramNodeMessage = (node: any): string => {
    return node?.output?.customText || node?.message || "";
};

const extractApiRequestFromConfig = (apiConfig: any): { endpoint: string; queryParams: Record<string, any> } | null => {
    if (!apiConfig) return null;

    const endpoint = apiConfig?.apiRequest?.endpointKey || apiConfig?.endpointKey || "";
    const queryParams =
        apiConfig?.apiRequest?.queryParams ||
        apiConfig?.queryParams ||
        apiConfig?.queryParameter ||
        {};

    if (!endpoint) return null;
    return { endpoint, queryParams };
};

const buildControlledApiUrl = (endpoint: string, queryParams: Record<string, any>): string => {
    const url = new URL(endpoint);
    Object.entries(queryParams || {}).forEach(([key, val]) => {
        if (val === null || val === undefined) return;
        if (Array.isArray(val)) {
            val.forEach((item) => url.searchParams.append(key, String(item)));
            return;
        }
        url.searchParams.set(key, String(val));
    });
    return url.toString();
};

const formatOptionListForTelegram = (options: TelegramControlledOption[]): string => {
    return options
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((option, index) => `${index + 1}. ${option.intent}`)
        .join("\n");
};

const getControlledNodeFromCacheOrDb = async (
    botId: string,
    nodeId: string,
    nodeRedisKey: (id: string) => string
): Promise<TelegramControlledNodeContainer | null> => {
    const cachedNode = await getFromRedisStringOnly(nodeRedisKey(nodeId));
    if (cachedNode) {
        const currentNode = cachedNode.currentNode || cachedNode;
        const options = Array.isArray(cachedNode.options) ? cachedNode.options : [];
        return { currentNode, options };
    }

    const nodeData = await ControlledBotNodeModel.findOne({ _id: nodeId, botId });
    if (!nodeData) return null;

    const dbEdges = await ControlledBotEdgeModel.find({ fromNodeId: nodeData._id }).sort({ order: 1 });
    const options = dbEdges.map((edge: any) => ({
        optionId: edge?._id?.toString?.() || "",
        intent: edge?.intent || "Option",
        toNodeId: edge?.toNodeId?.toString?.() || "",
        order: Number(edge?.order ?? 0),
    }));

    const nodeContainer: TelegramControlledNodeContainer = {
        currentNode: nodeData,
        options,
    };

    await redis.set(nodeRedisKey(nodeId), JSON.stringify(nodeContainer), { ex: 86400 });
    return nodeContainer;
};

const resolveSelectedOption = (
    userInput: string,
    options: TelegramControlledOption[]
): TelegramControlledOption | null => {
    if (!options.length) return null;
    const normalized = normalizeControlledInput(userInput);
    const asNumber = Number(normalized);

    if (!Number.isNaN(asNumber) && asNumber >= 1 && asNumber <= options.length) {
        return options[asNumber - 1] || null;
    }

    return (
        options.find((option) => {
            return normalizeControlledInput(option.intent) === normalized || normalizeControlledInput(option.optionId) === normalized;
        }) || null
    );
};

const executeControlledApiNode = async (node: any): Promise<string> => {
    const reqInfo = extractApiRequestFromConfig(node?.apiConfig);
    if (!reqInfo) return "API configuration is missing for this node.";

    try {
        const fullUrl = buildControlledApiUrl(reqInfo.endpoint, reqInfo.queryParams || {});
        const response = await fetch(fullUrl, {
            method: node?.apiConfig?.method || "GET",
        });

        if (!response.ok) {
            return "Failed to fetch API response for this node.";
        }

        const apiData = await response.json();
        const compact = typeof apiData === "string" ? apiData : JSON.stringify(apiData);
        return compact.length > 1200 ? compact.slice(0, 1200) + "..." : compact;
    } catch (error) {
        console.error("[Telegram][Controlled] API executor error", error);
        return "Failed to fetch API response for this node.";
    }
};

const sendControlledNodeToTelegram = async (
    botToken: string,
    chatId: string | number,
    nodeContainer: TelegramControlledNodeContainer
): Promise<boolean> => {
    const node = nodeContainer.currentNode;
    const baseMessage = getControlledTelegramNodeMessage(node) || "Please continue.";

    if (node?.executor === "none" && node?.output?.mode === "options") {
        const optionsText = formatOptionListForTelegram(nodeContainer.options);
        const text = `${baseMessage}\n\n${optionsText}\n\nReply with option number/text, or use /back or /end.`;
        return sendTelegramTextMessage(botToken, chatId, text);
    }

    if (node?.executor === "input") {
        const inputLabel = node?.inputConfig?.key ? ` (${node.inputConfig.key})` : "";
        const text = `${baseMessage}\n\nPlease provide input${inputLabel}. Use /back or /end anytime.`;
        return sendTelegramTextMessage(botToken, chatId, text);
    }

    if (node?.executor === "api") {
        const apiResultText = await executeControlledApiNode(node);
        return sendTelegramTextMessage(botToken, chatId, `${baseMessage}\n\n${apiResultText}`);
    }

    return sendTelegramTextMessage(botToken, chatId, `${baseMessage}\n\nUse /back or /end.`);
};

export const CommunicateWithTelegramControlledStyleBotController = async (req: Request, res: Response): Promise<void> => {
    let chatId: string | number | undefined;
    let botToken = "";

    try {
        const { botId } = req.params;
        const update = req.body;
        const parsed = parseTelegramControlledInput(update);
        chatId = parsed.chatId;
        const userInput = parsed.userInput;

        if (!botId || !chatId || !userInput) {
            res.sendStatus(200);
            return;
        }

        const botRedisKey = `TelegramControlledBotDetails:${botId}`;
        const sessionRedisKey = `TelegramControlledBotSession:${botId}:${chatId}`;
        const nodeRedisKey = (nodeId: string) => `TelegramControlledBotNode:${botId}:${nodeId}`;

        let botDetails = await getFromRedisStringOnly(botRedisKey);
        if (!botDetails) {
            const controlledBot = await ControlledBotModel.findOne({ _id: botId, platform: "Telegram" });
            if (!controlledBot) {
                res.sendStatus(404);
                return;
            }

            botDetails = {
                status: controlledBot.status,
                entryNodeId: controlledBot.entryNodeId?.toString?.() || null,
                botToken: controlledBot.botToken || "",
            };

            await redis.set(botRedisKey, JSON.stringify(botDetails), { ex: 1800 });
        }

        botToken = botDetails.botToken || "";
        const botStatus = botDetails.status;
        const entryNodeId = botDetails.entryNodeId;

        if (!botToken) {
            console.error("[Telegram][Controlled] botToken missing", { botId });
            res.sendStatus(200);
            return;
        }

        if (botStatus !== "active") {
            await sendTelegramTextMessage(botToken, chatId, "This controlled bot is inactive.");
            res.sendStatus(200);
            return;
        }

        if (!entryNodeId) {
            await sendTelegramTextMessage(botToken, chatId, "Entry node is not configured for this controlled bot.");
            res.sendStatus(200);
            return;
        }

        const normalizedInput = normalizeControlledInput(userInput);
        if (normalizedInput === "/end") {
            await redis.del(sessionRedisKey);
            await sendTelegramTextMessage(botToken, chatId, "Chat ended. Send /start to start again.");
            res.sendStatus(200);
            return;
        }

        const session = await getFromRedisStringOnly(sessionRedisKey) as TelegramControlledSession | null;

        if (!session || normalizedInput === "/start") {
            const firstNode = await getControlledNodeFromCacheOrDb(botId, String(entryNodeId), nodeRedisKey);
            if (!firstNode) {
                await sendTelegramTextMessage(botToken, chatId, "Unable to start controlled flow. Entry node missing.");
                res.sendStatus(200);
                return;
            }

            await redis.set(sessionRedisKey, JSON.stringify({
                currentNodeId: String(entryNodeId),
                previousNodeId: null,
                retryCount: 0,
            }), { ex: 60 * 60 });

            const sent = await sendControlledNodeToTelegram(botToken, chatId, firstNode);
            res.sendStatus(sent ? 200 : 500);
            return;
        }

        if (normalizedInput === "/back") {
            if (!session.previousNodeId) {
                await sendTelegramTextMessage(botToken, chatId, "You are already at the start node.");
                res.sendStatus(200);
                return;
            }

            const previousNode = await getControlledNodeFromCacheOrDb(botId, session.previousNodeId, nodeRedisKey);
            if (!previousNode) {
                await sendTelegramTextMessage(botToken, chatId, "Unable to go back right now.");
                res.sendStatus(200);
                return;
            }

            await redis.set(sessionRedisKey, JSON.stringify({
                currentNodeId: session.previousNodeId,
                previousNodeId: null,
                retryCount: 0,
            }), { ex: 60 * 60 });

            const sent = await sendControlledNodeToTelegram(botToken, chatId, previousNode);
            res.sendStatus(sent ? 200 : 500);
            return;
        }

        const currentNodeContainer = await getControlledNodeFromCacheOrDb(botId, session.currentNodeId, nodeRedisKey);
        if (!currentNodeContainer) {
            await redis.del(sessionRedisKey);
            await sendTelegramTextMessage(botToken, chatId, "Session expired. Send /start to begin again.");
            res.sendStatus(200);
            return;
        }

        const currentNode = currentNodeContainer.currentNode;

        if (currentNode?.executor === "none" && currentNode?.output?.mode === "options") {
            const chosenOption = resolveSelectedOption(userInput, currentNodeContainer.options);
            if (!chosenOption?.toNodeId) {
                const optionsText = formatOptionListForTelegram(currentNodeContainer.options);
                await sendTelegramTextMessage(botToken, chatId, `Invalid option.\n\n${optionsText}`);
                res.sendStatus(200);
                return;
            }

            const nextNode = await getControlledNodeFromCacheOrDb(botId, chosenOption.toNodeId, nodeRedisKey);
            if (!nextNode) {
                await sendTelegramTextMessage(botToken, chatId, "Next node is missing in configured flow.");
                res.sendStatus(200);
                return;
            }

            await redis.set(sessionRedisKey, JSON.stringify({
                currentNodeId: chosenOption.toNodeId,
                previousNodeId: session.currentNodeId,
                retryCount: 0,
            }), { ex: 60 * 60 });

            const sent = await sendControlledNodeToTelegram(botToken, chatId, nextNode);
            res.sendStatus(sent ? 200 : 500);
            return;
        }

        if (currentNode?.executor === "input") {
            const validationRegex = currentNode?.inputConfig?.validationRegex;
            const retryLimit = Number(currentNode?.inputConfig?.retryLimit ?? 0);
            const retryCount = Number(session.retryCount ?? 0);

            if (validationRegex) {
                const pattern = new RegExp(validationRegex);
                if (!pattern.test(userInput)) {
                    const newRetryCount = retryCount + 1;
                    await redis.set(sessionRedisKey, JSON.stringify({
                        currentNodeId: session.currentNodeId,
                        previousNodeId: session.previousNodeId,
                        retryCount: newRetryCount,
                    }), { ex: 60 * 60 });

                    if (retryLimit > 0 && newRetryCount >= retryLimit) {
                        await sendTelegramTextMessage(botToken, chatId, "Input failed validation too many times. Use /back or /end.");
                    } else {
                        await sendTelegramTextMessage(botToken, chatId, "Invalid input format. Please try again.");
                    }

                    res.sendStatus(200);
                    return;
                }
            }

            const nextNodeId = currentNode?.inputConfig?.nextNodeId?.toString?.() || currentNode?.inputConfig?.nextNodeId;
            if (!nextNodeId) {
                await sendTelegramTextMessage(botToken, chatId, "Input node next step is not configured.");
                res.sendStatus(200);
                return;
            }

            const nextNode = await getControlledNodeFromCacheOrDb(botId, String(nextNodeId), nodeRedisKey);
            if (!nextNode) {
                await sendTelegramTextMessage(botToken, chatId, "Unable to continue to next node.");
                res.sendStatus(200);
                return;
            }

            await redis.set(sessionRedisKey, JSON.stringify({
                currentNodeId: String(nextNodeId),
                previousNodeId: session.currentNodeId,
                retryCount: 0,
            }), { ex: 60 * 60 });

            const sent = await sendControlledNodeToTelegram(botToken, chatId, nextNode);
            res.sendStatus(sent ? 200 : 500);
            return;
        }

        if (currentNode?.executor === "api") {
            const sentCurrent = await sendControlledNodeToTelegram(botToken, chatId, currentNodeContainer);
            if (!sentCurrent) {
                res.sendStatus(500);
                return;
            }

            const nextNodeId = currentNode?.apiConfig?.nextNodeId?.toString?.() || currentNode?.apiConfig?.nextNodeId;
            if (nextNodeId) {
                const nextNode = await getControlledNodeFromCacheOrDb(botId, String(nextNodeId), nodeRedisKey);
                if (nextNode) {
                    await redis.set(sessionRedisKey, JSON.stringify({
                        currentNodeId: String(nextNodeId),
                        previousNodeId: session.currentNodeId,
                        retryCount: 0,
                    }), { ex: 60 * 60 });

                    await sendControlledNodeToTelegram(botToken, chatId, nextNode);
                }
            }

            res.sendStatus(200);
            return;
        }

        const sent = await sendControlledNodeToTelegram(botToken, chatId, currentNodeContainer);
        res.sendStatus(sent ? 200 : 500);
    } catch (error) {
        console.error("Error in CommunicateWithTelegramControlledStyleBotController:", error);
        if (chatId && botToken) {
            await notifyTelegramIssue(botToken, chatId);
        }
        res.sendStatus(500);
    }
};
