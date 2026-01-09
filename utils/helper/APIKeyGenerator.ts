import crypto from 'crypto';

export function generateAPIKey(prefix : string = "nbs_") : string{
    const randomPart = crypto.randomBytes(32).toString("hex");
    return `${prefix}${randomPart}`;
}