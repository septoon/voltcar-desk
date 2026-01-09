import { Router } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { createRefreshToken, findValidRefreshToken, rotateRefreshToken, revokeRefreshToken } from "../services/refreshStore";

export const authRouter = Router();

const signAccess = (subject: string) =>
  jwt.sign(
    { sub: subject },
    config.jwtSecret as jwt.Secret,
    { expiresIn: config.accessTtl } as jwt.SignOptions
  );

authRouter.post("/login", (req, res) => {
  const { login, password } = req.body as { login?: string; password?: string };
  if (login !== config.authLogin || password !== config.authPassword) {
    return res.status(401).json({ error: "Неверный логин или пароль" });
  }

  const accessToken = signAccess(config.authLogin);
  createRefreshToken(config.authLogin)
    .then(({ token, row }) => {
      res.cookie("refresh_token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/api/auth",
        maxAge: config.refreshTtlDays * 24 * 60 * 60 * 1000,
      });
      res.json({ accessToken, refreshId: row.id });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: "Не удалось выдать токен" });
    });
});

authRouter.get("/me", (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  if (!token) return res.status(401).json({ error: "Нет токена" });
  try {
    jwt.verify(token, config.jwtSecret);
    return res.json({ login: config.authLogin });
  } catch {
    return res.status(401).json({ error: "Неверный токен" });
  }
});

authRouter.post("/refresh", async (req, res) => {
  const refresh = req.cookies?.refresh_token as string | undefined;
  if (!refresh) return res.status(401).json({ error: "Нет refresh токена" });
  try {
    const row = await findValidRefreshToken(refresh);
    if (!row) return res.status(401).json({ error: "Неверный refresh токен" });
    const { token: newToken, row: newRow } = await rotateRefreshToken(row, row.user_id);
    const accessToken = signAccess(row.user_id);
    res.cookie("refresh_token", newToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/api/auth",
      maxAge: config.refreshTtlDays * 24 * 60 * 60 * 1000,
    });
    return res.json({ accessToken, refreshId: newRow.id });
  } catch (err) {
    console.error(err);
    return res.status(401).json({ error: "Неверный refresh токен" });
  }
});

authRouter.post("/logout", async (req, res) => {
  const refresh = req.cookies?.refresh_token as string | undefined;
  if (refresh) {
    const row = await findValidRefreshToken(refresh);
    if (row) {
      await revokeRefreshToken(row.id);
    }
  }
  res.clearCookie("refresh_token", { path: "/api/auth" });
  res.status(200).json({ ok: true });
});
