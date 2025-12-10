import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { intializeDB } from './Database/Database.js';
import dotenv from 'dotenv';
import authenticationRouter from './Router/Authentication/router.js';
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


app.use("/api/auth/", authenticationRouter);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});