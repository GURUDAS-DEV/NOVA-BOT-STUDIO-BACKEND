import type { Request, Response } from "express"
import { botConfiguration } from "../../Models/BotConfiguration.js";
import { freeStyleWebsiteBotPrompt, getToolDefinitions, fetchData } from "../../utils/System_Prompt/Website.js";
import {OpenAI} from "openai";


export const testingTheBot = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { botId, userMessage } = req.body;
        if (!botId || !userMessage) {
            return res.status(404).json({ message: "botId and userMessage are required" });
        }

        const botConfig = await botConfiguration.findOne({ botId: botId });
        if (!botConfig) {
            return res.status(404).json({ message: "Bot configuration not found" });
        }

        const config = botConfig.config || {};
        const examplesText = Array.isArray(config.examples) && config.examples.length
            ? config.examples
                .map((example: { question?: string; answer?: string }, idx: number) => `Example ${idx + 1}:
User: ${example.question || ""}
Bot: ${example.answer || ""}`)
                .join("\n\n")
            : undefined;

        const hasApiIntegration = Boolean(config.apiEndpoint || config.apiIntegration);

        const systemPrompt = freeStyleWebsiteBotPrompt({
            botName: config.botName || "Website Assistant",
            botType: config.botType || "Website Assistant",
            tone: config.tone || "",
            verbosity: config.verbosity || "",
            websiteType: config.websiteType || "",
            description: config.behaviorDescription || "",
            AdditionalInformation: config.additionalInformation || config.AdditionalInformation || "",
            ownerInformation: config.ownerInformation || config.OwnerInformation || "",
            examples: examplesText,
            apiIntegration: hasApiIntegration,
            apiEndpoint: config.apiEndpoint,
            apiResponseFormat: config.responseFormat,
            apiUsageRule: config.apiUsageRules,
        });

        const openai = new OpenAI({
            apiKey: process.env.TEXT_ENHANCER_API_KEY,
            baseURL: "https://api.groq.com/openai/v1"
        });

        const apiUsageRules = config.apiUsageRules ||"";

        const tools = getToolDefinitions(hasApiIntegration, apiUsageRules);
        const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage },
        ];

        let finalResponse = "";
        let iterations = 0;
        const maxIterations = 5; // Prevent infinite loops

        // Loop to handle tool calls
        while (iterations < maxIterations) {
            iterations++;

            const requestParams: any = {
                model: "openai/gpt-oss-safeguard-20b",
                messages: messages,
            };

            // Only add tools if API integration is enabled
            if (tools.length > 0) {
                requestParams.tools = tools;
            }

            const response = await openai.chat.completions.create(requestParams);

            if (!response || !response.choices || response.choices.length === 0) {
                return res.status(500).json({ error: "Failed to get response from OpenAI" });
            }

            const message = (response.choices[0] as any).message;

            // Check if LLM is requesting a tool call
            if (message.tool_calls && message.tool_calls.length > 0) {
                // Add assistant's message with tool call
                messages.push({
                    role: "assistant",
                    content: message.content || "",
                    tool_calls: message.tool_calls as any
                });

                // Process each tool call
                for (const toolCall of message.tool_calls) {
                    try {
                        let toolResult = "";

                        if (toolCall.function.name === "fetch_external_data") {
                            const args = JSON.parse(toolCall.function.arguments);
                            const { endpoint, queryParams } = args;

                            // Construct the full API URL with proper query parameters
                            const params = new URLSearchParams();
                            if (queryParams && typeof queryParams === 'object') {
                                Object.entries(queryParams).forEach(([key, value]) => {
                                    params.append(key, String(value));
                                });
                            }
                            const apiUrl = endpoint.includes("?")
                                ? `${endpoint}&${params.toString()}`
                                : `${endpoint}?${params.toString()}`;
                            
                            console.log("ApiUrl:", apiUrl);
                            const data = await fetchData(apiUrl);
                            toolResult = JSON.stringify(data, null, 2);
                        }

                        // Add tool result to messages
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: toolResult
                        } as any);
                    } catch (toolError: any) {
                        console.error("Tool execution error:", toolError);
                        messages.push({
                            role: "tool",
                            tool_call_id: toolCall.id,
                            content: `Error: ${toolError.message || "Failed to fetch data"}`
                        } as any);
                    }
                }
            } else {
                // LLM has provided final response
                finalResponse = message.content || "";
                break;
            }
        }

        if (!finalResponse) {
            return res.status(500).json({ error: "Failed to get final response from LLM" });
        }

        return res.status(200).json({ Res: "Bot tested successfully", message: finalResponse });
    } catch (err) {
        console.error("Error testing the bot:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};


