import mongoose, { Schema } from "mongoose"
import type { BotStructureType } from "../utils/types/botStructure.js"

const botStructureSchema = new Schema<BotStructureType>({
    userId: {
        type: String,
        required: true,
    },
    botName: {
        type: String,
        required: true,
    },
    botDescription: {
        type: String,
        required: false,
    },
    botAvatar: {
        type: String,
        required: false,
    },
    platform: {
        type: [String],
        enum: ['WhatsApp', 'Telegram', 'Facebook', 'Instagram', 'API'],
        required: true,
    },
    purpose: {
        type: String,
        required: true,
    },
    intelligenceSource: {
        type: String,
        enum: ['AI', "DB", "API", "Hybrid"],
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'paused', 'draft', 'deleted'],
        required: true,
    },
    created_at: {
        type: Date,
        default: Date.now,
    },
    updated_at: {
        type: Date,
        default: Date.now,
    },
    deleted_at : {
        type : Date,
        default : null
    }
},
);

export const BotStructureModel = mongoose.model<BotStructureType>('BotStructure', botStructureSchema);