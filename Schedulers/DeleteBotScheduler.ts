import nodeCron from "node-cron";
import { BotStructureModel } from "../Models/BotStructure.js";
import { ControlledBotModel } from "../Models/ControlledBotSchema.js";

const DAYS_TO_KEEP_DELETED = 30;

const deleteBotsOlderThanRetention = async () => {
    try {
        const cutoffDate = new Date(Date.now() - DAYS_TO_KEEP_DELETED * 24 * 60 * 60 * 1000);

        const botStructureResult = await BotStructureModel.deleteMany({
            status: "deleted",
            deleted_at: { $lte: cutoffDate },
        });

        const controlledBotResult = await ControlledBotModel.deleteMany({
            status: "deleted",
            deleted_at: { $lte: cutoffDate },
        });

        const totalDeleted = botStructureResult.deletedCount + controlledBotResult.deletedCount;
        if (totalDeleted > 0) {
            console.log(
                `DeleteBotScheduler removed ${totalDeleted} bots older than ${DAYS_TO_KEEP_DELETED} days.`
            );
        }
    } catch (error) {
        console.error("Error in delete scheduler:", error);
    }
};

export const deleteScheduler = nodeCron.schedule("0 0 * * *", deleteBotsOlderThanRetention, {
    timezone: "UTC",
});