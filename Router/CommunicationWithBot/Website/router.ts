import { Router } from "express";
import { accessMiddleware } from "../../../Middleware/accessMiddleware.js";
import { controlledStyleWebsiteBotController, freestyleWebsiteBotController } from "../../../controller/BotCommunication/Website/controllert.js";


const communcationWithBotRouter = Router();

communcationWithBotRouter.post("/FreeStyleChat", accessMiddleware, freestyleWebsiteBotController);
communcationWithBotRouter.post("/ControlledStyleChat", accessMiddleware, controlledStyleWebsiteBotController)

export default communcationWithBotRouter;