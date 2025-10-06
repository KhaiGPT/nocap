import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const getStatus = (): number => {
      if (typeof err === "object" && err !== null) {
        const maybeAny = err as { status?: number; statusCode?: number };
        return maybeAny.status ?? maybeAny.statusCode ?? 500;
      }
      return 500;
    };

    const getMessage = (): string => {
      if (typeof err === "object" && err !== null && "message" in err) {
        const maybeMsg = (err as { message?: unknown }).message;
        return typeof maybeMsg === "string" ? maybeMsg : "Internal Server Error";
      }
      return "Internal Server Error";
    };

    const status = getStatus();
    const message = getMessage();

    res.status(status).json({ message });

    if (process.env.NODE_ENV !== "production") {
      // Log full error details in development only
      // eslint-disable-next-line no-console
      console.error(err);
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
