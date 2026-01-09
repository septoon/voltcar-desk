import { createApp } from "./app";
import { config } from "./config";
import { ensureDatabase } from "./lib/bootstrap";
import { prisma } from "./lib/prisma";

const start = async () => {
  await prisma.$connect();
  await ensureDatabase();
  console.log(`Database ready at ${config.dbPath}`);

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`Server listening on https://api.crm.lumastack.ru:${config.port}`);
  });
};

start().catch(async (error) => {
  console.error("Failed to start server", error);
  await prisma.$disconnect();
  process.exit(1);
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
