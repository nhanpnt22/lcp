import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cacheRoot = path.resolve(__dirname, "..");

const uatUrl = pathToFileURL(path.join(cacheRoot, "examples", "lcp-uat.html")).href;
const simpleUrl = pathToFileURL(path.join(cacheRoot, "examples", "simple-cache.html")).href;

function hasText(value, text) {
  return typeof value === "string" && value.includes(text);
}

async function runLcpUat(page) {
  await page.goto(uatUrl, { waitUntil: "load" });

  await page.waitForFunction(
    () => {
      const summary = document.getElementById("summary")?.textContent ?? "";
      return summary.includes("UAT PASSED") || summary.includes("UAT FAILED");
    },
    { timeout: 60000 }
  );

  const summary = (await page.textContent("#summary"))?.trim() ?? "";
  if (!hasText(summary, "UAT PASSED")) {
    const failedItems = await page.$$eval("#results li", (items) =>
      items
        .map((item) => item.textContent ?? "")
        .filter((line) => line.startsWith("FAIL"))
    );

    const details = failedItems.length > 0 ? ` | failures=${failedItems.join("; ")}` : "";
    throw new Error(`lcp-uat failed: ${summary}${details}`);
  }

  const resultLines = await page.$$eval("#results li", (items) => items.map((item) => item.textContent ?? ""));
  const failedAcLines = resultLines.filter((line) => line.startsWith("FAIL - AC-"));
  if (failedAcLines.length > 0) {
    throw new Error(`lcp-uat AC failures: ${failedAcLines.join("; ")}`);
  }

  const passedAcIds = new Set(
    resultLines
      .map((line) => {
        const match = line.match(/^PASS - (AC-\d{2})\b/);
        return match ? match[1] : undefined;
      })
      .filter(Boolean)
  );

  const expectedAcIds = Array.from({ length: 15 }, (_, index) => `AC-${String(index + 1).padStart(2, "0")}`);
  const missingAcIds = expectedAcIds.filter((acId) => !passedAcIds.has(acId));
  if (missingAcIds.length > 0) {
    throw new Error(`lcp-uat missing AC coverage: ${missingAcIds.join(", ")}`);
  }

  console.log(`[browser-uat] PASS lcp-uat: ${summary}`);
}

async function runSimpleCacheSelfTest(page) {
  await page.goto(simpleUrl, { waitUntil: "load" });
  await page.click("#runSelfTest");

  await page.waitForFunction(
    () => {
      const summary = document.getElementById("summary")?.textContent ?? "";
      return summary.includes("SELF-TEST PASSED") || summary.includes("SELF-TEST FAILED");
    },
    { timeout: 60000 }
  );

  const summary = (await page.textContent("#summary"))?.trim() ?? "";
  if (!hasText(summary, "SELF-TEST PASSED")) {
    throw new Error(`simple-cache self-test failed: ${summary}`);
  }

  console.log(`[browser-uat] PASS lcp-simple-cache: ${summary}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on("pageerror", (error) => {
    console.error(`[browser-uat] page error: ${error.message}`);
  });

  try {
    await runLcpUat(page);
    await runSimpleCacheSelfTest(page);
    console.log("[browser-uat] PASS all browser UAT checks");
  } finally {
    await context.close();
    await browser.close();
  }
}

try {
  await main();
} catch (error) {
  console.error(`[browser-uat] FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
