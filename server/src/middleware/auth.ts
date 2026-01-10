import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
  const token = bearer || (req.cookies?.access_token as string | undefined);

  if (!token) {
    return res.status(401).json({ error: "Требуется авторизация" });
  }

  try {
    jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ error: "Неверный или истёкший токен" });
  }
};
