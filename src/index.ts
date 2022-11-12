import express, { Router } from "express";
import pinoLoggerMiddleware from "express-pino-logger";
import { registerHandlers } from "register-server-handlers";

// input is an object with the following properties:
// - handlers: an object with the following properties:
//   - path: a string representing the path to the handlers directory
//   - options: an object with the following properties:
//     - enableSyncSendToDenormalizer: a boolean representing whether to enable sync send to denormalizer
//     - enableEventPublishing: a boolean representing whether to enable event publishing
// they are typed with TypeScript types
export const microservice = async (input: {
  handlers: {
    path: string;
    options: {
      enableSyncSendToDenormalizer: boolean;
      enableEventPublishing: boolean;
    };
  };
  logger;
}) => {
  const { handlers, logger } = input;

  const { path, options } = handlers;
  const { enableSyncSendToDenormalizer, enableEventPublishing } = options;

  const pinoLogger = pinoLoggerMiddleware({ logger });
  const server = express();

  // parse application/x-www-form-urlencoded
  server.use(express.urlencoded({ extended: false }));
  // parse application/json
  server.use(express.json({ limit: "50mb" }));

  const healthRouter = Router();
  const appRouter = Router();
  // enable request logging
  appRouter.use(pinoLogger);

  healthRouter.get("/", healthcheck);
  server.use("/health", healthRouter);

  logger.info(`⏳ registering server handlers from ${path}`);
  // register handlers as HTTP Post handlers
  await registerHandlers({
    server: appRouter,
    path,
    handlerOptions: {
      sync: enableSyncSendToDenormalizer,
      enableEventPublishing: enableEventPublishing,
    },
  });

  logger.info(`⏳ registering server cloud event handlers from ${path}`);
  // register handlers as KNative Cloud Event Handlers
  await registerHandlers({
    server: appRouter,
    path,
    cloudevents: true,
    serverPath: "/cloudevent/",
    handlerOptions: {
      sync: false,
      enableEventPublishing: enableEventPublishing,
    },
  });

  server.use("/", appRouter);

  logger.info(`✅ handlers registered`);

  return {
    server,
    logger,
    onListen: onListen(logger),
    shutdown: shutdown(server)(logger),
  };
};

const onListen = (logger) => (port) => () => {
  logger.info(`🚀 Server listening on port ${port}`);
};

const shutdown = (server) => (logger) => (persistenceLayer) => async () => {
  logger.info("🛑 Received SIGTERM, shutting down...");
  if (server && server.close) {
    await server.close();
    logger.info("🛑 Server closed");
  }
  if (persistenceLayer && persistenceLayer.disconnect) {
    await persistenceLayer.disconnect();
    logger.info("🛑 Disconnected from PSQL");
  }
  logger.info("🛑 Exiting...");
  return process.exit(0);
};

export const healthcheck = (request, response) => {
  response.status(200).send("ok");
};
