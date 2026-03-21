import { BotStructureModel } from "../../Models/BotStructure.js";
import { botConfiguration } from "../../Models/BotConfiguration.js";
import { getRedisClient } from "../../Redis/connect.js";
import { DiscordGuildBindingModel } from "../../Models/DiscordGuildBinding.js";

const redis = getRedisClient();

export interface ResolvedDiscordBot {
    botId: string;
    botName: string;
    status: string;
    scrapeStatus: string;
    config: Record<string, any>;
}

/**
 * Resolve which Nova Freestyle bot should respond for a given Discord guild.
 *
 * Resolution strategy:
 *   1. Check Redis cache first (`DiscordGuildBot:{guildId}`)
 *   2. Resolve guild -> bot mapping from persistent DiscordGuildBinding
 *   3. Load the mapped Freestyle bot + configuration
 *   3. Cache the result for 30 minutes
 *
 * Returns null if no matching bot is found.
 */
export const resolveBotFromGuild = async (guildId: string): Promise<ResolvedDiscordBot | null> => {
    try {
        // ─── 1. Check Redis cache ───
        const redisKey = `DiscordGuildBot:${guildId}`;
        const cached = await redis.get(redisKey);

        if (cached) {
            const parsed = typeof cached === "string" ? JSON.parse(cached) : cached;
            if (!parsed?.source || parsed.source !== "guild-binding") {
                await redis.del(redisKey);
            } else {
            console.log(`[Discord] Bot resolved from cache for guild ${guildId}: ${parsed.botId}`);
            return parsed as ResolvedDiscordBot;
            }
        }

        // ─── 2. Resolve guild mapping ───
        const guildBinding = await DiscordGuildBindingModel.findOne({ guildId });

        if (!guildBinding) {
            console.warn(`[Discord] No bot mapping found for guild ${guildId}`);
            return null;
        }

        // ─── 3. Load mapped bot ───
        const botRecord = await BotStructureModel.findOne({
            _id: guildBinding.botId,
            platform: "Discord",
            style: "FREESTYLE",
            status: { $ne: "deleted" },
        });

        if (!botRecord) {
            console.warn(`[Discord] No Freestyle bot found for guild ${guildId}`);
            return null;
        }

        const botId = String(botRecord._id);

        // Fetch bot configuration
        const configRecord = await botConfiguration.findOne({ botId });

        if (!configRecord) {
            console.warn(`[Discord] Bot configuration not found for botId ${botId}`);
            return null;
        }

        const resolved: ResolvedDiscordBot = {
            botId,
            botName: botRecord.botName || "NovaBot",
            status: botRecord.status,
            scrapeStatus: (botRecord as any).scrapeStatus || "notOpted",
            config: configRecord.config || {},
        };

        // ─── 4. Cache result ───
        await redis.set(redisKey, JSON.stringify({ ...resolved, source: "guild-binding" }), { ex: 1800 });
        console.log(`[Discord] Bot resolved from DB for guild ${guildId}: ${botId}`);

        return resolved;
    } catch (error) {
        console.error(`[Discord] Error resolving bot for guild ${guildId}:`, error);
        return null;
    }
};
