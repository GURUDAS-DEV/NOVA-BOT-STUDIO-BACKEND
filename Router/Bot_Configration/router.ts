import exress from 'express';
import { setConfigController, testUserGivenApiController } from '../../controller/BotConfigrationController/controller.js';

const BotConfigrationRouter = exress.Router();

BotConfigrationRouter.post("/testUserGivenApi", testUserGivenApiController);
BotConfigrationRouter.post("/setConfig", setConfigController);

export {BotConfigrationRouter};   