import jwt from "jsonwebtoken";
import type { Response } from "express";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET!;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;


export const generateAccessToken = (userId: string, userName: string, email: string): { refreshToken: string, accessToken: string } => {
    const accessToken = jwt.sign(
        { 
            userId, 
            username: userName, 
            email, 
            type: "access" 
        }, 
        ACCESS_TOKEN_SECRET, 
        { expiresIn: "15m" }
    );
    
    const refreshToken = jwt.sign(
        { 
            userId, 
            username: userName, 
            email, 
            type: "refresh" 
        }, 
        REFRESH_TOKEN_SECRET, 
        { expiresIn: "40d" }
    );

    return { accessToken, refreshToken };
}

