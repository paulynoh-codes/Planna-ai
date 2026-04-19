import express from "express";
import cors from "cors";
import morgan from "morgan";
import { env } from "./env.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { itinerariesRouter } from "./routes/itineraries.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";

export function createApp() {
  const app = express();
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN === "*" ? true : env.CLIENT_ORIGIN.split(",").map((s) => s.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "200kb" }));
  if (env.NODE_ENV !== "test") {
    app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
  }

  app.use("/", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/itinerary", itinerariesRouter); // singular for /generate
  app.use("/api/itineraries", itinerariesRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
