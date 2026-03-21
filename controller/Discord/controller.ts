import type { Request, Response } from "express";
import { BotStructureModel } from "../../Models/BotStructure.js";
import { DiscordGuildBindingModel } from "../../Models/DiscordGuildBinding.js";
import { getDiscordClient } from "../../integrations/Discord/discordClient.js";
import { getRedisClient } from "../../Redis/connect.js";

const redis = getRedisClient();

const isValidDiscordSnowflake = (value: string): boolean => /^\d{16,22}$/.test(value.trim());

export const connectDiscordGuildController = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { botId, guildId } = req.body;
        const userId = (req as any).user?.userId;

        if (!userId || !botId || !guildId) {
            return res.status(400).json({ message: "botId, guildId, and user authentication are required." });
        }

        const normalizedGuildId = String(guildId).trim();
        if (!isValidDiscordSnowflake(normalizedGuildId)) {
            return res.status(400).json({ message: "Invalid Discord server ID format." });
        }

        const bot = await BotStructureModel.findById(botId);
        if (!bot) {
            return res.status(404).json({ message: "Bot not found." });
        }

        if (bot.userId !== userId) {
            return res.status(403).json({ message: "Unauthorized access to this bot." });
        }

        if (bot.platform !== "Discord" || bot.style !== "FREESTYLE") {
            return res.status(400).json({ message: "Only Discord Freestyle bots can be linked to Discord servers." });
        }

        const client = getDiscordClient();
        if (!client) {
            return res.status(500).json({ message: "Discord client is not initialized." });
        }

        try {
            await client.guilds.fetch(normalizedGuildId);
        } catch {
            return res.status(400).json({
                message: "Bot is not in this Discord server yet. Invite the bot first, then try linking again.",
            });
        }

        const existingGuildBinding = await DiscordGuildBindingModel.findOne({ guildId: normalizedGuildId });
        if (existingGuildBinding && String(existingGuildBinding.userId) !== String(userId)) {
            return res.status(409).json({
                message: "This Discord server is already linked to another account's bot.",
            });
        }

        const linked = await DiscordGuildBindingModel.findOneAndUpdate(
            { guildId: normalizedGuildId },
            {
                guildId: normalizedGuildId,
                botId,
                userId,
                linkedAt: new Date(),
            },
            { new: true, upsert: true }
        );

        const redisKey = `DiscordGuildBot:${normalizedGuildId}`;
        await redis.del(redisKey);

        return res.status(200).json({
            message: "Discord server linked successfully.",
            guildId: normalizedGuildId,
            botId: String(linked.botId),
        });
    } catch (error) {
        console.error("[Discord] Error linking guild to bot:", error);
        return res.status(500).json({ message: "Internal Server Error", error: (error as Error).message });
    }
};