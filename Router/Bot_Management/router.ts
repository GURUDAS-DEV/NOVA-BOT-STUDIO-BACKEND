import { Router } from "express";
import { createBotController } from "../../controller/Bot_Management/controller.js";

const BotManagementRouter = Router();


BotManagementRouter.post("/createBot", createBotController);


export default BotManagementRouter;