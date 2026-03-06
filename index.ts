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
import TestingRouter from './Router/Testing/router.js';
import advanceBotRouter from './Router/Advance_Bot_Management/router.js';
import APIKeyRouter from './Router/API_Key_Management/router.js';
import { getRedisClient } from './Redis/connect.js';
import communcationWithBotRouter from './Router/CommunicationWithBot/Website/router.js';
import { botAnalyticsRouter } from './Router/BotAnalytics/router.js';
import { deleteScheduler } from './Schedulers/DeleteBotScheduler.js';
import TelegramBotRouter from './Router/Telegram/router.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 9000;

const allowedOrigins = ['http://localhost:3000', 'http://localhost:5173',];

// CORS must be first - before any other middleware
app.use("/api",cors({
    origin: allowedOrigins,
    credentials: true,
}));

app.use("/v1", cors({
    origin: "*",
    credentials : false,
}))

// Then cookie parser and body parsers
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

await intializeDB();
await intializeMongoDB();
deleteScheduler.start();

const redis = getRedisClient();

app.use("/api/auth/", authenticationRouter);
app.use("/api/bot/", BotManagementRouter);
app.use("/api/aiFeatures/", aiFeatureManagementRouter);
app.use("/api/botConfig/", BotConfigrationRouter);
app.use("/api/advanceBotController", advanceBotRouter);
app.use("/api/APIKeyManagement", APIKeyRouter);
app.use("/api/botAnalytics", botAnalyticsRouter)
app.use("/api/Telegram", TelegramBotRouter);

//communcation with website bot : 
app.use("/v1/websiteBot/", communcationWithBotRouter);

app.get("/ping", (req, res) => {
    res.status(200).json({ message: "Pong!" });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});