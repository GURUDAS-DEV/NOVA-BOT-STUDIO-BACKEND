import type { JwtPayload } from "jsonwebtoken";
import jwt from "jsonwebtoken";

interface CustomPayload extends JwtPayload {
    userId: string;
    email: string;
    username: string;
}

export const verifyAccessToken = (token: string): CustomPayload | null => {
    try {
        const payload = jwt.verify(
            token,
            process.env.ACCESS_TOKEN_SECRET!
        ) as CustomPayload;


        return payload;
    } catch (err) {
        return null;
    }
};

export const verifyRefreshToken = (token: string): CustomPayload | null => {
    try {
        const payload = jwt.verify(
            token,
            process.env.REFRESH_TOKEN_SECRET!
        ) as CustomPayload;


        return payload;
    } catch (err) {
        return null;
    }
};
