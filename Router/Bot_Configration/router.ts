import express from 'express';
import { getConfigController, getControlledBotConfigController, setConfigController, testUserGivenApiController, updateConfigController } from '../../controller/BotConfigrationController/controller.js';
import { authMiddleware } from '../../Middleware/authMiddleware.js';

const BotConfigrationRouter = express.Router();

BotConfigrationRouter.get("/getConfig/:botId", authMiddleware, getConfigController);

BotConfigrationRouter.post("/testUserGivenApi", testUserGivenApiController);
BotConfigrationRouter.post("/setConfig", setConfigController);
BotConfigrationRouter.put("/updateConfig", authMiddleware, updateConfigController);

BotConfigrationRouter.get("/getControlledBotConfig/:botId", getControlledBotConfigController)

export {BotConfigrationRouter};   