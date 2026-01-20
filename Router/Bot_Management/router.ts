import { Router } from "express";
import { createBotController, createWebsiteControlledBotController, deleteBotController, getBotDetailsForHomePageController, getDeletedBotsController, getOneBotDetailsController, getUnifiedBotsForManagePageController, permanentlyDeleteBotController, restoreDeletedBotController } from "../../controller/Bot_Management/controller.js";
import { authMiddleware } from "../../Middleware/authMiddleware.js";

const BotManagementRouter = Router();


//creating bot router
BotManagementRouter.post("/createBot", authMiddleware, createBotController);

//getting bot details router 
BotManagementRouter.post("/getBotDetailsForHomePage",authMiddleware, getBotDetailsForHomePageController);
BotManagementRouter.get("/getAllBotsForManagePage",authMiddleware, getUnifiedBotsForManagePageController);
BotManagementRouter.get("/getOneBotDetails/:botId", authMiddleware, getOneBotDetailsController);

//deleting router 
BotManagementRouter.delete("/deleteBot", authMiddleware, deleteBotController);
BotManagementRouter.get("/getDeletedBots", authMiddleware, getDeletedBotsController);
BotManagementRouter.post("/recoverBot", authMiddleware, restoreDeletedBotController);
BotManagementRouter.delete("/permanentlyDeleteBot", authMiddleware, permanentlyDeleteBotController);

BotManagementRouter.post("/createControlledBot", authMiddleware, createWebsiteControlledBotController);

export default BotManagementRouter;