import mongoose, { Mongoose, Schema } from "mongoose";
import type { botAnalyticsStructure } from "../utils/types/BotAnalytics.js";


const botAnalyticsSchema = new Schema<botAnalyticsStructure>({
    botId : {
        type : mongoose.Schema.Types.ObjectId,
        required : true,
        ref : "BotStructure"
    },
    apiHashKey : {
        type : String,
        required : true,
    },
    timestamp : {
        type : Date,
        default : Date.now,
    },
    eventType : {
        type : String,
        enum : ["request", "error", "timeout", 'limitHit'],
        required : true,
    },
    usage : {
        model : {
            type : String,
            required : true,
        },
        tokenIn : {
            type : Number,
            required : true,
        },
        tokenOut : {
            type : Number,
            required : true,
        },
        totalToken : {
            type : Number   ,
            required : true,
        },
    },
    performance : {
        latency : {
            type : Number,
            required : true,
        }
    },
    context : {
        plan : {
            type : String,
            enum : ["free", "pro"],
            required : true,
        },
        region : {
            type : String,
            required : true,
        }
    }
});

export const BotAnalyticsModel = mongoose.model<botAnalyticsStructure>("BotAnalytics", botAnalyticsSchema);