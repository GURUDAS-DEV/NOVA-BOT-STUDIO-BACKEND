import express from "express";
import { testingTheBot } from "../../controller/Testing/controller.js";

const TestingRouter = express.Router();

TestingRouter.post("/TestBot", testingTheBot);

export default TestingRouter;