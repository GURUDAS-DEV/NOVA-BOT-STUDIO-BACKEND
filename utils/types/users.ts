export interface userSchema{
    id : string;
    username : string;
    email : string;
    password : string;
    OTP : string | null;
    OTP_Expiry : string | null;
    avatar : string | null;
    created_at : string | null;
    updated_at : string | null;
    google_id ?: string | null;
    github_id ?: string | null;
    verified : boolean;
    auth_provider : 'custom' | 'google' | 'github';
};