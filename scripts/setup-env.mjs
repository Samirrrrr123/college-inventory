import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";

const secret = () => randomBytes(32).toString("hex");
const file = new URL("../.env", import.meta.url);
const content = [
  `POSTGRES_PASSWORD=${secret()}`,
  `ACCESS_SECRET=${secret()}`,
  `REFRESH_SECRET=${secret()}`,
  `SEED_PASSWORD=${secret()}`,
  "CLIENT_ORIGIN=http://127.0.0.1:8080",
  "NODE_ENV=development",
  "",
].join("\n");

try {
  await writeFile(file, content, { flag: "wx", mode: 0o600 });
  console.log(
    "Created .env with random local secrets. The test account password is SEED_PASSWORD in this file.",
  );
} catch (error) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "EEXIST"
  ) {
    console.log("The existing .env was preserved.");
  } else throw error;
}
