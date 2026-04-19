import { createApp } from "./app.js";
import { connectDb } from "./db.js";
import { env } from "./env.js";
import { logger } from "./logger.js";

async function main() {
  await connectDb();
  const app = createApp();
  app.listen(env.PORT, () => {
    logger.info(`api listening on :${env.PORT}`);
  });
}

main().catch((err) => {
  logger.error({ err }, "fatal boot error");
  process.exit(1);
});
