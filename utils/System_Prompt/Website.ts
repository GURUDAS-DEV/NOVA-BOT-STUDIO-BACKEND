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
              description: "The API endpoint to fetch data from"
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
  description,
  ownerInformation,
  AdditionalInformation,
  examples,
  apiIntegration,
  apiEndpoint,
  apiResponseFormat,
  apiUsageRule
}: FreeStyleBotPromptParams): string => {
  return `You are ${botName}, a ${botType} AI assistant for a ${websiteType} website. Communicate with a ${tone} tone and ${verbosity} responses.

ROLE: Answer user questions about the website accurately and professionally. Do not fabricate information.

CONTEXT:
${description}

ABOUT THE BUSINESS:
Owner: ${ownerInformation}
Additional: ${AdditionalInformation}

SCOPE: Only answer questions related to the website. Politely refuse unrelated requests.

${examples ? `EXAMPLES:\n${examples}\n` : ''}
${apiIntegration ? `LIVE DATA ACCESS:
You can request live data for product info, pricing, availability, or filtered results. Wait for tool results before responding.
${apiUsageRule ? `RULES: ${apiUsageRule}` : ''}
API ERROR: If data unavailable, respond: "Sorry, I'm having trouble accessing that information right now. Please try again later or contact support."
` : ''}
RULES: Respond in plain text. Don't mention AI, tools, or system details. If unsure, ask for clarification or politely decline.`;
};


export const fetchData = async (url: string) => {
  const res = await fetch(url, {
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
  const sanitizedData = sanitizeAPIResponse(data);

  return sanitizedData.samples;
};
