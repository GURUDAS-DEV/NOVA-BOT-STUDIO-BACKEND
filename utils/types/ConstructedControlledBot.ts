import type mongoose from "mongoose";

export interface constructedControlledBot{
    _id : mongoose.Types.ObjectId;
    name : string;
    platform : string;
    userId : string;
    node : constructedEachBotNode[];
};

export interface constructedEachBotNode{
    executor : "none" | "api" | "input" | "end";
    title : string;
    message : string;
    apiConfig : constructedBotApiConfig | null;
    output : outputConstructedBot | null;
    options : options[] | null;
}

export interface constructedBotApiConfig{
    endpointKey : string | null;
    method : "GET" | "POST" | null | undefined;
    nextNodeId : string;
    timeoutMs : number | null ;
    queryParameter ?: Map<string, string> | undefined;
}

export interface outputConstructedBot{
    mode : string;
    optionCount : number;
}

export interface options{
    intent : string;
    toNodeId : string;
    order : number;
    _id : mongoose.Types.ObjectId;
    botId : mongoose.Types.ObjectId;
    
}