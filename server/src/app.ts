import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { config } from "./config";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";
import { ordersRouter } from "./routes/orders";
import { ticketsRouter } from "./routes/tickets";
import { servicesRouter } from "./routes/services";
import { appointmentsRouter } from "./routes/appointments";
import { filesRouter } from "./routes/files";
import { requireAuth } from "./middleware/auth";

const configuredOrigins = config.corsOrigins.filter(Boolean);
const allowAnyOrigin = configuredOrigins.includes("*");
const explicitOrigins = configuredOrigins.filter((item) => item !== "*");

export const createApp = () => {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowAnyOrigin) return callback(null, true);
        if (explicitOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    }),
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(morgan("dev"));

  app.use("/uploads", requireAuth, express.static(config.uploadDir));
  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use(requireAuth);
  app.use("/api/files", filesRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/tickets", ticketsRouter);
  app.use("/api/services", servicesRouter);
  app.use("/api/appointments", appointmentsRouter);

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
};
