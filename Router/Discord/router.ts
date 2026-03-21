import { Router } from "express";
import { connectDiscordGuildController } from "../../controller/Discord/controller.js";
import { authMiddleware } from "../../Middleware/authMiddleware.js";

/**
 * Discord Router
 *
 * Discord primarily uses WebSocket (Gateway) events for interactions,
 * so slash commands are handled by the discord.js client directly.
 *
 * This router is maintained for structural consistency with other
 * platform adapters (Telegram, Website) and can be extended later
 * for Discord-specific HTTP endpoints (e.g., OAuth callbacks,
 * configuration endpoints, webhook verification).
 */
const DiscordRouter = Router();

DiscordRouter.post("/connectGuild", authMiddleware, connectDiscordGuildController);

export default DiscordRouter;
