import type { Request, Response } from "express";
import { BotStructureModel } from "../../Models/BotStructure.js";
import { transistionBotLifecycle } from "../../utils/helper/botLifecycle.js";
import { botConfiguration } from "../../Models/BotConfiguration.js";
import { supabase } from "../../Database/postgresql.js";
import mongoose from "mongoose";
import { ControlledBotModel } from "../../Models/ControlledBotSchema.js";
import { ControlledBotNodeModel } from "../../Models/ControlledBotNodes.js";
import { ControlledBotEdgeModel } from "../../Models/ControlledBotEdges.js";


//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//----------------------------------------------Create bot controller---------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//

export const createBotController = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { userId, botName, botDescription, botAvatar, platform, style} = req.body;

        if(!userId || !botName || !platform || !style){
            return res.status(400).json({ message: "Required fields are missing" });
        }

        const createdBot = await BotStructureModel.create({
            userId,
            botName,
            botDescription,
            botAvatar,
            platform,
            style,
            status: "draft",
        })
        if (!createdBot) {
            return res.status(400).json({ message: "Failed to create bot" });
        }


        return res.status(200).json({ message: "Bot created successfully", id : createdBot._id });
    }
    catch (error) {
        return res.status(500).json({ message: "Internal Server Error", error });
    }
};


//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------Get Bot Details for Home Page-------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//

export const getBotDetailsForHomePageController = async (req: Request, res: Response): Promise<Response> => {
    try {
        const userId = (req as any).user?.userId;
        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        const bots = await BotStructureModel.find({ userId }).sort({ created_at: -1 }).where({ status: { $ne: "deleted" } });
        if (!bots) {
            return res.status(404).json({ message: "No bots found for this user" });
        }

        let noOfBots = bots.length;
        let noOfActiveBots = bots.filter((bot) => bot.status === "active").length;
        const recentBots = bots.slice(0, 4);

        return res.status(200).json({ message: "BOT LISTS FOR HOMEPAGE", noOfActiveBots, noOfBots, recentBots });
    }
    catch (e) {
        return res.status(500).json({ message: "Internal Server Error", e });
    }

}

//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//-------------------------------------------Get All Bots for Manage Page------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//

export const getAllBotsForManagePageController = async (req: Request, res: Response): Promise<Response> => {
    try {
        const userId = (req as any).user?.userId;
        let { cursor } = req.query as { cursor: string };

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        if (cursor === "null" || cursor === "undefined") {
            cursor = new Date().toISOString();
        }

        const limit = 10;
        const query: any = { userId };

        if (cursor) {
            query.created_at = { $lt: new Date(cursor as string) };
        }

        const bots = await BotStructureModel.find(query)
            .where({ status: { $ne: "deleted" } })
            .sort({ created_at: -1 })
            .limit(limit + 1);

        if (!bots || bots.length === 0) {
            return res.status(404).json({ message: "No bots found for this user" });
        }

        const hasMore = bots.length > limit;
        if (hasMore)
            bots.pop();

        const nextCursor = bots.length > 0 ? bots[bots.length - 1]?.created_at : null;
        const totalBots = await BotStructureModel.countDocuments({ userId }).where({ status: { $ne: "deleted" } });

        return res.status(200).json({ message: "Bots Details!!!", cursor: nextCursor, bots, hasMore, totalBots });
    }
    catch (e) {
        console.log(e);
        return res.status(500).json({ message: "Internal Server Error", e });
    }
}


//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//----------------------------------------------Delete Bot Controller----------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//



export const deleteBotController = async (req: Request, res: Response): Promise<Response> => {
    try {
        const userId = (req as any).user?.userId;
        const { botId } = req.body;
        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        const bot = await BotStructureModel.findById(botId);
        if (!bot) {
            return res.status(404).json({ message: "Bot not found" });
        }

        if (bot.userId !== userId) {
            return res.status(403).json({ message: "Forbidden: You don't have permission to delete this bot" });
        }
        
        const stringBotId = bot._id.toString();
        console.log("Revoking API Key for botId:", stringBotId);
        
        // Update API key - use exact column names as defined in schema with double quotes
        const {data, error} = await supabase
            .from("API_KEY")
            .update({ 
                isRevoked: true,
                Revoked_at: new Date().toISOString()
            })
            .eq("botId", stringBotId)
            .select();

        if(error){
            console.error("Error revoking API key:", error);
            return res.status(500).json({ message : "Error revoking API key.", error : error.message });
        }
        
        bot.status = transistionBotLifecycle(bot.status as any, "deleted");
        bot.deleted_at = new Date();
        await bot.save();

        return res.status(200).json({ message: "Bot Deleted Successfully" });
    }
    catch (e) {
        return res.status(500).json({ message: "Internal Server Error", e });
    }
}

//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//------------------------------------Get Deleted Bot Controllers(recycle bin)------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//

export const getDeletedBotsController = async (req: Request, res: Response): Promise<Response> => {

    try {
        const userId = (req as any).user?.userId;
        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        };

        const deletedBots = await BotStructureModel.find({ userId }).where({ status: "deleted" }).sort({ created_at: -1 });

        if (!deletedBots || deletedBots.length === 0) {
            return res.status(404).json({ message: "No deleted bots found" });
        }

        return res.status(200).json({ message: "Deleted Bots fetched successfully", deletedBots });
    }
    catch (e) {
        return res.status(500).json({ message: "Internal Server Error", e });
    }
}

//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------Restore Deleted Bot Controller------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//

export const restoreDeletedBotController = async (req: Request, res: Response): Promise<Response> => {
    try {
        const userId = (req as any).user?.userId;
        const { botId } = req.body;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }
        if(!botId){
            return res.status(400).json({ message: "Bot ID is required" });
        }

        const bot = await BotStructureModel.findById(botId);
        if (!bot) {
            return res.status(404).json({ message: "Bot not found" });
        }

        if(bot.userId !== userId){
            return res.status(403).json({ message: "Forbidden: You don't have permission to restore this bot" });
        }

        const botConfig = await botConfiguration.findOne({ botId });
        if(!botConfig)
            bot.status = transistionBotLifecycle(bot.status as any, "draft");
        else
            bot.status = transistionBotLifecycle(bot.status as any, "inactive");

        bot.deleted_at = null;
        await bot.save();

        return res.status(200).json({ message: "Bot Restored Successfully" });
    }
    catch (e) {
        console.log(e);
        return res.status(500).json({ message: "Internal Server Error", e });
    }
}

//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------Permanently Delete Bot Controller--------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//

export const permanentlyDeleteBotController = async (req: Request, res: Response): Promise<Response> => {
    try{
        const userId = (req as any).user?.userId;
        const { botId } = req.body;

        if(!userId || !botId){
            return res.status(400).json({ message: "User ID and bot ID bot are required! But not provided" });
        }

        const bot = await BotStructureModel.findByIdAndDelete(botId);
        if(!bot){
            return res.status(404).json({ message: "Bot not found" });
        }
        return res.status(200).json({ message: "Bot Permanently Deleted Successfully", bot });
    }
    catch(e){
        return res.status(500).json({ message: "Internal Server Error", e });
    }

}

export const getOneBotDetailsController = async (req: Request, res: Response): Promise<Response> => {
    try{
        const userId = (req as any).user?.userId;
        const { botId } = req.params;

        if(!userId || !botId){
            return res.status(400).json({ message: "User ID and bot ID bot are required! But not provided" });
        }

        const bot = await BotStructureModel.findById(botId);
        if(!bot){
            return res.status(404).json({ message: "Bot not found! It might happen that it was deleted or the ID is incorrect." });
        }

        const botConfig = await botConfiguration.findOne({ botId });
        if(!botConfig){
            return res.status(200).json({ message: "Single Bot Details", bot });
        }

        if(botConfig.configStatus !== 'setup'){
            return res.status(405).json({ message : "Bot setup process is already completed! You can configure it now only!", setUpCompleted : true });
        }

        return res.status(200).json({ message: "Single Bot Details", bot });
    }
    catch(e){
        return res.status(500).json({ message: "Internal Server Error", e });
    }

}


///-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//----------------------------------Creating website Controlled Style botDescription----------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//


export const createWebsiteControlledBotController = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Extract authenticated user ID
    const ownerId = (req as any).user?.userId;
    if (!ownerId) {
      await session.abortTransaction();
      return res.status(401).json({ message: "Unauthorized: User ID is required" });
    }

    // Validate request body structure
    const { bot, graph } = req.body;
    if (!bot || typeof bot !== "object") {
      await session.abortTransaction();
      return res.status(400).json({ message: "Bot metadata is required" });
    }

    if (!bot.name || typeof bot.name !== "string") {
      await session.abortTransaction();
      return res.status(400).json({ message: "Bot name is required and must be a string" });
    }

    if (!graph || typeof graph !== "object") {
      await session.abortTransaction();
      return res.status(400).json({ message: "Graph structure is required" });
    }

    if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: "At least one node is required" });
    }

    if (!Array.isArray(graph.edges)) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Edges array is required" });
    }

    // Validate entry node
    const entryNodeTempId = bot.entryNodeTempId || bot.entryNodeId || graph.nodes[0]?.id;
    if (!entryNodeTempId) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Entry node ID must be specified or first node will be used" });
    }

    const entryNodeExists = graph.nodes.some((n: any) => n.id === entryNodeTempId);
    if (!entryNodeExists) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Entry node ID does not exist in nodes array" });
    }

    // Step 1: Build tempId → MongoDB ObjectId mapping
    const tempIdToObjectId: Record<string, mongoose.Types.ObjectId> = {};
    graph.nodes.forEach((node: any) => {
      tempIdToObjectId[node.id] = new mongoose.Types.ObjectId();
    });

    // Step 2: Create Bot document first
    const entryNodeObjectId = tempIdToObjectId[entryNodeTempId];
    const controlledBot = new ControlledBotModel({
      name: bot.name,
      ownerId: new mongoose.Types.ObjectId(ownerId),
      type: "CONTROLLED",
      status: bot.status || "draft",
      entryNodeId: entryNodeObjectId,
    });

    const savedBot = await controlledBot.save({ session });
    const botId = savedBot._id;

    // Step 3: Transform nodes to database schema and insert
    const nodeDocuments = graph.nodes.map((node: any) => {
      const nodeDoc: any = {
        _id: tempIdToObjectId[node.id],
        botId,
        message: node.message || "",
        executor: "none",
        output: {
          mode: node.output?.type || "text",
          optionCount: node.options?.length || 0,
          allowGoBack: node.output?.controls?.allowGoBack ?? false,
          allowEnd: node.output?.controls?.allowEnd ?? false,
        },
      };

      // Map executor type based on node structure
      if (node.executor?.type === "input") {
        nodeDoc.executor = "input";
        nodeDoc.inputConfig = {
          key: node.input?.key,
          validationRegex: node.input?.validation,
          retryLimit: node.input?.retryLimit || 0,
          nextNodeId: node.inputNextNodeId ? tempIdToObjectId[node.inputNextNodeId] : undefined,
        };
      } else if (node.executor?.type === "api") {
        nodeDoc.executor = "api";
        nodeDoc.apiConfig = {
          endpointKey: node.executor?.config?.endpointKey,
          method: node.executor?.config?.method || "GET",
          timeoutMs: node.executor?.config?.timeoutMs || 5000,
          saveResponseAs: node.executor?.config?.saveResponseAs,
          useLLMSanitizer: node.executor?.config?.useLLMSanitizer || false,
        };
      } else if (node.executor?.type === "llm") {
        nodeDoc.executor = "llm";
      } else if (node.options && node.options.length === 0 && !node.executor) {
        nodeDoc.executor = "end";
      }

      return nodeDoc;
    });

    await ControlledBotNodeModel.insertMany(nodeDocuments, { session });

    // Step 4: Transform and insert edges (derived from node options and explicit edge array)
    const edgeSet = new Map<string, any>(); // Use Map to avoid duplicates

    // Process explicit edges from graph.edges
    if (graph.edges && graph.edges.length > 0) {
      graph.edges.forEach((edge: any, index: number) => {
        const fromNodeId = tempIdToObjectId[edge.fromTempNodeId];
        const toNodeId = tempIdToObjectId[edge.toTempNodeId];

        if (fromNodeId && toNodeId) {
          const key = `${fromNodeId}-${toNodeId}`;
          edgeSet.set(key, {
            botId,
            fromNodeId,
            toNodeId,
            intent: edge.intent || `Option ${index + 1}`,
            order: edge.order ?? index,
          });
        }
      });
    }

    // Also process options from nodes if they contain nextNodeId
    graph.nodes.forEach((node: any) => {
      if (node.options && Array.isArray(node.options)) {
        const fromNodeId = tempIdToObjectId[node.id];

        node.options.forEach((option: any, optionIndex: number) => {
          const nextNodeId = option.nextNodeId;
          if (nextNodeId && nextNodeId.trim() !== "") {
            const toNodeId = tempIdToObjectId[nextNodeId];

            if (fromNodeId && toNodeId) {
              const key = `${fromNodeId}-${toNodeId}`;
              // Only add if not already in set (explicit edges take precedence)
              if (!edgeSet.has(key)) {
                edgeSet.set(key, {
                  botId,
                  fromNodeId,
                  toNodeId,
                  intent: option.label || `Option: ${option.id}`,
                  order: optionIndex,
                });
              }
            }
          }
        });
      }
    });

    // Insert edges if any exist
    if (edgeSet.size > 0) {
      const edgeDocuments = Array.from(edgeSet.values());
      await ControlledBotEdgeModel.insertMany(edgeDocuments, { session });
    }

    // Step 5: Commit transaction
    await session.commitTransaction();

    return res.status(201).json({
      message: "Controlled bot created successfully",
      data: {
        botId: savedBot._id,
        name: savedBot.name,
        type: savedBot.type,
        status: savedBot.status,
        entryNodeId: savedBot.entryNodeId,
        nodesCreated: graph.nodes.length,
        edgesCreated: edgeSet.size,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error creating controlled bot:", error);

    return res.status(500).json({
      message: "Failed to create controlled bot",
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  } finally {
    await session.endSession();
  }
};
