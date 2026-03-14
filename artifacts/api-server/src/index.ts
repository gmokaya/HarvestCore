import app from "./app";
import { seedPlatformAccounts } from "./services/seed-platform";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, async () => {
  console.log(`Server listening on port ${port}`);
  try {
    await seedPlatformAccounts();
    console.log("[seed] Platform accounts and liquidity pools ready");
  } catch (err) {
    console.error("[seed] Warning: seeding failed", err);
  }
});
