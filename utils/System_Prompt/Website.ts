// ===============================
// Freestyle Website Bot Prompt
// ===============================

import { sanitizeAPIResponse } from "../helper/SantizingApi.js";

type FreeStyleBotPromptParams = {
  botName: string;
  botType: string;
  tone: string;
  verbosity: string;
  websiteType: string;
  channel?: "website" | "telegram";

  description: string;

  ownerInformation: string;
  AdditionalInformation: string;

  examples?: string;

  apiIntegration: boolean;
  apiEndpoint?: string;
  apiResponseFormat?: string;
  apiUsageRule?: string;
};

export const getToolDefinitions = (apiIntegration: boolean, apiUsageRule?: string): any[] => {
  if (!apiIntegration) return [];

  const usageRuleText = apiUsageRule?.trim();

  return [
    {
      type: "function",
      function: {
        name: "fetch_external_data",
        description: usageRuleText
          ? `Fetch data from the external API to answer user questions about products, pricing, availability, or other live information. You MUST follow these API usage rules exactly and NEVER request data that breaks them: ${usageRuleText}`
          : "Fetch data from the external API to answer user questions about products, pricing, availability, or other live information",
        parameters: {
          type: "object",
          properties: {
            endpoint: {
              type: "string",
              description: "The API endpoint to fetch data from. Must be a full URL (https://...) or a relative path (for example /search) that can be resolved against the configured API base endpoint. Never pass plain keywords like 'banana' as endpoint."
            },
            queryParams: {
              type: "object",
              description: usageRuleText
                ? `An object containing query parameters to send to the API (e.g., {\"q\": \"search term\"}, {\"category\": \"electronics\"}, {\"product\": \"laptop\"}). Choose parameter names based on the API usage rules. MUST comply with these rules: ${usageRuleText}`
                : "An object containing query parameters to send to the API. Choose appropriate parameter names based on what the user is asking for.",
              additionalProperties: true
            }
          },
          required: ["endpoint", "queryParams"]
        }
      }
    }
  ];
}

export const freeStyleWebsiteBotPrompt = ({
  botName,
  botType,
  tone,
  verbosity,
  websiteType,
  channel = "website",
  description,
  ownerInformation,
  AdditionalInformation,
  examples,
  apiIntegration,
  apiEndpoint,
  apiResponseFormat,
  apiUsageRule
}: FreeStyleBotPromptParams): string => {
  const isTelegram = channel === "telegram";
  const platformText = isTelegram ? "Telegram chat" : `${websiteType} website`;
  const scopeText = isTelegram
    ? "Only answer questions related to this Telegram bot and its configured business context. Politely refuse unrelated requests."
    : "Only answer questions related to the website. Politely refuse unrelated requests.";
  const formatRules = isTelegram
    ? "FORMAT: Telegram-safe plain text only. Do NOT use Markdown, MarkdownV2, HTML tags, code fences, tables, or special formatting syntax. Keep output clean, readable, and concise for chat."
    : "FORMAT: Website chat plain text. Keep responses clean and easy to read. Avoid special formatting that depends on client-side rendering.";

  return `You are ${botName}, a ${botType} AI assistant for ${platformText}. Communicate with a ${tone} tone and ${verbosity} responses.

PLATFORM: You are currently responding in ${platformText}.

ROLE: Answer user questions about the website accurately and professionally. Do not fabricate information.

CONTEXT:
${description}

ABOUT THE BUSINESS:
Owner: ${ownerInformation}
Additional: ${AdditionalInformation}

SCOPE: ${scopeText}

${examples ? `EXAMPLES:\n${examples}\n` : ''}
${apiIntegration ? `LIVE DATA ACCESS:
You can request live data for product info, pricing, availability, or filtered results. Wait for tool results before responding.
${apiEndpoint ? `Configured API base endpoint: ${apiEndpoint}
When calling the tool, use either this full endpoint or a valid route/path that can be resolved against it. Do not send plain words as endpoint values.
` : ''}
${apiUsageRule ? `RULES: ${apiUsageRule}` : ''}
API ERROR: If data unavailable, respond: "Sorry, I'm having trouble accessing that information right now. Please try again later or contact support."
` : ''}
${formatRules}
RULES: Respond in plain text. Don't mention AI, tools, or system details. If unsure, ask for clarification or politely decline.
DO NOT HALLUCINATE INFORMATION OR MAKE UP ANSWERS.`;
};


export const fetchData = async (url: string) => {
  let validatedUrl = '';
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Only http/https URLs are allowed');
    }
    validatedUrl = parsed.toString();
  } catch (error) {
    throw {
      type: 'API_ERROR',
      message: 'Invalid external API URL generated by tool call'
    };
  }

  const res = await fetch(validatedUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw {
      type: 'API_ERROR',
      message: data?.message || 'Error while fetching data from external source'
    };
  }
  const sanitizedData = sanitizeAPIResponse(data, 2);

  return sanitizedData.samples;
};
