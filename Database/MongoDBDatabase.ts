import mongoose from 'mongoose';


const MONGODB_USERNAME = process.env.MONGODB_USERNAME || 'admin';
const MONGODB_PASSWORD = process.env.MONGODB_PASSWORD || 'password';
const MONGODB_URL = `mongodb+srv://${MONGODB_USERNAME}:${MONGODB_PASSWORD}@cluster0.0rxobuf.mongodb.net/`;


export default async function intializeMongoDB() : Promise<void> {
    try{
        await mongoose.connect(MONGODB_URL);
        console.log("MongoDB connected successfully");
    }
    catch(error){
        throw error;
    }
}