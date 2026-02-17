import { chromium, type Browser } from "playwright";


export const scrapingRawHTML = async (url: string): Promise<string> => {

    let browser: Browser | null = null;

    try {
        browser = await chromium.launch({
            headless: true,
        });

        const page = await browser.newPage();

        await page.goto(url, {
            timeout: 30000,
            waitUntil: "networkidle",
        });

        // Wait for React hydration
        await page.waitForTimeout(3000);

        const text = await page.evaluate(() => {
            return document.body?.innerText || "";
        });

        return text;

    } catch (e) {
        throw new Error(`Error scraping website: ${e}`);
    } finally {
        await browser?.close();
    }
};
