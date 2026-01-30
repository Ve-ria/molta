import { Elysia } from "elysia";
import { Logger, type LoggerType } from "./utils/logger.js";
import { openapi, fromTypes } from "@elysiajs/openapi"
import { node } from "@elysiajs/node"
import { route } from "./router.js";
import "./utils/env.js";
import { configObject } from "./services/config.js";

const elysia = new Elysia({ adapter: node() });

const logger = new Logger("app") as LoggerType;

elysia
  .use(route)
  .use(openapi({
    references: fromTypes() 
  }))

elysia.listen(
  { hostname: configObject.host, port: configObject.port },
  () => {
    logger.info(`Server started on http://${configObject.host}:${configObject.port}`);
  }
);

logger.info("Initialized server successfully")

