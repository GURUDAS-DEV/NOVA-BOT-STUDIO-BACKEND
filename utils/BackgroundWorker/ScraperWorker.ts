import { Worker } from 'bullmq';
import { updateScrapingStatus } from './HelperFunction/updateScrapingStatus.js';
import { scrapingRawHTML } from './HelperFunction/ScrapingRawHTML.js';
import { creatingChunk } from './HelperFunction/creatingChunk.js';
import { generateEmbeddings } from './HelperFunction/generateEmbeddings.js';
import { connection } from '../BullMQ/BullMq.js';
import intializeMongoDB from '../../Database/MongoDBDatabase.js';
import { supabase } from '../../Database/postgresql.js';
import { Resend } from "resend";
import { buildScrapingDoneEmail } from '../../Email/ScrappingDoneEmail.js';
import { buildScrapingFailEmail } from '../../Email/ScrappingFailEmail.js';

const bootstrapWorker = async (): Promise<void> => {
    await intializeMongoDB();

    const worker = new Worker('scrapeWebsite',
        async (job) => {
            const { url, userId, botId } = job.data;
            const resend = new Resend(process.env.RESEND_MAIL_API_KEY);

            const markFailed = async (reason: string): Promise<void> => {
                await updateScrapingStatus(botId, "failed");
                await resend.emails.send({
                    from: "NOVA <onboarding@resend.dev>",
                    to: "gursad5@gmail.com",
                    subject: "Nova Bot Studio - Scraping Failed",
                    html: buildScrapingFailEmail(url, reason),
                });
            };

            try {
                // 1) Update the scraping status to "running" in the database
                await updateScrapingStatus(botId, "running");

                // 2) scraping website using playwright
                const rawHTML = await scrapingRawHTML(url);

                // 3) normalizing it
                const normalizedText = normalizeText(rawHTML);

                if (!normalizedText) {
                    await markFailed(`Scraping finished but no readable text was found for the URL: ${url}.`);
                    return;
                }

                // 4) creating chunk
                const chunks: string[] = creatingChunk(normalizedText).filter((chunk) => chunk.length > 0);

                if (chunks.length === 0) {
                    await markFailed(`Scraping produced text but chunking failed for the URL: ${url}.`);
                    return;
                }

                // 5) generating embedding
                const embeddings = await generateEmbeddings(chunks);

                //6) store embedding with botId for RAG filtering
                const { data, error } = await supabase.from("embeddingstorage").insert({
                    botId: botId,
                    content: chunks,
                    embedding: embeddings, // must be number[]
                });

                if (error) {
                    await markFailed(`Unable to store embeddings for the URL: ${url}. ${error.message}`);
                    return;
                }

                // 7) Update the scraping status to "completed" in the database
                await updateScrapingStatus(botId, "completed");

                // 8) Send email notification
                await resend.emails.send({
                    from: "NOVA <onboarding@resend.dev>",
                    to: "gursad5@gmail.com",
                    subject: "Nova Bot Studio - Scraping Completed",
                    html: buildScrapingDoneEmail(url),
                }); 
            }
            catch (e) {
                const message = e instanceof Error ? e.message : String(e);
                await markFailed(`Unexpected failure while processing the URL: ${url}. ${message}`);
            }
        }, {
        connection: connection,
        concurrency: 2,
    }
    );

    worker.on('error', async (error) => {
        const message = error instanceof Error ? error.message : String(error);
        await updateScrapingStatus("unknown", "failed");
        await new Resend(process.env.RESEND_MAIL_API_KEY).emails.send({
            from: "NOVA <onboarding@resend.dev>",
            to: "gursad5@gmail.com",
            subject: "Nova Bot Studio - Scraper Worker Error",
            html: buildScrapingFailEmail("unknown", `Worker-level failure: ${message}`),
        });
    });

    worker.on('failed', async (job, error) => {
        const url = job?.data?.url ?? "unknown";
        const botId = job?.data?.botId ?? "unknown";
        const message = error instanceof Error ? error.message : String(error);
        if (botId !== "unknown") {
            await updateScrapingStatus(botId, "failed");
        }
        await new Resend(process.env.RESEND_MAIL_API_KEY).emails.send({
            from: "NOVA <onboarding@resend.dev>",
            to: "gursad5@gmail.com",
            subject: "Nova Bot Studio - Scraping Failed",
            html: buildScrapingFailEmail(url, `Job failed after retries: ${message}`),
        });
    });
};

bootstrapWorker().catch((error) => {
    console.error('Failed to bootstrap scraper worker:', error);
    process.exit(1);
});

function normalizeText(text: string): string {
    return text
        .replace(/\s+/g, " ")      // collapse multiple spaces
        .replace(/\n+/g, "\n")     // collapse newlines
        .trim();
}
