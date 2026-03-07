import { Router } from "express";
import { CommunicateWithTelegramFreeStyleBotController, SaveTelegramBotConfigurationController, validateBotTokenController } from "../../controller/Telegram/controller.js";

const TelegramBotRouter = Router();

TelegramBotRouter.get("/ValidateBotToken/:botToken", validateBotTokenController);
TelegramBotRouter.post("/SaveTelegramBotConfig", SaveTelegramBotConfigurationController);

//Commmunication with Telegram webhook :
TelegramBotRouter.post("/webhook/:botId", CommunicateWithTelegramFreeStyleBotController);

export default TelegramBotRouter;