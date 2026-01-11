import { Router } from "express";
import { accessMiddleware } from "../../../Middleware/accessMiddleware.js";
import { freestyleWebsiteBotController } from "../../../controller/BotCommunication/Website/controllert.js";


const communcationWithBotRouter = Router();

communcationWithBotRouter.post("/FreeStyleChat", accessMiddleware, freestyleWebsiteBotController);

export default communcationWithBotRouter;