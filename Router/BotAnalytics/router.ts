import { Router } from "express";
import { getAnalyticsDataController } from "../../controller/BotAnalyticsManagement/controller.js";


const botAnalyticsRouter = Router();

botAnalyticsRouter.get("/getAnalytics/:botId", getAnalyticsDataController);

export {botAnalyticsRouter};