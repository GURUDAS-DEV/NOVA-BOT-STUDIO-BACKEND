import type { Request, Response } from "express";
import { BotStructureModel } from "../../Models/BotStructure.js";

export const validateBotTokenController = async (req : Request, res : Response): Promise<Response> => {

    try{
        const { botToken } = req.params;
        if(!botToken){
            return res.status(400).json({ message : "Bot token is required."});
        }

        const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
        const data = await response.json();

        if(response.status !== 200 || !data.ok){
            return res.status(400).json({ message : "Invalid Telegram bot token.", data : data });
        }

        return res.status(200).json({ message : "Bot token is valid."});
    }
    catch(error){
        return res.status(500).json({ message : "An error occurred while validating the bot token.", error : (error as Error).message });
    }
}

export const SaveTelegramBotController = async(req : Request, res : Response) : Promise<Response> =>{
    try{
        const { userId, botName, botDescription, botAvatar, style, botToken } = req.body;

        if (!userId || !botName || !style || !botToken) {
            return res.status(400).json({ message: "Required fields are missing." });
        }

        // Validate token with Telegram
        const validateRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
        const validateData = await validateRes.json();
        if (validateRes.status !== 200 || !validateData.ok) {
            return res.status(400).json({ message: "Invalid Telegram bot token.", data: validateData });
        }

        // Create bot entry in DB
        const createdBot = await BotStructureModel.create({
            userId,
            botName,
            botDescription,
            botAvatar,
            platform: "Telegram",
            style,
            status: "inactive",
            currentState: "configure",
            botToken,
        });

        if (!createdBot) {
            return res.status(400).json({ message: "Failed to create bot" });
        }

        // Build webhook URL. Prefer explicit env var, fall back to request host.
        const baseUrl = process.env.TELEGRAM_WEBHOOK_BASE_URL || process.env.BASE_URL || `${req.protocol}://${req.get("host")}`;
        const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/telegram/webhook/${createdBot._id}`;

        // Register webhook with Telegram
        const hookRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: webhookUrl }),
        });
        const hookData = await hookRes.json();

        if (hookRes.status !== 200 || !hookData.ok) {
            // Save bot without webhook registered
            await createdBot.save();
            return res.status(400).json({ message: "Failed to register webhook.", data: hookData });
        }

        // Update bot with webhook info and mark as active
        createdBot.webhookUrl = webhookUrl;
        createdBot.webhookRegistered = true;
        createdBot.status = "inactive"; // Start as inactive until user activates it
        await createdBot.save();

        return res.status(200).json({ message: "Telegram bot saved and webhook registered.", id: createdBot._id, telegram: hookData });
    }
    catch(error){   
        return res.status(500).json({ message : "An error occurred while saving the Telegram bot.", error : (error as Error).message });
    }   
}