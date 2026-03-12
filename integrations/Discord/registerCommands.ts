import { REST, Routes, SlashCommandBuilder } from "discord.js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Register Discord slash commands globally.
 *
 * Run this script once (or whenever commands change) to register
 * the /ask command with Discord's API:
 *
 *   npx tsx integrations/Discord/registerCommands.ts
 */

const commands = [
    new SlashCommandBuilder()
        .setName("ask")
        .setDescription("Ask the Nova bot a question")
        .addStringOption((option) =>
            option
                .setName("question")
                .setDescription("The question you want to ask")
                .setRequired(true)
        ),
].map((command) => command.toJSON());

const registerCommands = async (): Promise<void> => {
    const token = process.env.DISCORD_BOT_TOKEN;
    const clientId = process.env.DISCORD_APPLICATION_ID;

    if (!token || !clientId) {
        console.error("[Discord] Missing DISCORD_BOT_TOKEN or DISCORD_APPLICATION_ID in .env");
        process.exit(1);
    }

    const rest = new REST({ version: "10" }).setToken(token);

    try {
        console.log("[Discord] Registering slash commands...");

        await rest.put(Routes.applicationCommands(clientId), {
            body: commands,
        });

        console.log("[Discord] Slash commands registered successfully!");
    } catch (error) {
        console.error("[Discord] Failed to register slash commands:", error);
        process.exit(1);
    }
};

registerCommands();
