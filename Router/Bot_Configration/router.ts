import express from 'express';
import { setConfigController, testUserGivenApiController } from '../../controller/BotConfigrationController/controller.js';

const BotConfigrationRouter = express.Router();

BotConfigrationRouter.post("/testUserGivenApi", testUserGivenApiController);
BotConfigrationRouter.post("/setConfig", setConfigController);

export {BotConfigrationRouter};   