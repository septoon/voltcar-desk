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
const accessTtl = process.env.ACCESS_TTL ?? "15m";
const refreshTtlDays = Number(process.env.REFRESH_TTL_DAYS ?? 30);
const defaultCorsOrigins = [
  "*", // allow any origin (with credentials the origin will be echoed back)
  "https://crm.lumastack.ru",
  "http://localhost:3000",
  "http://localhost:5173",
  "tauri://localhost",
];
const corsOrigins = (process.env.CORS_ORIGINS ?? defaultCorsOrigins.join(","))
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);
const cookieDomain = process.env.COOKIE_DOMAIN || undefined;
const cookieSameSite = (process.env.COOKIE_SAMESITE as "lax" | "none" | "strict" | undefined) ?? (process.env.NODE_ENV === "production" ? "none" : "lax");
const cookieSecure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production";

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
  accessTtl,
  refreshTtlDays,
  corsOrigins,
  cookieDomain,
  cookieSameSite,
  cookieSecure,
};
