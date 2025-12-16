import type { Request, Response, NextFunction } from "express";
import { supabase } from "../Database/postgresql.js";
import { compare } from "bcrypt-ts";
import jwt from "jsonwebtoken";
import { generateAccessToken } from "../utils/JWT/GenerateTokens.js";


interface ACCESS_PAYLOAD {
    userId: string;
    username: string;
    email: string;
    type: string;
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const { refreshToken, accessToken, sessionId } = req.cookies;

    if (!sessionId || !refreshToken) {
        return res.status(401).json({ message: "Unauthorized: No session ID provided" });
    }
    

    try {
        if (accessToken) {
            try {
                const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET as string) as ACCESS_PAYLOAD;
                const { userId, username, email, type } = decoded;

                if (type !== "access") {
                    return res.status(401).json({ message: "Unauthorized: Invalid access token" });
                }

                (req as any).user = {
                    userId,
                    username,
                    email
                }
                
                return next();
            }
            catch (err) {
                return res.status(401).json({ message: "Unauthorized: Invalid access token" });
            }
        }

        const { data, error } = await supabase.from("session").select("userId, refreshToken, expiredAt, revoked").eq("sessionId", sessionId).single();

        if (error || !data) {
            return res.status(401).json({ message: "Unauthorized: Invalid session! Refresh Token not in DB" });
        }

        if (data.revoked) {
            return res.status(401).json({ message: "Unauthorized: Session has been revoked" });
        }

        if (new Date(data.expiredAt) < new Date()) {
            return res.status(401).json({ message: "Unauthorized: Session has expired! refreshToken expired" });
        }

        const isRefreshTokenValid = await compare(refreshToken, data.refreshToken);
        if (!isRefreshTokenValid) {
            return res.status(401).json({ message: "Unauthorized: Invalid refresh token! Refresh Token not match" });
        }

        const decodedRefresh = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET as string) as ACCESS_PAYLOAD;
        const { userId, username, email } = decodedRefresh;

        const { accessToken: newAccessToken } = generateAccessToken(userId, username, email);
        res.cookie("accessToken", newAccessToken, { httpOnly: true, secure: false, sameSite: "lax" as const, path: "/" });

        (req as any).user = {
            userId,
            username,
            email
        }
        return next();

    }
    catch (e) {
        console.log("Auth Middleware Error:", e);
        return res.status(500).json({ message: "Internal Server Error", error: e });
    }
}