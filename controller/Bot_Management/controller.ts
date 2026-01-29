import type { Request, Response } from "express";
import { BotStructureModel } from "../../Models/BotStructure.js";
import { transistionBotLifecycle } from "../../utils/helper/botLifecycle.js";
import { botConfiguration } from "../../Models/BotConfiguration.js";
import { supabase } from "../../Database/postgresql.js";
import mongoose from "mongoose";
import { ControlledBotModel } from "../../Models/ControlledBotSchema.js";
import { ControlledBotNodeModel } from "../../Models/ControlledBotNodes.js";
import { ControlledBotEdgeModel } from "../../Models/ControlledBotEdges.js";
import { platform } from "os";


//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//----------------------------------------------Create bot controller---------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//
//-----------------------------------------------------------------------------------------------------------------//

export const createBotController = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId, botName, botDescription, botAvatar, platform, style } = req.body;

    if (!userId || !botName || !platform || !style) {
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


    return res.status(200).json({ message: "Bot created successfully", id: createdBot._id });
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

    // Unified recent bots (latest 4 across controlled + freestyle)
    const freestyleColl = BotStructureModel.collection.name;
    const pipeline: any[] = [
      { $match: { userId, status: { $ne: "deleted" } } },
      {
        $project: {
          _id: 1,
          name: "$name",
          platform: "$platform",
          status: 1,
          style: { $literal: "CONTROLLED" },
          created_at: "$createdAt",
          updated_at: "$updatedAt",
          entryNodeId: "$entryNodeId",
        },
      },
      {
        $unionWith: {
          coll: freestyleColl,
          pipeline: [
            { $match: { userId: userId, status: { $ne: "deleted" } } },
            {
              $project: {
                _id: 1,
                name: "$botName",
                platform: "$platform",
                status: 1,
                style: { $literal: "FREESTYLE" },
                created_at: "$created_at",
                updated_at: "$updated_at",
                entryNodeId: { $literal: null },
              },
            },
          ],
        },
      },
      { $sort: { created_at: -1 } },
      { $limit: 4 },
    ];

    const recentBots = await ControlledBotModel.aggregate(pipeline);

    // Totals and active counts
    const [
      totalControlled,
      totalFreestyle,
      activeControlled,
      activeFreestyle,
    ] = await Promise.all([
      ControlledBotModel.countDocuments({ userId, status: { $ne: "deleted" } }),
      BotStructureModel.countDocuments({ userId: userId }).where({ status: { $ne: "deleted" } }),
      ControlledBotModel.countDocuments({ userId, status: "active" }),
      BotStructureModel.countDocuments({ userId: userId, status: "active" }),
    ]);

    const noOfBots = totalControlled + totalFreestyle;
    const noOfActiveBots = activeControlled + activeFreestyle;

    return res.status(200).json({
      message: "BOT LISTS FOR HOMEPAGE",
      noOfActiveBots,
      noOfBots,
      recentBots,
    });
  }
  catch (e) {
    return res.status(500).json({ message: "Internal Server Error", e });
  }

}
//---------------------------------------------------------------------------------------------------------------//
//---------------------------------------------------------------------------------------------------------------//
//------------------------------------Get Unified Bots for Manage Page------------------------------------------//
//---------------------------------------------------------------------------------------------------------------//
//---------------------------------------------------------------------------------------------------------------//

export const getUnifiedBotsForManagePageController = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = (req as any).user?.userId;
    let { cursor } = req.query as { cursor?: string };

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    if (cursor === "null" || cursor === "undefined") {
      cursor = new Date().toISOString();
    }

    const limit = 10;

    // Collection names for union
    const controlledColl = ControlledBotModel.collection.name;
    const freestyleColl = BotStructureModel.collection.name;

    const pipeline: any[] = [
      // Controlled bots for this owner (exclude deleted)
      { $match: { userId, status: { $ne: "deleted" } } },
      {
        $project: {
          _id: 1,
          platform: "$platform",
          name: "$name",
          status: 1,
          style: { $literal: "CONTROLLED" },
          created_at: "$createdAt",
          updated_at: "$updatedAt",
          entryNodeId: "$entryNodeId",
        },
      },
      {
        $unionWith: {
          coll: freestyleColl,
          pipeline: [
            { $match: { userId: userId, status: { $ne: "deleted" } } },
            {
              $project: {
                _id: 1,
                name: "$botName",
                platform: "$platform",
                status: 1,
                style: { $literal: "FREESTYLE" },
                created_at: "$created_at",
                updated_at: "$updated_at",
                entryNodeId: { $literal: null },
              },
            },
          ],
        },
      },
    ];

    // Cursor filter on unified created_at
    if (cursor) {
      pipeline.push({ $match: { created_at: { $lt: new Date(cursor as string) } } });
    }

    // Sort and pagination
    pipeline.push({ $sort: { created_at: -1 } });
    pipeline.push({ $limit: limit + 1 });

    const items = await ControlledBotModel.aggregate(pipeline);

    if (!items || items.length === 0) {
      return res.status(404).json({ message: "No bots found for this user" });
    }

    const hasMore = items.length > limit;
    if (hasMore) items.pop();

    const nextCursor = items.length > 0 ? items[items.length - 1]?.created_at : null;

    // Totals for pagination
    const [totalControlled, totalFreestyle] = await Promise.all([
      ControlledBotModel.countDocuments({ userId, status: { $ne: "deleted" } }),
      BotStructureModel.countDocuments({ userId: userId }).where({ status: { $ne: "deleted" } }),
    ]);
    const total = totalControlled + totalFreestyle;

    return res.status(200).json({
      message: "Unified bots fetched successfully",
      cursor: nextCursor,
      items,
      hasMore,
      totals: { total, totalControlled, totalFreestyle },
    });
  }
  catch (e) {
    console.log(e);
    return res.status(500).json({ message: "Internal Server Error", e });
  }
};


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

    let bot = await BotStructureModel.findById(botId);
    if (!bot) {
      bot = await ControlledBotModel.findById(botId);
      if (!bot)
        return res.status(404).json({ message: "Bot not found" });
    }

    if (bot.userId !== userId) {
      return res.status(403).json({ message: "Forbidden: You don't have permission to delete this bot" });
    }

    const stringBotId = bot._id.toString();
    console.log("Revoking API Key for botId:", stringBotId);

    // Update API key - use exact column names as defined in schema with double quotes
    const { data, error } = await supabase
      .from("API_KEY")
      .update({
        isRevoked: true,
        Revoked_at: new Date().toISOString()
      })
      .eq("botId", stringBotId)
      .select();

    if (error) {
      console.error("Error revoking API key:", error);
      return res.status(500).json({ message: "Error revoking API key.", error: error.message });
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

    const freestyleColl = BotStructureModel.collection.name;

   const pipeline: any[] = [
      { $match: { userId, status: { $eq: "deleted" } } },
      {
        $project: {
          _id: 1,
          platform: "$platform",
          name: "$name",
          status: 1,
          style: { $literal: "CONTROLLED" },
          created_at: "$createdAt",
          updated_at: "$updatedAt",
          deleted_at : "$deleted_at",
          entryNodeId: "$entryNodeId",
        },
      },
      {
        $unionWith: {
          coll: freestyleColl,
          pipeline: [
            { $match: { userId: userId, status: { $eq: "deleted" } } },
            {
              $project: {
                _id: 1,
                name: "$botName",
                platform: "$platform",
                status: 1,
                style: { $literal: "FREESTYLE" },
                created_at: "$created_at",
                updated_at: "$updated_at",
                deleted_at : "$deleted_at",
                entryNodeId: { $literal: null },
              },
            },
          ],
        },
      },
    ];


    const deletedBots = await ControlledBotModel.aggregate(pipeline);

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
    if (!botId) {
      return res.status(400).json({ message: "Bot ID is required" });
    }

    const bot = await BotStructureModel.findById(botId) || await ControlledBotModel.findById(botId);
    let type = null;
    if (!bot) {
      return res.status(404).json({ message: "Bot not found" });
    }

    if((bot as any)?.type === "CONTROLLED"){
      type = "CONTROLLED";
    }else 
    { 
      type = "FREESTYLE";
    };

    if (bot.userId !== userId) {
      return res.status(403).json({ message: "Forbidden: You don't have permission to restore this bot" });
    }

    
    const botConfig = await botConfiguration.findOne({ botId });
    if (!botConfig && type === "FREESTYLE") 
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
  try {
    const userId = (req as any).user?.userId;
    const { botId } = req.body;

    if (!userId || !botId) {
      return res.status(400).json({ message: "User ID and bot ID bot are required! But not provided" });
    }

    let bot = await BotStructureModel.findByIdAndDelete(botId) || await ControlledBotModel.findByIdAndDelete(botId);
    if (!bot) {
      return res.status(404).json({ message: "Bot not found" });
    }
    return res.status(200).json({ message: "Bot Permanently Deleted Successfully", bot });
  }
  catch (e) {
    return res.status(500).json({ message: "Internal Server Error", e });
  }

}

export const getOneBotDetailsController = async (req: Request, res: Response): Promise<Response> => {
  try {
    const userId = (req as any).user?.userId;
    const { botId } = req.params;

    if (!userId || !botId) {
      return res.status(400).json({ message: "User ID and bot ID bot are required! But not provided" });
    }

    let bot = await BotStructureModel.findById(botId) || await ControlledBotModel.findById(botId);
    if (!bot) {
      return res.status(404).json({ message: "Bot not found! It might happen that it was deleted or the ID is incorrect." });
    }

    const botConfig = await botConfiguration.findOne({ botId });
    if (!botConfig) {
      return res.status(200).json({ message: "Single Bot Details", bot });
    }

    if (botConfig.configStatus !== 'setup') {
      return res.status(405).json({ message: "Bot setup process is already completed! You can configure it now only!", setUpCompleted: true });
    }

    return res.status(200).json({ message: "Single Bot Details", bot });
  }
  catch (e) {
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
    const userId = (req as any).user?.userId;
    if (!userId) {
      await session.abortTransaction();
      return res.status(401).json({ message: "Unauthorized: User ID is required" });
    }

    // Extract bot object from request body
    const { bot } = req.body;

    // Validate bot structure
    if (!bot || typeof bot !== "object") {
      await session.abortTransaction();
      return res.status(400).json({ message: "Bot data is required" });
    }

    if (!bot.name || typeof bot.name !== "string") {
      await session.abortTransaction();
      return res.status(400).json({ message: "Bot name is required" });
    }

    if (!Array.isArray(bot.nodes) || bot.nodes.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: "At least one node is required" });
    }

    // Step 1: Build tempId → MongoDB ObjectId mapping for all nodes
    const tempIdToObjectId: Record<string, mongoose.Types.ObjectId> = {};
    bot.nodes.forEach((node: any) => {
      tempIdToObjectId[node.id] = new mongoose.Types.ObjectId();
    });

    // Step 2: Determine entry node (first node by default)
    const entryNodeTempId = bot.nodes[0]?.id;
    if (!entryNodeTempId) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Entry node could not be determined" });
    }

    const entryNodeObjectId = tempIdToObjectId[entryNodeTempId];

    // Step 3: Create ControlledBot document
    const controlledBot = new ControlledBotModel({
      name: bot.name,
      userId: userId,
      type: "CONTROLLED",
      status: "inactive",
      entryNodeId: entryNodeObjectId,
    });

    const savedBot = await controlledBot.save({ session });
    const botId = savedBot._id;

    // Step 4: Transform and insert nodes
    const nodeDocuments = bot.nodes.map((node: any) => {
      const nodeDoc: any = {
        _id: tempIdToObjectId[node.id],
        botId,
        title: node.title || "",
        message: node.message || "",
        executor: "none",
        output: {
          mode: node.output?.type || "text",
          optionCount: node.options?.length || 0,
          allowGoBack: node.output?.controls?.allowGoBack ?? false,
          allowEnd: node.output?.controls?.allowEnd ?? false,
        },
      };

      // Store custom text for text output type when executor is "none"
      if (node.output?.type === "text" && node.output?.customText) {
        nodeDoc.output.customText = node.output.customText;
      }

      // Determine executor type
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

        // Normalize query params into an object for persistence
        let queryParams: Record<string, string> | undefined;
        if (Array.isArray(node.executor?.config?.params)) {
          queryParams = node.executor.config.params.reduce(
            (acc: Record<string, string>, param: any) => {
              if (param?.key) acc[param.key] = param.value ?? "";
              return acc;
            },
            {}
          );

          if (Object.keys(queryParams as any).length === 0) {
            queryParams = undefined;
          }
        }

        nodeDoc.apiConfig = {
          endpointKey: node.executor?.config?.endpoint || "default",
          method: node.executor?.config?.method || "GET",
          timeoutMs: node.executor?.config?.timeoutMs || 5000,
          // Store next node ID for API nodes with options output
          nextNodeId: (node.output?.type === "options" && node.apiResponseMapping?.nextNodeId)
            ? tempIdToObjectId[node.apiResponseMapping.nextNodeId]
            : undefined,
          queryParameter: queryParams,
          saveResponseAs: node.executor?.config?.saveResponseAs,
          useLLMSanitizer: node.executor?.config?.useLLMSanitizer || false,
        };
      } else if (
        (!node.options || node.options.length === 0) &&
        (!node.executor || node.executor.type === "none")
      ) {
        nodeDoc.executor = "none";
      }

      return nodeDoc;
    });

    await ControlledBotNodeModel.insertMany(nodeDocuments, { session });

    // Step 5: Extract and insert edges from node options
    const edgeSet = new Map<string, any>();

    bot.nodes.forEach((node: any) => {
      if (node.options && Array.isArray(node.options)) {
        const fromNodeId = tempIdToObjectId[node.id];

        node.options.forEach((option: any, optionIndex: number) => {
          const nextNodeId = option.nextNodeId;

          // Only create edge if nextNodeId is non-empty
          if (nextNodeId && nextNodeId.trim() !== "") {
            const toNodeId = tempIdToObjectId[nextNodeId];

            if (fromNodeId && toNodeId) {
              const key = `${fromNodeId}-${toNodeId}-${optionIndex}`;
              edgeSet.set(key, {
                botId,
                fromNodeId,
                toNodeId,
                intent: option.label || `Option ${optionIndex + 1}`,
                order: optionIndex,
              });
            }
          }
        });
      }

      // Handle input node routing
      if (node.inputNextNodeId && node.inputNextNodeId.trim() !== "") {
        const fromNodeId = tempIdToObjectId[node.id];
        const toNodeId = tempIdToObjectId[node.inputNextNodeId];

        if (fromNodeId && toNodeId) {
          const key = `${fromNodeId}-${toNodeId}-input`;
          edgeSet.set(key, {
            botId,
            fromNodeId,
            toNodeId,
            intent: "User Input",
            order: 0,
          });
        }
      }

      // Handle API response mapping routing
      if (node.apiResponseMapping?.nextNodeId && node.apiResponseMapping.nextNodeId.trim() !== "") {
        const fromNodeId = tempIdToObjectId[node.id];
        const toNodeId = tempIdToObjectId[node.apiResponseMapping.nextNodeId];

        if (fromNodeId && toNodeId) {
          const key = `${fromNodeId}-${toNodeId}-api`;
          edgeSet.set(key, {
            botId,
            fromNodeId,
            toNodeId,
            intent: "API Response",
            order: 0,
          });
        }
      }
    });

    // Insert edges
    if (edgeSet.size > 0) {
      const edgeDocuments = Array.from(edgeSet.values());
      await ControlledBotEdgeModel.insertMany(edgeDocuments, { session });
    }

    // Step 6: Commit transaction
    await session.commitTransaction();

    return res.status(201).json({
      message: "Controlled bot created successfully",
      data: {
        botId: savedBot._id,
        name: savedBot.name,
        type: savedBot.type,
        status: savedBot.status,
        entryNodeId: savedBot.entryNodeId,
        nodesCreated: bot.nodes.length,
        edgesCreated: edgeSet.size,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error creating controlled bot:", error);

    return res.status(500).json({
      message: "Failed to create controlled bot",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    await session.endSession();
  }
};
