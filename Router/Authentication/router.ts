import { Router } from "express";
import { handleLoginControllerByPassword, handleOTPGeneration, validateTokenController, handleRegisterController, handleOTPGenerationForLogin, handleLoginController, handleGoogleAuthentication, handleGoogleAuthInitialReq, handleGitHubAuthInitialReq, handleGitHubAuthentication } from "../../controller/authentication/controller.js";


const authenticationRouter = Router();

//login and register and OTP generation routes (Custom Authentication)
authenticationRouter.post("/loginByPassword", handleLoginControllerByPassword);
authenticationRouter.post("/OTPGeneration", handleOTPGeneration);
authenticationRouter.post("/register", handleRegisterController);
authenticationRouter.post("/generateOTPForLogin", handleOTPGenerationForLogin);
authenticationRouter.post("/LoginWithOTP", handleLoginController);

//GOOGLE Authentication routes
authenticationRouter.get("/googleOAuth", handleGoogleAuthInitialReq);
authenticationRouter.get("/google/callback", handleGoogleAuthentication);

//GITHUB Authentication routes
authenticationRouter.get("/githubOAuth", handleGitHubAuthInitialReq);
authenticationRouter.get("/github/callback", handleGitHubAuthentication);

//Token Regenration Router
authenticationRouter.get("/validateToken", validateTokenController)

export default authenticationRouter;