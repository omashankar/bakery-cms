import { readFileSync, readdirSync } from "fs";
import { join } from "path";

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
      walk(full, files);
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const root = new URL("..", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
const urls = new Set();
for (const file of walk(root)) {
  const text = readFileSync(file, "utf8");
  for (const match of text.matchAll(/https:\/\/images\.unsplash\.com\/[^"'`\s)]+/g)) {
    urls.add(match[0]);
  }
}

for (const url of [...urls].sort()) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok) console.log(`${res.status} ${url}`);
  } catch {
    console.log(`ERR ${url}`);
  }
}
