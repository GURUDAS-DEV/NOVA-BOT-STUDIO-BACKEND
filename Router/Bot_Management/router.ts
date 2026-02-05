import { Router } from "express";
import { createBotController, createWebsiteControlledBot, createWebsiteControlledStyleBotConfig, deleteBotController, getBotDetailsForHomePageController, getDeletedBotsController, getOneBotDetailsController, getUnifiedBotsForManagePageController, permanentlyDeleteBotController, getOneControlledBotDetailsController, restoreDeletedBotController, detectBotTypeController } from "../../controller/Bot_Management/controller.js";
import { authMiddleware } from "../../Middleware/authMiddleware.js";

const BotManagementRouter = Router();


//creating bot router
BotManagementRouter.post("/createBot", authMiddleware, createBotController);

//getting bot details router 
BotManagementRouter.post("/getBotDetailsForHomePage",authMiddleware, getBotDetailsForHomePageController);
BotManagementRouter.get("/getAllBotsForManagePage",authMiddleware, getUnifiedBotsForManagePageController);
BotManagementRouter.get("/getOneBotDetails/:botId", authMiddleware, getOneBotDetailsController);
BotManagementRouter.get("/getControlledBotById/:botId", authMiddleware, getOneControlledBotDetailsController);

//deleting router 
BotManagementRouter.delete("/deleteBot", authMiddleware, deleteBotController);
BotManagementRouter.get("/getDeletedBots", authMiddleware, getDeletedBotsController);
BotManagementRouter.post("/recoverBot", authMiddleware, restoreDeletedBotController);
BotManagementRouter.delete("/permanentlyDeleteBot", authMiddleware, permanentlyDeleteBotController);

BotManagementRouter.post('/createControlledBot', authMiddleware, createWebsiteControlledBot);
BotManagementRouter.post("/setupWebsiteControlledStyleBotConfig", authMiddleware, createWebsiteControlledStyleBotConfig);

BotManagementRouter.post("/detectBotType", authMiddleware, detectBotTypeController)

export default BotManagementRouter;