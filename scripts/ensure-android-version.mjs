import { readFile, writeFile } from "node:fs/promises";

const configPath = "android/twa-manifest.json";
const gradlePath = "android/app/build.gradle";

const config = JSON.parse(await readFile(configPath, "utf8"));
const expectedName = String(config.appVersionName ?? "").trim();
const expectedCode = Number(config.appVersionCode);

if (!expectedName || !Number.isInteger(expectedCode) || expectedCode < 1) {
  throw new Error("twa-manifest.json must define appVersionName and a positive integer appVersionCode");
}

let gradle = await readFile(gradlePath, "utf8");
const codePattern = /^(\s*)versionCode\s+\d+\s*$/m;
const match = gradle.match(codePattern);

if (!match) {
  throw new Error("Bubblewrap generated app/build.gradle without a versionCode declaration");
}

gradle = gradle.replace(/^\s*versionName\s+.*(?:\r?\n|$)/gm, "");
gradle = gradle.replace(
  codePattern,
  `$1versionCode ${expectedCode}\n$1versionName "${expectedName}"`,
);

const lines = gradle.split(/\r?\n/).map((line) => line.trim());
if (!lines.includes(`versionName "${expectedName}"`)) {
  throw new Error("Could not enforce expected Android versionName");
}
if (!lines.includes(`versionCode ${expectedCode}`)) {
  throw new Error("Could not enforce expected Android versionCode");
}

await writeFile(gradlePath, gradle);
console.log(`Android release metadata verified: versionName=${expectedName}, versionCode=${expectedCode}`);
