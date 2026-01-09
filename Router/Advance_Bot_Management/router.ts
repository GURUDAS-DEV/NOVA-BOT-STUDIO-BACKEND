import { Router } from "express";
import { startBotController } from "../../controller/AdvanceBotManagement/contoller.js";
import { authMiddleware } from "../../Middleware/authMiddleware.js";

const advanceBotRouter = Router();

advanceBotRouter.post("/startBot", authMiddleware, startBotController);

export default advanceBotRouter;    