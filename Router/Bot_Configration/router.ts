import exress from 'express';
import { setConfigController } from '../../controller/BotConfigrationController/controller.js';

const BotConfigrationRouter = exress.Router();

BotConfigrationRouter.post("/setConfig", setConfigController);

export {BotConfigrationRouter};   