import express from "express";
import { testingTheBot } from "../../controller/Testing/controller.js";
import type { Request, Response } from "express";
const TestingRouter = express.Router();

TestingRouter.post("/TestBot", testingTheBot);
TestingRouter.get('/test', (req : Request, res : Response)=>{
    return res.status(200).json({
        message : [
            {
                orderId : "12345",
                customerName : "John Doe",
                items : [
                    { productId : "A1", quantity : 2, price : 10 },
                    { productId : "B2", quantity : 1, price : 20 }
                ],
                totalAmount : 40,
                status : "Processing"
            },
            {
                orderId : "67890",
                customerName : "Jane Smith",
                items : [
                    { productId : "C3", quantity : 1, price : 15 },
                    { productId : "D4", quantity : 3, price : 5 }
                ],
                totalAmount : 30,
                status : "Shipped"
            },
            {
                orderId : "54321",
                customerName : "Alice Johnson",
                items : [   
                    { productId : "E5", quantity : 4, price : 8 },
                    { productId : "F6", quantity : 2, price : 12 }
                ],
                totalAmount : 64,
                status : "Delivered"
            }
        ]
    })
})

export default TestingRouter;