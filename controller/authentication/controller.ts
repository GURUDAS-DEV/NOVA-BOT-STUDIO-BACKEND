import { response, type Request, type Response } from "express";
import { supabase } from "../../Database/postgresql.js";
import type { userSchema } from "../../utils/types/users.js";
import { generateOTP, helperForRefreshTokenOnly } from "./helper.js";
import { genSalt, hash, compare } from "bcrypt-ts";
import { getRegistrationEmailHtml } from "../../Email/htmlTemplateForOTPSending.js";
import { generateAccessToken } from "../../utils/JWT/GenerateTokens.js";
import { Resend } from "resend";
import { verifyAccessToken, verifyRefreshToken } from "../../utils/JWT/ValidateToken.js";
import htmlTemplateForAwaringUser from "../../Email/htmlTemplateForAwaringUser.js";
import { getLocationFromIP, formatLocation, getBrowserFromUserAgent, getDeviceFromUserAgent } from "../../utils/locationHelper.js";
import { getLoginOTPEmailHtml } from "../../Email/htmlTemplateForOTPSendingLogin.js";



const cookieOptions = {
    httpOnly: true,
    secure: false, // Must be false for localhost HTTP
    sameSite: "lax" as const, // 'lax' works for same-site localhost requests
    path: "/"
    // Do NOT set domain for localhost
};

export const handleOTPGeneration = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { username, email, password, confirmPassword } = req.body;

        // 1. Validate input
        if (!username || !email || !password || !confirmPassword) {
            return res.status(400).json({ message: "All fields are required." });
        }

        //password length check
        if (password.length < 6 || password.length > 50) {
            return res.status(400).json({ message: "Password must be at least 6 characters long and no more than 50 characters." });
        }

        //password and confirm password match check
        if (password !== confirmPassword) {
            return res.status(400).json({ message: "Password and confirmPassword do not match." });
        }

        // 2. Check if user exists
        const { data: existingUser, error: userCheckError } = await supabase
            .from("users")
            .select("id, verified")
            .eq("email", email)
            .single();

        // Handle unexpected DB error
        if (userCheckError && userCheckError.code !== "PGRST116") {
            return res.status(500).json({
                message: "Database error",
                error: userCheckError.message,
            });
        }

        // User exists + verified => stop
        if (existingUser && existingUser.verified) {
            return res.status(400).json({
                message: "User already exists and verified. Please login.",
            });
        }

        // 3. OTP Generation
        const otp = generateOTP(6).toString();
        const otp_expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        const saltPromise = genSalt(10);
        const resend = new Resend(process.env.RESEND_MAIL_API_KEY);

        // Wait for salt
        const salt = await saltPromise;

        // Hash OTP + Password in parallel
        const [hashedOTP, hashedPassword] = await Promise.all([
            hash(otp, salt),
            hash(password, salt),
        ]);

        // 4. Upsert user
        const { error: upsertError } = await supabase.from("users").upsert(
            {
                username,
                email,
                password: hashedPassword,
                verified: false,
                OTP: hashedOTP,
                OTP_Expiry: otp_expiry,
                auth_provider: "custom",
            },
            { onConflict: "email" }
        );

        if (upsertError) {
            return res.status(500).json({
                message: "Database error",
                error: upsertError.message,
            });
        }

        // 5. Prepare HTML
        const emailHtml = getRegistrationEmailHtml(otp);

        // 6. Send email asynchronously using IIFE to avoid blocking
        // Note: This is non-blocking, so the response will be sent immediately
        // while the email is being sent in the background.
        (async () => {
            try {
                await resend.emails.send({
                    from: "NOVA <onboarding@resend.dev>",
                    to: "gursad5@gmail.com",
                    subject: "WELCOME TO NOVA BOT STUDIO - YOUR OTP CODE",
                    html: emailHtml,
                });
            } catch (err) {
                console.log("Email sending failed (non-blocking):", err);
                return res.status(500).json({
                    message: "Failed to send OTP email. Please try again later.",
                });
            }
        })();

        // 7. Respond to client
        // Note: The response is sent immediately, while the email sending happens in the background.
        return res.status(200).json({
            message: "OTP sent successfully! Please check your email.",
        });

    }
    catch (error: any) {
        console.error("OTP Generation Error:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error?.message || "Unknown error",
        });
    }
};



export const handleRegisterController = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { email, OTP } = req.body;

        if (!email || !OTP) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Fetch user
        const { data: user, error: userError } = await supabase
            .from("users")
            .select("id, username, OTP, OTP_Expiry")
            .eq("email", email)
            .maybeSingle();

        if (userError) {
            return res.status(500).json({ message: "Database error", error: userError.message });
        }

        if (!user) {
            return res.status(404).json({ message: "User not found. Please register again." });
        }

        if (user.OTP === null || user.OTP_Expiry === null) {
            return res.status(400).json({ message: "Maybe you haven't requested an OTP yet or you are already verified!" });
        }

        // Check expiry
        if (new Date() > new Date(user.OTP_Expiry)) {
            return res.status(400).json({ message: "OTP has expired. Please request a new one." });
        }

        // Validate OTP
        const isOTPValid = await compare(OTP, user.OTP);

        if (!isOTPValid) {
            return res.status(400).json({ message: "Invalid OTP. Please try again." });
        }

        // Mark verified
        const { error: updateError } = await supabase
            .from("users")
            .update({ verified: true, OTP: null, OTP_Expiry: null })
            .eq("email", email);

        if (updateError) {
            return res.status(500).json({ message: "Database error", error: updateError.message });
        }

        // Generate tokens
        const { refreshToken, accessToken } = generateAccessToken(user.id, user.username, email);
        const hashedRefreshToken = await hash(refreshToken, 10);

        // User agent + IP
        const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.socket.remoteAddress;
        const userAgent = req.get("User-Agent") || "";

        // Insert session
        const { data: sessionData, error: sessionError } = await supabase
            .from("session")
            .insert({
                userId: user.id,
                refreshToken: hashedRefreshToken,
                ip,
                userAgent,
                revoked: false,
                expiredAt: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString()
            })
            .select("sessionId");

        if (sessionError) {
            return res.status(500).json({ message: "Database error", error: sessionError.message });
        }

        const isProduction = process.env.NODE_ENV === "production";

        // Set cookies
        res.cookie("accessToken", accessToken, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000, // 15 minutes
        });

        res.cookie("refreshToken", refreshToken, {
            ...cookieOptions,
            maxAge: 40 * 24 * 60 * 60 * 1000, // 40 days
        });

        res.cookie("sessionId", sessionData[0]?.sessionId, {
            ...cookieOptions,
            maxAge: 40 * 24 * 60 * 60 * 1000, // 40 days
        });

        return res.status(200).json({ message: "Register Successfully! Your account has been verified.", isLoggedIn: true, username: user.username, email: email });

    } catch (error: any) {
        console.error("Registration Error:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error?.message || "Unknown error",
        });
    }
};


export const validateTokenController = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { accessToken, refreshToken, sessionId } = req.cookies;

        if (!sessionId) {
            return res.status(401).json({ message: "Session ID missing. Unauthorized" });
        }
        if(!refreshToken){
            return res.status(401).json({ message: "Refresh Token missing. Unauthorized" });
        }

        else if (!accessToken && refreshToken) {
            //helper function that can be use if access token is not provided properly
            return helperForRefreshTokenOnly(refreshToken, sessionId, res);
        }

        //both token are available let's verify access token
        //verify access token at server level
        const accessPayload = verifyAccessToken(accessToken);
        if (accessPayload == null) {
            return helperForRefreshTokenOnly(refreshToken, sessionId, res);
        }

        return res.status(200).json({
            message: "Authenticated",
            userId: accessPayload.userId,
            email: accessPayload.email,
            username: accessPayload.username
        });

    }
    catch (error: any) {
        console.error("Validate Token Error:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error?.message || "Unknown error",
        });
    }
};


export const handleLoginControllerByPassword = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required." });
        }

        const { data, error } = await supabase.from('users').select('id, username, email, password, verified').eq('email', email).maybeSingle();

        if (error) {
            return res.status(500).json({ message: "Database error", error: error });
        }

        if (!data) {
            return res.status(404).json({ message: "User not found. Please register first." });
        }

        if (data?.verified === false) {
            return res.status(400).json({ message: "User not verified. Please verify your account first." });
        }

        const isPasswordValid = await compare(password, data.password!);
        if (!isPasswordValid) {
            return res.status(400).json({ message: "Invalid password. Please try again." });
        }

        const { refreshToken, accessToken } = generateAccessToken(data.id, data.username, data.email);
        const hashedRefreshToken = await hash(refreshToken, 10);

        // User agent + IP
        const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.socket.remoteAddress;
        const userAgent = req.get("User-Agent") || "";

        // Insert session  
        const { data: sessionData, error: sessionError } = await supabase.from("session").insert({
            userId: data.id,
            refreshToken: hashedRefreshToken,
            ip,
            expiredAt: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
            userAgent,
            revoked: false
        }).select("sessionId");

        if (sessionError) {
            return res.status(500).json({ message: "Database error", error: sessionError.message });
        }

        res.cookie("refreshToken", refreshToken, {
            ...cookieOptions,
            maxAge: 40 * 24 * 60 * 60 * 1000, // 40 days,
        });

        res.cookie("accessToken", accessToken, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000, // 15 minutes
        });

        res.cookie("sessionId", sessionData[0]?.sessionId, {
            ...cookieOptions,
            maxAge: 40 * 24 * 60 * 60 * 1000, // 40 days
        });

        (async () => {
            try {
                // Get location from IP
                const locationData = await getLocationFromIP(ip || "");
                const formattedLocation = formatLocation(locationData);
                const browser = getBrowserFromUserAgent(userAgent);
                const device = getDeviceFromUserAgent(userAgent);

                const emailHtml = htmlTemplateForAwaringUser({
                    username: data.username,
                    location: formattedLocation,
                    device: device,
                    browser: browser,
                    loginDate: new Date().toLocaleString(),
                    ipAddress: ip || "Unknown",
                    loginMethod: "Password"
                });

                const resend = new Resend(process.env.RESEND_MAIL_API_KEY);
                const { data: emailData, error: emailError } = await resend.emails.send({
                    from: "NOVA <onboarding@resend.dev>",
                    to: 'gursad5@gmail.com',
                    subject: "Security Alert: New Login to Your Account",
                    html: emailHtml,
                });
                if (emailError) {
                    console.log("Email sending error (non-blocking):", emailError);
                }
            } catch (err) {
                console.log("Email sending failed (non-blocking):", err);
            }
        })();

        return res.status(200).json({ message: "Login successful!", isLoggedIn: true, username: data.username, email: data.email });
    }
    catch (error: any) {
        console.error("Login Error:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error?.message || "Unknown error",
        });
    }
};

export const handleOTPGenerationForLogin = async (req: Request, res: Response): Promise<Response> => {
    try {

        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ message: "Email is required." });
        }

        const { data: user, error: userError } = await supabase.from("users").select("id, username, email, verified").eq("email", email).maybeSingle();

        if (userError) {
            return res.status(500).json({ message: "Database error", error: userError.message });
        }

        if (!user) {
            return res.status(404).json({ message: "User not found. Please register first." });
        }

        const OTP = generateOTP(6).toString();
        const otp_expiry = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes from now
        const hashedOTP = await hash(OTP, 10);
        const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.socket.remoteAddress;

        const { data: LoginOTPData, error: LoginOTPError } = await supabase.from("Login_OTPs").insert({
            userEmail: email,
            userId: user.id,
            username: user.username,
            OTP: hashedOTP,
            OTP_expiry: otp_expiry,
            userAgent: req.get("User-Agent") || "",
            IP: ip || "Unknown",
            no_of_attempts: 0,
            is_active: true,
        });

        if (LoginOTPError) {
            return res.status(500).json({ message: "Database error", error: LoginOTPError.message });
        }

        (async () => {
            try {
                const locationData = await getLocationFromIP(ip || "");
                const emailHtml = getLoginOTPEmailHtml({
                    username: user.username,
                    otp: OTP,
                    browser: getBrowserFromUserAgent(req.get("User-Agent") || ""),
                    ipAddress: ip || "Unknown",
                    location: formatLocation(locationData)
                });

                const resend = new Resend(process.env.RESEND_MAIL_API_KEY);

                const { data: emailData, error: emailError } = await resend.emails.send({
                    from: "NOVA <onboarding@resend.dev>",
                    to: 'gursad5@gmail.com',
                    subject: "Your Login OTP",
                    html: emailHtml,
                });
                if (emailError) {
                    console.log("Email sending error (non-blocking):", emailError);
                }
            }
            catch (err) {
                console.log("Email sending failed (non-blocking):", err);
                return res.status(500).json({
                    message: "Failed to send OTP email. Please try again later.",
                });
            }
        })();

        return res.status(200).json({ message: "OTP Sent to given Mail! Enter OTP to verify.", OTP });
    }
    catch (e: any) {
        console.error("OTP Generation for Login Error:", e);
        return res.status(500).json({
            message: "Internal server error",
            error: e?.message || "Unknown error",
        });
    }
}


export const handleLoginController = async (req: Request, res: Response): Promise<Response> => {
    try {

        const { email, OTP } = req.body;
        if (!email || !OTP) {
            return res.status(400).json({ message: "Email and OTP are required." });
        }

        const { data: user, error: errorData } = await supabase.from("Login_OTPs").select("OTP, OTP_expiry, is_active, no_of_attempts, userId, username").eq("userEmail", email).order("created_at", { ascending: false }).limit(1).maybeSingle();

        if (errorData) {
            return res.status(500).json({ message: "Database error", error: errorData.message });
        }

        if (!user || !user.is_active) {
            return res.status(400).json({ message: "No active OTP found for this email. Please request a new OTP." });
        }

        if (new Date() > new Date(user.OTP_expiry)) {
            return res.status(400).json({ message: "OTP has expired. Please request a new OTP." });
        }

        if (user.no_of_attempts >= 5) {
            return res.status(400).json({ message: "Maximum OTP attempts exceeded. Please request a new OTP." });
        }

        const isOTPValid = await compare(OTP, user.OTP);
        if (!isOTPValid) {
            // Increment attempt count
            await supabase.from("Login_OTPs").update({ no_of_attempts: user.no_of_attempts + 1 }).eq("userEmail", email).eq("is_active", true);
            return res.status(400).json({ message: "Invalid OTP. Please try again." });
        }

        // Deactivate OTP after successful use
        (async () => {
            await supabase.from("Login_OTPs").update({ is_active: false, OTP: null, OTP_expiry: null }).eq("userEmail", email).eq("is_active", true);
        })();

        const { refreshToken, accessToken } = generateAccessToken(user.userId, user.username, email);
        const hashedRefreshToken = await hash(refreshToken, 10);

        // User agent + IP
        const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.socket.remoteAddress;
        const userAgent = req.get("User-Agent") || "";

        const { data: sessionData, error: sessionError } = await supabase.from("session").insert({
            userId: user.userId,
            refreshToken: hashedRefreshToken,
            userAgent,
            revoked: false,
            ip,
            expiredAt: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
        }).select("sessionId");

        if (sessionError) {
            return res.status(500).json({ message: "Database error", error: sessionError.message });
        }



        res.cookie("refreshToken", refreshToken, {
            ...cookieOptions,
            maxAge: 40 * 24 * 60 * 60 * 1000, // 40 days,
        });

        res.cookie("accessToken", accessToken, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000, // 15 minutes
        });

        res.cookie("sessionId", sessionData[0]?.sessionId, {
            ...cookieOptions,
            maxAge: 40 * 24 * 60 * 60 * 1000, // 40 days
        });

        return res.status(200).json({ message: "Login successful!", isLoggedIn: true, username: user.username, email: email });
    }
    catch (e: any) {
        console.log("Login Error:", e);
        return res.status(500).json({
            message: "Internal server error",
            error: e?.message || "Unknown error",
        });
    }
}


export const handleGoogleAuthInitialReq = async (req: Request, res: Response): Promise<Response> => {
    try {
        const googleOAuthURL = "https://accounts.google.com/o/oauth2/v2/auth";
        const params = new URLSearchParams({
            client_id: process.env.GOOGLE_CLIENT_ID || "",
            redirect_uri: "http://localhost:9000/api/auth/google/callback",
            response_type: "code",
            scope: "openid email profile",
            access_type: "offline",
            prompt: "consent"
        });
        const url = `${googleOAuthURL}?${params.toString()}`;


        return res.status(200).json({ message: "URL Generated Successfully", url });
    }
    catch (e: any) {
        return res.status(500).json({ message: "Internal server error", error: e?.message || "Unknown error", });
    }
};

export const handleGoogleAuthentication = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { code } = req.query;
        if (!code)
            return res.status(400).json({ message: "Authorization code is missing from query parameters." });

        //exchange code for tokens
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                code: code.toString(),
                client_id: process.env.GOOGLE_CLIENT_ID!,
                client_secret: process.env.GOOGLE_CLIENT_SECRET!,
                redirect_uri: "http://localhost:9000/api/auth/google/callback",
                grant_type: "authorization_code",
            }),
        });

        const tokenData = await tokenRes.json();
        if (tokenData.error) {
            return res.status(400).json({ message: "Failed to exchange code for tokens", error: tokenData.error_description || "Unknown error" });
        }
        const { id_token } = tokenData;

        //fetch user info from google
        const base64Payload = id_token.split(".")[1];
        const payload = JSON.parse(Buffer.from(base64Payload, "base64").toString("utf-8"));
        const { email, name, picture } = payload;

        const { data: user, error: userError } = await supabase.from("users").select("*").eq("email", email).maybeSingle();

        if (userError) {
            return res.status(500).json({ message: "Database error", error: userError.message });
        }

        //if user is not in the databse then register them
        //this code start here for new user registration
        //when user doesn't exist
        if (!user) {
            //register user
            const { data: newUser, error: newUserError } = await supabase.from("users").insert({
                username: name,
                email: email,
                verified: true,
                auth_provider: "google",
                avatar: picture,
                password: null,
                OTP: null,
                OTP_Expiry: null,
                google_id: payload.sub
            }).select().single();

            if (newUserError) {
                return res.status(500).json({ message: "Database error", error: newUserError.message });
            }
            const { refreshToken, accessToken } = generateAccessToken(newUser.id, newUser.username, newUser.email);

            const hashedRefreshToken = await hash(refreshToken, 10);

            // User agent + IP
            const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.socket.remoteAddress;
            const userAgent = req.get("User-Agent") || "";

            const { data: sessionData, error: sessionError } = await supabase.from("session").insert({
                userId: newUser.id,
                refreshToken: hashedRefreshToken,
                userAgent,
                revoked: false,
                ip,
                expiredAt: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
            }).select("sessionId");

            if (sessionError) {
                return res.status(500).json({ message: "Database error", error: sessionError.message });
            }

            res.cookie("refreshToken", refreshToken, {
                ...cookieOptions,
                maxAge: 40 * 24 * 60 * 60 * 1000, // 40 days,
            });
            res.cookie("accessToken", accessToken, {
                ...cookieOptions,
                maxAge: 15 * 60 * 1000, // 15 minutes
            });
            res.cookie("sessionId", sessionData[0]?.sessionId, {
                ...cookieOptions,
                maxAge: 40 * 24 * 60 * 60 * 1000, // 40 days
            });

            res.redirect("http://localhost:3000/home");
            return res.status(200).json({ message: "User registered and logged in successfully via Google!", isLoggedIn: true, username: newUser.username, email: newUser.email });
        }

        //user is already at our database so just log them in
        const { refreshToken, accessToken } = generateAccessToken(user.id, user.username, user.email);
        const hashedRefreshToken = await hash(refreshToken, 10);

        // User agent + IP
        const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.socket.remoteAddress;
        const userAgent = req.get("User-Agent") || "";

        const { data: sessionData, error: sessionError } = await supabase.from("session").insert({
            userId: user.id,
            refreshToken: hashedRefreshToken,
            revoked: false,
            userAgent,
            ip,
            expiredAt: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
        }).select("sessionId");

        if (sessionError) {
            return res.status(500).json({ message: "Database error", error: sessionError.message });
        }

        res.cookie("refreshToken", refreshToken, {
            ...cookieOptions,
            maxAge: 40 * 24 * 60 * 60 * 1000, // 40 days,  
        });
        res.cookie("accessToken", accessToken, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000, // 15 minutes
        });
        res.cookie("sessionId", sessionData[0]?.sessionId, {
            ...cookieOptions,
            maxAge: 40 * 24 * 60 * 60 * 1000, // 40 days
        });


        res.redirect("http://localhost:3000/home");
        return res.status(200).json({ message: "User logged in successfully via Google!", isLoggedIn: true, username: user.username, email: user.email });
    }
    catch (e: any) {
        return res.status(500).json({ message: "Internal server error", error: e?.message || "Unknown error", });
    }
}




export const handleGitHubAuthInitialReq = async (req: Request, res: Response): Promise<Response> => {
    try {
        const githubOAuthURL = "https://github.com/login/oauth/authorize";
        const params = new URLSearchParams({
            client_id: process.env.GITHUB_CLIENT_ID || "",
            redirect_uri: "http://localhost:9000/api/auth/github/callback",
            response_type: "code",
            access_type: "offline",
            prompt: "consent",
            scope: "read:user user:email", // ⚠️ Important!
            allow_signup: "true",
        });
        const url = `${githubOAuthURL}?${params.toString()}`
        return res.status(200).json({ message: "URL Generated Successfully", url });
    }
    catch (e: any) {
        return res.status(500).json({ message: "Internal server error", error: e?.message || "Unknown error", });
    }
};


export const handleGitHubAuthentication = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { code } = req.query;
        if (!code)
            return res.status(400).json({ message: "Authorization code is missing from query parameters." });

        //exchange code for tokens
        const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json"
            },
            body: new URLSearchParams({
                code: code.toString(),
                client_id: process.env.GITHUB_CLIENT_ID!,
                client_secret: process.env.GITHUB_CLIENT_SECRET!,
                redirect_uri: "http://localhost:9000/api/auth/github/callback",
            }),
        });

        const tokenData = await tokenRes.json();
        if (tokenData.error) {
            return res.status(400).json({ message: "Failed to exchange code for tokens", error: tokenData.error_description || "Unknown error" });
        }
        const { access_token } = tokenData;

        //fetch user info from github
        const userRes = await fetch("https://api.github.com/user", {
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
        });

        const githubUser = await userRes.json();
        const { name, avatar_url: picture } = githubUser;


        const emailsRes = await fetch("https://api.github.com/user/emails", {
            headers: { Authorization: `Bearer ${access_token}` },
        });
        if(emailsRes.status !== 200){
            return res.status(400).json({ message: "Failed to fetch user emails from GitHub" });
        }
        const emails = await emailsRes.json();
        console.log("GitHub Emails:", emails);
        const primaryEmail = emails.find(e => e.primary && e.verified)?.email;
        

        const { data: user, error: userError } = await supabase.from("users").select("*").eq("email", primaryEmail).maybeSingle();

        if (userError) {
            return res.status(500).json({ message: "Database error", error: userError.message });
        }

        //if user is not in the databse then register them
        //this code start here for new user registration
        //when user doesn't exist
        if (!user) {
            //register user
            const { data: newUser, error: newUserError } = await supabase.from("users").insert({
                username: name,
                email: primaryEmail,
                verified: true,
                auth_provider: "github",
                avatar: picture,
                password: null,
                OTP: null,
                OTP_Expiry: null,
                github_id: githubUser.id
            }).select().single();

            if (newUserError) {
                return res.status(500).json({ message: "Database error", error: newUserError.message });
            }
            const { refreshToken, accessToken } = generateAccessToken(newUser.id, newUser.username, newUser.email);

            const hashedRefreshToken = await hash(refreshToken, 10);

            // User agent + IP
            const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.socket.remoteAddress;
            const userAgent = req.get("User-Agent") || "";

            const { data: sessionData, error: sessionError } = await supabase.from("session").insert({
                userId: newUser.id,
                refreshToken: hashedRefreshToken,
                userAgent,
                revoked: false,
                ip,
                expiredAt: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
            }).select("sessionId");

            if (sessionError) {
                return res.status(500).json({ message: "Database error", error: sessionError.message });
            }

            res.cookie("refreshToken", refreshToken, {
                ...cookieOptions,
                maxAge: 40 * 24 * 60 * 60 * 1000, // 40 days,
            });
            res.cookie("accessToken", accessToken, {
                ...cookieOptions,
                maxAge: 15 * 60 * 1000, // 15 minutes
            });
            res.cookie("sessionId", sessionData[0]?.sessionId, {
                ...cookieOptions,
                maxAge: 40 * 24 * 60 * 60 * 1000, // 40 days
            });

            res.redirect("http://localhost:3000/home");
            return res.status(200).json({ message: "User registered and logged in successfully via GITHUB!", isLoggedIn: true, username: newUser.username, email: newUser.email });
        }

        //user is already at our database so just log them in
        const { refreshToken, accessToken } = generateAccessToken(user.id, user.username, user.email);
        const hashedRefreshToken = await hash(refreshToken, 10);

        // User agent + IP
        const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.socket.remoteAddress;
        const userAgent = req.get("User-Agent") || "";

        const { data: sessionData, error: sessionError } = await supabase.from("session").insert({
            userId: user.id,
            refreshToken: hashedRefreshToken,
            revoked: false,
            userAgent,
            ip,
            expiredAt: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(),
        }).select("sessionId");

        if (sessionError) {
            return res.status(500).json({ message: "Database error", error: sessionError.message });
        }

        res.cookie("refreshToken", refreshToken, {
            ...cookieOptions,
            maxAge: 40 * 24 * 60 * 60 * 1000, // 40 days,  
        });
        res.cookie("accessToken", accessToken, {
            ...cookieOptions,
            maxAge: 15 * 60 * 1000, // 15 minutes
        });
        res.cookie("sessionId", sessionData[0]?.sessionId, {
            ...cookieOptions,
            maxAge: 40 * 24 * 60 * 60 * 1000, // 40 days
        });


        res.redirect("http://localhost:3000/home");
        return res.status(200).json({ message: "User logged in successfully via GITHUB!", isLoggedIn: true, username: user.username, email: user.email });
    }
    catch (e: any) {
        return res.status(500).json({ message: "Internal server error", error: e?.message || "Unknown error", });
    }
};