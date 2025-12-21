import type { Request, Response } from "express";

export const setConfigController = async(req : Request, res: Response) : Promise<Response> =>{
    try{
        const {botType, websiteType, tone, verbosity, behaviorDescription, allowedTopics, disallowedTopics, examples, apiEndpoint, responseFormat} = req.body;

        if(!botType || !websiteType || !tone || !verbosity || !behaviorDescription || !examples || !apiEndpoint || !!responseFormat){
            return res.status(404).json({message : "Required All fields in a proper manner!"});
        };

        

        return res.status(200).json({message: "Config set successfully"});
    }
    catch{
        return res.status(500).json({message : "Internal Server Error!"});
    }
}