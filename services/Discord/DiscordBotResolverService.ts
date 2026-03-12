import { BotStructureModel } from "../../Models/BotStructure.js";
import { botConfiguration } from "../../Models/BotConfiguration.js";
import { getRedisClient } from "../../Redis/connect.js";

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
 *   2. Query MongoDB for a Freestyle bot on the Discord platform
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
            console.log(`[Discord] Bot resolved from cache for guild ${guildId}: ${parsed.botId}`);
            return parsed as ResolvedDiscordBot;
        }

        // ─── 2. Query database for a Discord freestyle bot ───
        // Find an active freestyle bot configured for Discord platform
        const botRecord = await BotStructureModel.findOne({
            platform: "Discord",
            style: "free-style",
        });

        if (!botRecord) {
            console.warn(`[Discord] No Freestyle bot found for guild ${guildId}`);
            return null;
        }

        const botId = botRecord._id.toString();

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

        // ─── 3. Cache result ───
        await redis.set(redisKey, JSON.stringify(resolved), { ex: 1800 });
        console.log(`[Discord] Bot resolved from DB for guild ${guildId}: ${botId}`);

        return resolved;
    } catch (error) {
        console.error(`[Discord] Error resolving bot for guild ${guildId}:`, error);
        return null;
    }
};
