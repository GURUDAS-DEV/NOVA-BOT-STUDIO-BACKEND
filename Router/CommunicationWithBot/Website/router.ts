import { Router } from "express";
import { accessMiddleware } from "../../../Middleware/accessMiddleware.js";
import { controlledStyleWebsiteBotController, freestyleWebsiteBotController } from "../../../controller/BotCommunication/Website/controllert.js";
import { LimitBotCommunication } from "../../../Middleware/Rate_Limiting/LimitBotCommunication.js";


const communcationWithBotRouter = Router();

communcationWithBotRouter.post("/FreeStyleChat" , accessMiddleware, LimitBotCommunication, freestyleWebsiteBotController);
communcationWithBotRouter.post("/ControlledStyleChat", accessMiddleware,LimitBotCommunication, controlledStyleWebsiteBotController)

export default communcationWithBotRouter;