import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../generated/prisma/client";
import { config } from "../config";

const adapter = new PrismaLibSql({
  url: config.databaseUrl,
});

export const prisma = new PrismaClient({ adapter });
