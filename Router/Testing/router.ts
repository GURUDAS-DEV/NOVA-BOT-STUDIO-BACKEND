import express from "express";
import { testingTheBot } from "../../controller/Testing/controller.js";
import type { Request, Response } from "express";
const TestingRouter = express.Router();

TestingRouter.post("/TestBot", testingTheBot);
TestingRouter.get('/test', (req : Request, res : Response)=>{
    return res.status(200).json({
        text : "Testing route is working fine."
    })
})

export default TestingRouter;