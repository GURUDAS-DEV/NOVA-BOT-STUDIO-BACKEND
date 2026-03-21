import { Client, GatewayIntentBits, Events } from "discord.js";
import dotenv from "dotenv";
import { handleDiscordInteraction } from "../../controller/Discord/DiscordInteractionController.js";

dotenv.config();

let discordClient: Client | null = null;
let discordClientId: string | null = null;

/**
 * Initialize and start the Discord bot client.
 * Connects using the DISCORD_BOT_TOKEN environment variable.
 * Listens for guildCreate (server join) and interactionCreate events.
 */
export const startDiscordClient = async (): Promise<void> => {
    const token = process.env.DISCORD_BOT_TOKEN;

    if (!token) {
        console.warn("[Discord] DISCORD_BOT_TOKEN is not set. Discord integration is disabled.");
        return;
    }

    try {
        discordClient = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
            ],
        });

        // ─── Ready Event ───
        discordClient.once(Events.ClientReady, (readyClient) => {
            console.log(`[Discord] Bot connected: ${readyClient.user.tag}`);
            discordClientId = readyClient.user.id;
            console.log(`[Discord] Bot CLIENT_ID: ${discordClientId}`);
        });

        // ─── Guild Join Event ───
        discordClient.on(Events.GuildCreate, (guild) => {
            console.log(`[Discord] Bot joined server: ${guild.name} (${guild.id})`);
        });

        // ─── Interaction Event (slash commands) ───
        discordClient.on(Events.InteractionCreate, async (interaction) => {
            try {
                await handleDiscordInteraction(interaction);
            } catch (error) {
                console.error("[Discord] Unhandled error in interaction handler:", error);

                // Attempt to send error response if interaction is repliable
                try {
                    if (interaction.isRepliable()) {
                        if (interaction.replied || interaction.deferred) {
                            await interaction.followUp({
                                content: "Something went wrong while processing your request.",
                                ephemeral: true,
                            });
                        } else {
                            await interaction.reply({
                                content: "Something went wrong while processing your request.",
                                ephemeral: true,
                            });
                        }
                    }
                } catch {
                    // Silently ignore if we can't even send the error reply
                }
            }
        });

        await discordClient.login(token);
    } catch (error) {
        console.error("[Discord] Failed to start Discord client:", error);
    }
};

/**
 * Returns the current Discord client instance, or null if not initialized.
 */
export const getDiscordClient = (): Client | null => {
    return discordClient;
};

/**
 * Returns the Discord bot's CLIENT_ID (application ID), or null if not initialized.
 */
export const getDiscordClientId = (): string | null => {
    return discordClientId;
};
