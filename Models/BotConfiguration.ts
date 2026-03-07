import mongoose, { Mongoose, Schema } from "mongoose";

const botConfigurationSchema = new Schema({
    botId : {
        type : mongoose.Schema.Types.ObjectId,
        ref : 'BotStructure',
        required : true,
        index : true,
    },
    userId :{
        type : String,
        required : true
    },
    version : {
        type : String,
        required : true,
        default : 'v1.0'
    },
    config  : {
        type : mongoose.Schema.Types.Mixed,
        required : true, 
    },
    configStatus : {
        type : String,
        enum : ['setup', 'config'],
        default : 'setup',
    }, 
    // Telegram specific fields (optional)
    botToken: {
        type: String,
        required: false,
    },
    webhookUrl: {
        type: String,
        required: false,
    },
    webhookRegistered: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps : true
});

const botConfiguration = mongoose.model('BotConfigration', botConfigurationSchema);

export {botConfiguration};