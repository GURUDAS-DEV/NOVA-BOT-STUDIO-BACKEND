import { Router } from "express";
import { CommunicateWithTelegramControlledStyleBotController, CommunicateWithTelegramFreeStyleBotController, SaveTelegramBotConfigurationController, validateBotTokenController } from "../../controller/Telegram/controller.js";

const TelegramBotRouter = Router();

TelegramBotRouter.get("/ValidateBotToken/:botToken", validateBotTokenController);
TelegramBotRouter.post("/SaveTelegramBotConfig", SaveTelegramBotConfigurationController);

//Commmunication with Telegram webhook :
TelegramBotRouter.post("/webhook/:botId", CommunicateWithTelegramFreeStyleBotController);
TelegramBotRouter.post("/webhook/controlled/:botId", CommunicateWithTelegramControlledStyleBotController);

export default TelegramBotRouter;