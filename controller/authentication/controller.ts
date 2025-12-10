import type { Request, Response } from "express";
import { supabase } from "../../Database/postgresql.js";
import type { userSchema } from "../../utils/types/users.js";
import { generateOTP, helperForRefreshTokenOnly } from "./helper.js";
import { genSalt, hash, compare } from "bcrypt-ts";
import { getRegistrationEmailHtml } from "../../Email/htmlTemplateForOTPSending.js";
import { generateAccessToken } from "../../utils/JWT/GenerateTokens.js";
import { Resend } from "resend";
import { verifyAccessToken, verifyRefreshToken } from "../../utils/JWT/ValidateToken.js";


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

        // User agent + IP
        const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.socket.remoteAddress;
        const userAgent = req.get("User-Agent") || "";

        // Insert session
        const { data: sessionData, error: sessionError } = await supabase
            .from("session")
            .insert({
                userId: user.id,
                refreshToken,
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

            // Cookie settings
            const cookieOptions = {
                httpOnly: true,
                secure: false, // Must be false for localhost HTTP
                sameSite: "lax" as const, // 'lax' works for same-site localhost requests
                path: "/"
                // Do NOT set domain for localhost
            };

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

            return res.status(200).json({ message: "Register Successfully! Your account has been verified." });

    } catch (error: any) {
        console.error("Registration Error:", error);
        return res.status(500).json({
            message: "Internal server error",
            error: error?.message || "Unknown error",
        });
    }
};



export const handleLoginController = async (req: Request, res: Response): Promise<Response> => {
    try {


        return res.status(200).json({ message: "Login Endpoint" });
    }
    catch (error: any) {
        console.error("Login Error:", error);
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

        //token not found unauthorized
        if (!accessToken && !refreshToken) {
            return res.status(401).json({ message: "Tokens are missing. Unauthorized" });
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