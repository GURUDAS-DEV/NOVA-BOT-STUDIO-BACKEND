import { Router } from "express";
import { handleLoginController, handleOTPGeneration, validateTokenController, handleRegisterController } from "../../controller/authentication/controller.js";


const authenticationRouter = Router();

//login and register and OTP generation routes
authenticationRouter.get("/login", handleLoginController);
authenticationRouter.post("/OTPGeneration", handleOTPGeneration);
authenticationRouter.post("/register", handleRegisterController);

//Token Regenration Router
authenticationRouter.get("/validateToken", validateTokenController)

export default authenticationRouter;