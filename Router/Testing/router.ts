import express from "express";
import { testingTheBot } from "../../controller/Testing/controller.js";
import type { Request, Response } from "express";
const TestingRouter = express.Router();

TestingRouter.post("/TestBot", testingTheBot);
TestingRouter.get('/test', (req : Request, res : Response)=>{
    return res.status(200).json({
        message : [
            {
                message : "This is a test response"
            },{
                message : "This is a test response"
            }
        ]
    })
})

export default TestingRouter;