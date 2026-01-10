import { Router } from "express";
import { APIKeyForWebsiteController, GenerateNewApiKeyForWebsiteController } from "../../controller/API_Key_Management/controller.js";
import { authMiddleware } from "../../Middleware/authMiddleware.js";

const APIKeyRouter = Router();

APIKeyRouter.get("/GetApiKeyForWebsite", authMiddleware, APIKeyForWebsiteController);
APIKeyRouter.post("/GenerateNewApiKeyForWebsite", authMiddleware, GenerateNewApiKeyForWebsiteController);

export default APIKeyRouter;