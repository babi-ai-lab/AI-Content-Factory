import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconDir = path.join(root, "public", "icons");
await mkdir(iconDir, { recursive: true });

const regular = await readFile(path.join(iconDir, "app-icon.svg"));
const maskable = await readFile(path.join(iconDir, "app-icon-maskable.svg"));

const outputs = [
  { input: regular, name: "app-icon-192.png", size: 192 },
  { input: regular, name: "app-icon-512.png", size: 512 },
  { input: maskable, name: "app-icon-maskable-512.png", size: 512 },
  { input: regular, name: "play-store-icon.png", size: 512 },
];

await Promise.all(outputs.map(({ input, name, size }) =>
  sharp(input, { density: 384 })
    .resize(size, size, { fit: "contain" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(iconDir, name))
));

for (const { name, size } of outputs) {
  console.log(`Generated ${name} (${size}x${size})`);
}
