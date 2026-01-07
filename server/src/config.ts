import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const projectRoot = path.resolve(__dirname, "..");

const normalizePath = (value: string, fallback: string) => {
  const target = value || fallback;
  return path.isAbsolute(target) ? target : path.join(projectRoot, target);
};

const port = Number(process.env.PORT ?? 5050);
const dbPath = normalizePath(process.env.DB_PATH ?? "", path.join("data", "dev.db"));
const uploadDir = normalizePath(process.env.UPLOAD_DIR ?? "", path.join("data", "uploads"));
const jwtSecret = process.env.JWT_SECRET ?? "change-me";
const authLogin = process.env.AUTH_LOGIN ?? "admin";
const authPassword = process.env.AUTH_PASSWORD ?? "admin";

fs.mkdirSync(path.dirname(dbPath), { recursive: true });
fs.mkdirSync(uploadDir, { recursive: true });

// Keep DATABASE_URL in sync for Prisma tooling while also supporting DB_PATH.
const databaseUrl = process.env.DATABASE_URL ?? `file:${dbPath}`;
process.env.DATABASE_URL = databaseUrl;

export const config = {
  port,
  dbPath,
  uploadDir,
  jwtSecret,
  databaseUrl,
  authLogin,
  authPassword,
};
