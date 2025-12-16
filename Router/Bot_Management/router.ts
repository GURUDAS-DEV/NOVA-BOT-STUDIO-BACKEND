import { Router } from "express";
import { createBotController, deleteBotController, getAllBotsForManagePageController, getBotDetailsForHomePageController } from "../../controller/Bot_Management/controller.js";
import { authMiddleware } from "../../Middleware/authMiddleware.js";

const BotManagementRouter = Router();


BotManagementRouter.post("/createBot", createBotController);
BotManagementRouter.post("/getBotDetailsForHomePage",authMiddleware, getBotDetailsForHomePageController);
BotManagementRouter.get("/getAllBotsForManagePage",authMiddleware, getAllBotsForManagePageController);
BotManagementRouter.delete("/deleteBot", authMiddleware, deleteBotController)


export default BotManagementRouter;