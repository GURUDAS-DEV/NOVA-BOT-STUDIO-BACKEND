import mongoose, { Schema } from "mongoose";

const discordGuildBindingSchema = new Schema(
    {
        guildId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        botId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "BotStructure",
            required: true,
            index: true,
        },
        userId: {
            type: String,
            required: true,
            index: true,
        },
        linkedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

const DiscordGuildBindingModel = mongoose.model("DiscordGuildBinding", discordGuildBindingSchema);

export { DiscordGuildBindingModel };