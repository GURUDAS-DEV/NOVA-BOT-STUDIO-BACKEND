import type { Interaction, ChatInputCommandInteraction } from "discord.js";
import { resolveBotFromGuild } from "../../services/Discord/DiscordBotResolverService.js";
import { freeStyleWebsiteBotPrompt, getToolDefinitions, fetchData } from "../../utils/System_Prompt/Website.js";
import { OpenAI } from "openai";
import { getRedisClient } from "../../Redis/connect.js";
import { supabase } from "../../Database/postgresql.js";


const redis = getRedisClient();

const DISCORD_MAX_LENGTH = 2000;
const DISCORD_ERROR_MESSAGE = "Something went wrong while processing your request.";

// ─── RAG Context Retrieval (mirrors Telegram implementation) ───

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
                return parsed.map((item) => Number(item)).filter((item) => Number.isFinite(item));
            }
        } catch {
            return null;
        }
    }
    return null;
};

const cosineSimilarity = (a: number[], b: number[]): number => {
    if (!a.length || !b.length || a.length !== b.length) return -1;
    let dot = 0, normA = 0, normB = 0;
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
            baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
        });

        const embeddingResponse = await embeddingClient.embeddings.create({
            model: "gemini-embedding-001",
            input: userQuery.trim(),
        });

        if (!embeddingResponse.data?.[0]?.embedding) {
            console.warn("[Discord][RAG] Failed to generate query embedding");
            return null;
        }

        const queryEmbedding = embeddingResponse.data[0].embedding;

        const { data: documents, error } = await supabase
            .from("embeddingstorage")
            .select("content, embedding")
            .eq("botId", botId)
            .limit(200);

        if (error) {
            console.warn("[Discord][RAG] Supabase query error:", error.message);
            return null;
        }

        if (!documents || documents.length === 0) return null;

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

        if (rankedDocuments.length === 0) return null;

        return rankedDocuments
            .map((doc, idx) => {
                const truncated = doc.content.length > 400 ? doc.content.substring(0, 400) + "..." : doc.content;
                return `[${idx + 1}] ${truncated}`;
            })
            .join("\n\n");
    } catch (err) {
        console.warn("[Discord][RAG] Retrieval failed:", err);
        return null;
    }
};

// ─── URL Resolution helpers  ───

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
            return { url: null, resolution: "invalid", reason: "Unable to resolve endpoint against configured API endpoint" };
        }
    } else if (!rawEndpoint && baseEndpoint && isHttpUrl(baseEndpoint)) {
        workingUrl = baseEndpoint;
        resolution = "configured-base-only";
    } else {
        return { url: null, resolution: "invalid", reason: "Endpoint is missing or invalid and no valid configured API endpoint is available" };
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
        return { url: null, resolution: "invalid", reason: "Resolved URL is not valid" };
    }
};

// ─── Message Splitting for Discord 2000 char limit ───

const splitMessage = (text: string, maxLength: number = DISCORD_MAX_LENGTH): string[] => {
    if (text.length <= maxLength) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= maxLength) {
            chunks.push(remaining);
            break;
        }

        // Try to split at a natural boundary (newline, then sentence, then space)
        let splitIndex = remaining.lastIndexOf("\n", maxLength);
        if (splitIndex <= 0) splitIndex = remaining.lastIndexOf(". ", maxLength);
        if (splitIndex <= 0) splitIndex = remaining.lastIndexOf(" ", maxLength);
        if (splitIndex <= 0) splitIndex = maxLength;

        chunks.push(remaining.substring(0, splitIndex).trim());
        remaining = remaining.substring(splitIndex).trim();
    }

    return chunks;
};

// ─── Main Interaction Handler ───

export const handleDiscordInteraction = async (interaction: Interaction): Promise<void> => {
    // Only process ChatInputCommand interactions (slash commands)
    if (!interaction.isChatInputCommand()) {
        return;
    }

    console.log("[Discord] Interaction received:", interaction.commandName);

    // Only handle the /ask command
    if (interaction.commandName !== "ask") {
        await interaction.reply({
            content: "Unknown command. Use `/ask question:Your question here` to chat with the bot.",
            ephemeral: true,
        });
        return;
    }

    await processAskCommand(interaction);
};

// ─── /ask Command Processor ───

const processAskCommand = async (interaction: ChatInputCommandInteraction): Promise<void> => {
    const question = interaction.options.getString("question");
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    console.log(`[Discord] /ask command received`);
    console.log(`[Discord] guildId: ${guildId}`);
    console.log(`[Discord] userId: ${userId}`);

    if (!question || question.trim().length === 0) {
        await interaction.reply({
            content: "Please provide a question. Usage: `/ask question:What is AI?`",
            ephemeral: true,
        });
        return;
    }

    if (!guildId) {
        await interaction.reply({
            content: "This command can only be used inside a Discord server.",
            ephemeral: true,
        });
        return;
    }

    // Defer reply — LLM processing can take a few seconds
    await interaction.deferReply();

    try {
        // ─── Step 1: Resolve bot from guild ───
        const resolvedBot = await resolveBotFromGuild(guildId);

        if (!resolvedBot) {
            await interaction.editReply("No bot is configured for this server yet. Please ask the server admin to set up a Nova bot.");
            return;
        }

        const { botId, botName, status, scrapeStatus, config } = resolvedBot;
        console.log(`[Discord] botId resolved: ${botId}`);

        // ─── Step 2: Check bot is active ───
        if (status !== "active") {
            await interaction.editReply("This bot is currently inactive. Please contact the server admin.");
            return;
        }

        // ─── Step 3: Build system prompt ───
        let examples: unknown = config.examples;
        if (typeof examples === "string") {
            try {
                examples = JSON.parse(examples);
            } catch {
                examples = [];
            }
        }
        if (!Array.isArray(examples)) examples = [];
        config.examples = examples;

        const examplesText = Array.isArray(config.examples) && config.examples.length
            ? config.examples
                .map((ex: { question?: string; answer?: string }, idx: number) =>
                    `Example ${idx + 1}:\nUser: ${ex.question || ""}\nBot: ${ex.answer || ""}`)
                .join("\n\n")
            : undefined;

        const hasApiIntegration = Boolean(config.apiEndpoint || config.apiIntegration);

        const promptParams: Parameters<typeof freeStyleWebsiteBotPrompt>[0] = {
            botName: botName || "NovaBot",
            botType: config.botType || "General Purpose",
            tone: config.tone || "Friendly",
            verbosity: config.verbosity || "Concise",
            websiteType: config.websiteType || "Discord",
            channel: "discord",
            description: config.behaviorDescription || "A helpful Discord assistant bot.",
            ownerInformation: config.OwnerInformation || "No owner information provided.",
            AdditionalInformation: config.additionalInformation || "No additional information provided.",
            apiIntegration: hasApiIntegration,
            apiEndpoint: config.apiEndpoint || "",
            apiResponseFormat: config.responseFormat || "",
            apiUsageRule: config.apiUsageRules || "",
        };

        if (examplesText) {
            promptParams.examples = examplesText;
        }

        const systemPrompt = freeStyleWebsiteBotPrompt(promptParams);

        // ─── Step 4: Create LLM client ───
        const openai = new OpenAI({
            apiKey: process.env.TEXT_ENHANCER_API_KEY,
            baseURL: "https://api.groq.com/openai/v1",
        });

        // ─── Step 5: Fetch chat history from Redis ───
        const redisKey = `DiscordBotChatHistory:${botId}:${guildId}:${userId}`;
        let lastMessages: any[] = [];
        const storedMessages = await redis.lrange(redisKey, -4, -1);

        if (storedMessages && storedMessages.length > 0) {
            lastMessages = storedMessages.map((msg) => typeof msg === "string" ? JSON.parse(msg) : msg);
        }

        // ─── Step 6: Prepare tools ───
        const apiUsageRules = config.apiUsageRules || "";
        const tools = hasApiIntegration ? getToolDefinitions(hasApiIntegration, apiUsageRules) : [];

        // ─── Step 7: RAG context retrieval ───
        console.log(`[Discord] Freestyle processing start for botId: ${botId}`);
        let ragContext: string | null = null;
        if (scrapeStatus === "completed") {
            ragContext = await retrieveRAGContext(botId, question, 3);
        }

        // ─── Step 8: Build messages array ───
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: "system", content: systemPrompt },
            ...(ragContext
                ? [{ role: "system" as const, content: `Relevant website information:\n${ragContext}\n\nUse this context to answer user questions accurately. Cite the relevant section numbers when applicable.` }]
                : []),
            ...lastMessages,
            { role: "user", content: question },
        ];

        // ─── Step 9: LLM loop with tool calling ───
        let finalResponse = "";
        let iterations = 0;
        const maxIterations = 5;

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

            if (!response?.choices?.length) break;

            const message = response.choices[0] === undefined
                ? { content: "Something went wrong!" }
                : response.choices[0].message;

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
                            let args: any = {};
                            try {
                                const rawArgs = toolCall.function.arguments;
                                args = typeof rawArgs === "string" ? JSON.parse(rawArgs || "{}") : (rawArgs || {});
                            } catch {
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
                                const data = await fetchData(resolvedUrl.url);
                                toolResult = JSON.stringify(data, null, 2);
                            }
                        }

                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: toolResult,
                        } as any);
                    } catch (toolError: any) {
                        console.error("[Discord][Tool] Tool execution error:", {
                            toolName: toolCall?.function?.name,
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

        console.log(`[Discord] Freestyle processing finish for botId: ${botId}`);

        if (!finalResponse) {
            finalResponse = "Sorry, I could not generate a response right now. Please try again.";
        }

        // ─── Step 10: Update chat history in Redis ───
        if (lastMessages.length >= 4) {
            await redis.ltrim(redisKey, -3, -1);
        }
        await redis.rpush(redisKey, JSON.stringify({ role: "user", content: question }));
        await redis.rpush(redisKey, JSON.stringify({ role: "assistant", content: finalResponse }));
        await redis.expire(redisKey, 60 * 60); // 1 hour expiry

        // ─── Step 11: Send reply to Discord (handle long responses) ───
        const chunks = splitMessage(finalResponse);

        await interaction.editReply(chunks[0]!);

        // Send additional chunks as follow-up messages
        for (let i = 1; i < chunks.length; i++) {
            await interaction.followUp(chunks[i]!);
        }
    } catch (error) {
        console.error("[Discord] Error processing /ask command:", error);

        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply(DISCORD_ERROR_MESSAGE);
            } else {
                await interaction.reply({ content: DISCORD_ERROR_MESSAGE, ephemeral: true });
            }
        } catch {
            // Silently ignore if we can't send error reply
        }
    }
};
