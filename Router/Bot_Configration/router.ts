import express from 'express';
import { getConfigController, setConfigController, testUserGivenApiController } from '../../controller/BotConfigrationController/controller.js';
import { authMiddleware } from '../../Middleware/authMiddleware.js';

const BotConfigrationRouter = express.Router();

BotConfigrationRouter.get("/getConfig/:botId", authMiddleware, getConfigController);

BotConfigrationRouter.post("/testUserGivenApi", testUserGivenApiController);
BotConfigrationRouter.post("/setConfig", setConfigController);

export {BotConfigrationRouter};   