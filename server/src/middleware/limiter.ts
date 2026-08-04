import dotenv from "dotenv";
import path from "node:path";
import rateLimit from "express-rate-limit";
import type { NextFunction, Request, Response } from "express";

const envPath = path.resolve(__dirname, "..", "..", ".env");
dotenv.config({ path: envPath });

const shouldDisableRateLimit = (): boolean => {
  const value = (process.env.DISABLE_RATE_LIMIT ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(value);
};

const baseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests from this IP, please try again after 15 minutes",
});

const limiter = (req: Request, res: Response, next: NextFunction) => {
  if (shouldDisableRateLimit()) {
    return next();
  }

  return baseLimiter(req, res, next);
};

export { limiter };
