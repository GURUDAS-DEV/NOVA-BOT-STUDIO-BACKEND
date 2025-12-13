
export interface Session {
    userId: string;
    refreshToken: string;
    ip: string | null;
    userAgent: string;
    expiredAt: string;
    revoked: boolean;
}