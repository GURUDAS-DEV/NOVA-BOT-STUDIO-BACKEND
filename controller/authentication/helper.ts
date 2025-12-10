import type { Response } from "express";
import { generateAccessToken } from "../../utils/JWT/GenerateTokens.js";
import { compare } from "bcrypt-ts";
import { supabase } from "../../Database/postgresql.js";
import { verifyRefreshToken } from "../../utils/JWT/ValidateToken.js";

export function generateOTP(length: number = 6): string {
  let otp = "";
  const digits = "0123456789";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * digits.length);
    otp += digits[randomIndex];
  }

  return otp;
}


export const helperForRefreshTokenOnly = async (refreshToken: string, sessionId: string, res: Response): Promise<Response> => {
  //verify refresh token
  const refreshPayload = verifyRefreshToken(refreshToken);

  //if refresh token is invalid
  if (refreshPayload === null) {
    return res.status(401).json({ message: "Invalid refresh token. Unauthorized" });
  }

  //check refresh token in db
  const { data: hashedRefreshToken, error } = await supabase.from("session").select("refreshToken, expiredAt, userId, revoked").eq("sessionId", sessionId).maybeSingle();

  //if refresh token not found in db
  if (error || !hashedRefreshToken) {
    return res.status(401).json({ message: "Refresh token not found in database. Unauthorized" });
  }

  if(hashedRefreshToken.revoked) {
    return res.status(401).json({ message: "Refresh token has been revoked. Unauthorized" });
  }

  //compare refresh token
  const isRefreshTokenValid = await compare(refreshToken, hashedRefreshToken.refreshToken);
  if (!isRefreshTokenValid) {
    return res.status(401).json({ message: "Refresh token mismatch. Unauthorized" });
  }

  //check userId match
  if(refreshPayload.userId !== hashedRefreshToken.userId) {
    return res.status(401).json({ message: "Refresh token user mismatch. Unauthorized" });
  }

  //check refresh token expiration
  if (new Date() > new Date(hashedRefreshToken.expiredAt)) {
    res.clearCookie("refreshToken");
    res.clearCookie("sessionId");
    res.clearCookie("accsessToken");
    return res.status(401).json({ message: "Refresh token has expired. Please login again." });
  }

  //generate new access token
  const newAccessToken = generateAccessToken(refreshPayload.userId, refreshPayload.username, refreshPayload.email).accessToken;

  //set new access token in cookie
  res.cookie("accessToken", newAccessToken, {
    httpOnly: true,
    secure: false, // Must be false for localhost HTTP
    sameSite: "lax" as const, // 'lax' works for same-site localhost requests
    path: "/",
    maxAge: 15 * 60 * 1000
  });

  //return success response
  return res.status(200).json({ 
    message: "Authenticated",
    userId: refreshPayload.userId,
    username: refreshPayload.username,
    email: refreshPayload.email
  });
}