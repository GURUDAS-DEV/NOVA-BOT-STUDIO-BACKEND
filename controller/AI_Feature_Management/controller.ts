import type { Request, Response } from "express";
import { OpenAI } from "openai";
import { systemPromptTextEnhancer } from "../../utils/System_Prompt/TextEnhancer.js";
import { textValidatorPrompt } from "../../utils/System_Prompt/TextValidator.js";
import { exampleValidatorPrompt } from "../../utils/System_Prompt/ExampleValidator.js";

export const EnhanceTextController = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { text } = req.body;
        if (!text || typeof text !== "string") {
            return res.status(400).json({ error: "Invalid input text" });
        }


        const openai = new OpenAI({
            apiKey: process.env.GOOGLE_API_KEY,
            baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
        });

        const response = await openai.chat.completions.create({
            model: "gemma-3-27b-it",
            messages: [
                {
                    role: "user",
                    content: `INSTRUCTIONS: ${systemPromptTextEnhancer}\n\nTEXT TO ENHANCE: ${text}`,
                },
            ],
        });
        console.log("OpenAI response:", response);

        if (!response || !response.choices || response.choices.length === 0)
            return res.status(500).json({ error: "Failed to get response from OpenAI" });

        const message = response.choices[0] ? response.choices[0].message : null;
        if (!message || !message.content)
            return res.status(500).json({ error: "Failed to get content from response" });

        return res.status(200).json({
            enhancedText: message.content,
        });
    }
    catch (error) {
        console.error("Error in EnhanceTextController:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

export const ValidateTextController = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { text, botType } = req.body;
        if (!text || !botType) {
            return res.status(400).json({ error: "Invalid input text" });
        }
        const openai = new OpenAI({
            apiKey: process.env.TEXT_ENHANCER_API_KEY,
            baseURL: "https://api.groq.com/openai/v1"
        });

        const response = await openai.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: textValidatorPrompt },
                {
                    role: "user",
                    content: `botType: ${botType}\nText: ${text}`,
                },
            ],

        });

        if (!response || !response.choices || response.choices.length === 0)
            return res.status(500).json({ error: "Failed to get response from OpenAI" });

        const message = response.choices[0] ? response.choices[0].message : null;
        if (!message || !message.content)
            return res.status(500).json({ error: "Failed to get content from response" });

        return res.status(200).json({
            validationResult: message.content,
        });
    }
    catch (error) {
        console.error("Error in ValidateTextController:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
}

export const ValidateExampleController = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { examples, botType } = req.body;
        if (!examples || !botType) {
            return res.status(400).json({ error: "Invalid input text" });
        }
        const openai = new OpenAI({
            apiKey: process.env.TEXT_ENHANCER_API_KEY,
            baseURL: "https://api.groq.com/openai/v1"
        });

        const response = await openai.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                { role: "system", content: exampleValidatorPrompt },
                {
                    role: "user",
                    content: `botType: ${botType}\nExamples: ${examples}`,
                },
            ],

        });

        if (!response || !response.choices || response.choices.length === 0)
            return res.status(500).json({ error: "Failed to get response from OpenAI" });

        const message = response.choices[0] ? response.choices[0].message : null;
        if (!message || !message.content)
            return res.status(500).json({ error: "Failed to get content from response" });


        return res.status(200).json({ message: message.content });
    }
    catch (error) {
        console.error("Error in ValidateExampleController:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }

}