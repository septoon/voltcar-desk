import { prisma } from "./prisma";

export const ensureDatabase = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Ticket" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "customerName" TEXT NOT NULL,
      "vehicle" TEXT,
      "service" TEXT,
      "totalCents" INTEGER NOT NULL,
      "notes" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
};
