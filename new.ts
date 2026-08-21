import { chromium } from "playwright";
import fs from "fs";

async function extract() {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    await page.goto("https://your-site.framer.website");

    const structure = await page.evaluate(() => {
        const sections = Array.from(document.querySelectorAll("section, header, main, footer"));

        return sections.map((section) => {
            const headings = Array.from(section.querySelectorAll("h1,h2,h3"))
                .map(h => h.textContent?.trim());

            const buttons = Array.from(section.querySelectorAll("button,a"))
                .map(b => b.textContent?.trim());

            return {
                tag: section.tagName,
                headings: headings.filter(Boolean),
                buttons: buttons.filter(Boolean),
            };
        });
    });

    fs.writeFileSync(
        "framer-output.txt",
        JSON.stringify(structure, null, 2),
        "utf-8"
    );

    console.log("✅ Saved to framer-output.txt");

    await browser.close();
}

extract();