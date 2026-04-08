import { execFileSync } from "node:child_process";

const args = process.argv.slice(2).filter((arg) => arg !== "--");
const mode = args[0] ?? "dev";

if (mode !== "dev" && mode !== "gate") {
  console.error(`Unsupported rs-check mode: ${mode}`);
  console.error("Usage: node ./scripts/rs-check.mjs [dev|gate]");
  process.exit(1);
}

const fmtArgs = mode === "gate" ? ["fmt", "--check"] : ["fmt"];

execFileSync("cargo", fmtArgs, {
  cwd: "src-tauri",
  stdio: "inherit",
});

execFileSync("cargo", ["check", "-p", "mtga-tauri"], {
  cwd: "src-tauri",
  stdio: "inherit",
});
