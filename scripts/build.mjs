import { build } from "vite";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const { version } = JSON.parse(await readFile("package.json", "utf8"));
await mkdir("packages", { recursive: true });
const hashes = [];
for (const theme of ["sketchprobe", "win2000"]) {
  process.env.THEME = theme;
  await build();
  const manifest = JSON.parse(await readFile(`themes/${theme}/theme.json`, "utf8"));
  manifest.version = version;
  await writeFile(`themes/${theme}/theme.json`, JSON.stringify(manifest, null, 2) + "\n");
  const name = `xstatus-${theme}-${version}.tar.gz`;
  execFileSync("tar", ["-czf", `packages/${name}`, "-C", `themes/${theme}`, "theme.json", "preview.png", "dist"], { env: { ...process.env, COPYFILE_DISABLE: "1" } });
  hashes.push(`${createHash("sha256").update(await readFile(`packages/${name}`)).digest("hex")}  ${name}`);
}
await writeFile("packages/SHA256SUMS", hashes.join("\n") + "\n");
