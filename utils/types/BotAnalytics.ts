import type mongoose from "mongoose";


export interface botAnalyticsStructure extends mongoose.Document{
    botId : mongoose.Schema.Types.ObjectId;
    apiHashKey : string;
    timestamp : Date;
    eventType : "request" | "error" | "timeout" | 'limitHit';
    usage : {
        model : string;
        tokenIn : number;
        tokenOut : number;
        totalToken : number;
    };
    performance : {
        latency : number;
    };
    context : {
        plan : "free" | "pro";
        region : string;
    }
};