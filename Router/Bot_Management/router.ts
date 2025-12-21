import { Router } from "express";
import { createBotController, deleteBotController, getAllBotsForManagePageController, getBotDetailsForHomePageController, getDeletedBotsController, getOneBotDetailsController, permanentlyDeleteBotController, restoreDeletedBotController } from "../../controller/Bot_Management/controller.js";
import { authMiddleware } from "../../Middleware/authMiddleware.js";

const BotManagementRouter = Router();


//creating bot router
BotManagementRouter.post("/createBot", authMiddleware, createBotController);

//getting bot details router 
BotManagementRouter.post("/getBotDetailsForHomePage",authMiddleware, getBotDetailsForHomePageController);
BotManagementRouter.get("/getAllBotsForManagePage",authMiddleware, getAllBotsForManagePageController);
BotManagementRouter.get("/getOneBotDetails/:botId", authMiddleware, getOneBotDetailsController);

//deleting router 
BotManagementRouter.delete("/deleteBot", authMiddleware, deleteBotController);
BotManagementRouter.get("/getDeletedBots", authMiddleware, getDeletedBotsController);
BotManagementRouter.post("/recoverBot", authMiddleware, restoreDeletedBotController);
BotManagementRouter.delete("/permanentlyDeleteBot", authMiddleware, permanentlyDeleteBotController);

export default BotManagementRouter;