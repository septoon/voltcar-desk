import { Router } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
  const { login, password } = req.body as { login?: string; password?: string };
  if (login === config.authLogin && password === config.authPassword) {
    const token = jwt.sign({ sub: config.authLogin }, config.jwtSecret, { expiresIn: "1d" });
    return res.json({ token });
  }
  return res.status(401).json({ error: "Неверный логин или пароль" });
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
