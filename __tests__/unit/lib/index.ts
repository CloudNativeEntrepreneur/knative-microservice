import pino from "pino";
import { microservice, healthcheck } from "../../../src/index";

jest.mock("register-server-handlers");
jest.mock("sourced-repo-typeorm", () => {
  return {
    Repository: jest.fn(),
    persistenceLayer: {
      connect: jest.fn(() => Promise.resolve(true)),
      disconnect: jest.fn(() => Promise.resolve(true)),
    },
  };
});

jest.mock("express", () => {
  const m: any = {
    __esModule: true,
    Router: jest.fn(() => ({
      use: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
    })),
  };

  m.default = jest.fn(() => ({
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    listen: jest.fn(() => ({
      close: jest.fn(),
    })),
    close: jest.fn(),
  }));
  m.default.urlencoded = jest.fn();
  m.default.json = jest.fn();

  return m;
});

jest.spyOn(process, "exit").mockImplementation(() => {
  return undefined as never;
});

describe("src/index.ts", () => {
  it("should start our service", async () => {
    const { server, logger, onListen, shutdown } = await microservice({
      handlers: { path: "path", options: { enableSyncSendToDenormalizer: true, enableEventPublishing: true } },
      logger: pino(),
    });
    expect(server.use).toBeCalledTimes(4);

    const { persistenceLayer } = await import("sourced-repo-typeorm");

    onListen(3000)();
    await shutdown(persistenceLayer)();

    expect(server.close).toBeCalled();
    expect(persistenceLayer.disconnect).toBeCalled();

  });
});

describe("healthcheck", () => {
  it("should respond with 200", () => {
    const send = jest.fn();
    const json = jest.fn();
    const reply = {
      status: jest.fn(() => ({
        send,
        json,
      })),
    };
    healthcheck({}, reply);
    expect(reply.status).toBeCalledWith(200);
    expect(send).toBeCalledWith("ok");
  });
});
