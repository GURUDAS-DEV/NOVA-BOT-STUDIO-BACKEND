import mongoose from "mongoose";

export interface BotStructureType extends mongoose.Document {
    userId : string;
    botName : string;
    botDescription : string | null;
    botAvatar : string | null;
    platform : 'WhatsApp' | 'Telegram' | 'Discord' | 'Instagram' | 'Website';
    style : string;
    currentState : 'setup' | 'configure';
    status : 'active' | 'inactive' | 'paused' | 'draft' | 'deleted';
    created_at ?: Date;
    updated_at ?: Date;
    deleted_at  ?: Date | null;
}