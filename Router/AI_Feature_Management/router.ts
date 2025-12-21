import express from "express";
import { EnhanceTextController, ValidateTextController, ValidateExampleController } from "../../controller/AI_Feature_Management/controller.js";

const aiFeatureManagementRouter = express.Router();

aiFeatureManagementRouter.post("/EnhanceText", EnhanceTextController);
aiFeatureManagementRouter.post("/ValidateText", ValidateTextController);
aiFeatureManagementRouter.post("/ValidateExample", ValidateExampleController);

export default aiFeatureManagementRouter;