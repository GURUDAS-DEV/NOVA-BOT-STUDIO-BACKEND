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
    style : {
        type : String,
        enum : ['free-style', 'controlled-style'],
        required : true,
        default : 'free-style',
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
}, {
    timestamps : true
});

const botConfiguration = mongoose.model('BotConfigration', botConfigurationSchema);

export {botConfiguration};