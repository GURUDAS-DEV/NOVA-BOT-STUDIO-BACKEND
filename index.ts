import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { intializeDB } from './Database/PostgreSQLDatabase.js';
import dotenv from 'dotenv';
import authenticationRouter from './Router/Authentication/router.js';
import intializeMongoDB from './Database/MongoDBDatabase.js';
import BotManagementRouter from './Router/Bot_Management/router.js';
import aiFeatureManagementRouter from './Router/AI_Feature_Management/router.js';
import { BotConfigrationRouter } from './Router/Bot_Configration/router.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 9000;

const allowedOrigins = ['http://localhost:3000'];

// CORS must be first - before any other middleware
app.use(cors({
    origin: allowedOrigins,
    credentials: true,
}));

// Then cookie parser and body parsers
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

await intializeDB();
await intializeMongoDB();

app.use("/api/auth/", authenticationRouter);
app.use("/api/bot/", BotManagementRouter);
app.use("/api/aiFeatures/", aiFeatureManagementRouter);
app.use("/api/botConfig/", BotConfigrationRouter);
app.get("/ping", (req, res) => {
    res.status(200).json({ message: "Pong!" });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});