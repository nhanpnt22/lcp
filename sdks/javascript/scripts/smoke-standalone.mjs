import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";

const root = resolve(process.cwd());
const distDir = resolve(root, "dist");
const esmPath = resolve(distDir, "index.js");
const cjsPath = resolve(distDir, "index.cjs");
const dtsPath = resolve(distDir, "index.d.ts");
const browserCanonicalPath = resolve(distDir, "lcp-javascript-sdk.min.js");
const browserAliasPath = resolve(distDir, "browser.min.js");
const packageJsonPath = resolve(root, "package.json");
const packageVersion = JSON.parse(readFileSync(packageJsonPath, "utf8")).version;
const browserVersionedPath = resolve(distDir, `lcp-javascript-sdk-${packageVersion}.min.js`);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const file of [esmPath, cjsPath, dtsPath, browserCanonicalPath, browserVersionedPath, browserAliasPath]) {
  assert(existsSync(file), `Missing build artifact: ${file}`);
}

const esm = await import(pathToFileURL(esmPath).href);
assert(typeof esm.ReadThroughCacheEngine === "function", "ESM export ReadThroughCacheEngine missing");
assert(typeof esm.computeCacheKey === "function", "ESM export computeCacheKey missing");

const require = createRequire(import.meta.url);
const cjs = require(cjsPath);
assert(typeof cjs.ReadThroughCacheEngine === "function", "CJS export ReadThroughCacheEngine missing");
assert(typeof cjs.computeCacheKey === "function", "CJS export computeCacheKey missing");

const browserBundle = readFileSync(browserCanonicalPath, "utf8");
assert(browserBundle.includes("SdalpLocalCache"), "Browser bundle does not contain SdalpLocalCache global");

console.log("Standalone smoke check passed");
