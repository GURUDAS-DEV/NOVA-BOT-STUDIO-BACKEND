import { Router } from "express";
import { validateBotTokenController } from "../../controller/Telegram/controller.js";

const TelegramBotRouter = Router();

TelegramBotRouter.get("/ValidateBotToken/:botToken", validateBotTokenController);

export default TelegramBotRouter;