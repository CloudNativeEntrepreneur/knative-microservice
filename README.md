[![Release](https://github.com/CloudNativeEntrepreneur/knative-microservice/actions/workflows/release.yml/badge.svg)](https://github.com/CloudNativeEntrepreneur/knative-microservice/actions/workflows/release.yml)

# knative-microservice

Create an express server with handlers from a folder registered for cloudevents from KNative Eventing, logging set up, and a shutdown function.

## without persistence layer

```js
const { server, logger, onListen, shutdown } = await microservice({
  handlers: {
    path: "/handlers",
    options: {
      enableSyncSendToDenormalizer: true,
      enableEventPublishing: true,
    },
  },
  logger: pino(),
});

server.listen(port, onListen(port));
process.on("SIGTERM", shutdown());
```

## with persistence layer

```js
const connectionOptions = {
  type: "postgres" as const,
  url: sourced.psql.url,
  schema: sourced.psql.schema,
  synchronize: sourced.psql.synchronize,
  extra: {
    ssl: {
      rejectUnauthorized: sourced.psql.ssl.rejectUnauthorized,
    },
  },
};

logger.info({
  msg: "⏳ connecting to psql",
  sync: connectionOptions.synchronize,
  schema: connectionOptions.schema,
});
try {
  await persistenceLayer.connect(connectionOptions);
} catch (error) {
  logger.error({ msg: "🚨 Error connecting to psql", error });
  process.exit(1);
}
logger.info("✅ connected to psql");

const { server, shutdown, onListen } = await microservice({
  handlers: {
    path: handlersPath,
    options: {
      enableSyncSendToDenormalizer: config.enableSyncSendToDenormalizer,
      enableEventPublishing: config.enableEventPublishing,
    },
  },
  logger,
});

server.listen(port, onListen(port));

process.on("SIGTERM", shutdown(persistenceLayer));
```