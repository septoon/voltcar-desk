import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { config } from "../config";

export type RefreshTokenRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  last_used_at: string;
};

const dataPath = path.resolve(__dirname, "..", "..", "data", "refresh_tokens.json");

const ensureFile = async () => {
  await fs.mkdir(path.dirname(dataPath), { recursive: true });
  try {
    await fs.access(dataPath);
  } catch {
    await fs.writeFile(dataPath, "[]", "utf8");
  }
};

const readAll = async (): Promise<RefreshTokenRow[]> => {
  await ensureFile();
  const raw = await fs.readFile(dataPath, "utf8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeAll = async (items: RefreshTokenRow[]) => {
  await ensureFile();
  await fs.writeFile(dataPath, JSON.stringify(items, null, 2), "utf8");
};

export const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export const createRefreshToken = async (userId: string) => {
  const token = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const expires = new Date(now.getTime() + config.refreshTtlDays * 24 * 60 * 60 * 1000);
  const row: RefreshTokenRow = {
    id: crypto.randomUUID(),
    user_id: userId,
    token_hash: hashToken(token),
    expires_at: expires.toISOString(),
    revoked_at: null,
    created_at: now.toISOString(),
    last_used_at: now.toISOString(),
  };
  const items = await readAll();
  items.push(row);
  await writeAll(items);
  return { token, row };
};

export const rotateRefreshToken = async (oldToken: RefreshTokenRow, userId: string) => {
  await revokeRefreshToken(oldToken.id);
  return createRefreshToken(userId);
};

export const revokeRefreshToken = async (id: string) => {
  const items = await readAll();
  const idx = items.findIndex((r) => r.id === id);
  if (idx === -1) return;
  const now = new Date().toISOString();
  const updated: RefreshTokenRow = { ...items[idx]!, revoked_at: now };
  items[idx] = updated;
  await writeAll(items);
};

export const findValidRefreshToken = async (token: string) => {
  const items = await readAll();
  const hash = hashToken(token);
  const now = new Date();
  const row = items.find((r) => r.token_hash === hash && !r.revoked_at);
  if (!row) return null;
  if (new Date(row.expires_at) < now) return null;
  row.last_used_at = now.toISOString();
  await writeAll(items.map((r) => (r.id === row.id ? row : r)));
  return row;
};
