import { Elysia } from "elysia";
import { Logger, type LoggerType } from "../utils/logger.js";
import { validate } from "../utils/ajv.js";
import "../utils/env.js";

const logger = new Logger("ajv") as LoggerType;

const envConfig = {
  TOKEN: process.env.TOKEN,
  HOST: process.env.HOST,
  PORT: process.env.PORT,
  CLAWD_AGENT_ID: process.env.CLAWD_AGENT_ID,
  CLAWD_HOST: process.env.CLAWD_HOST,
  CLAWD_PORT: process.env.CLAWD_PORT,
  CLAWD_TOKEN: process.env.CLAWD_TOKEN,
};

if (!envConfig.TOKEN || !envConfig.TOKEN.trim()) {
  logger.error("TOKEN is required. Set env var TOKEN and restart.");
  process.exit(1);
}

const validated = validate(envConfig);
export const configObject = {
  token: validated.TOKEN,
  host: validated.HOST,
  port: validated.PORT,
  clawdAgentId: validated.CLAWD_AGENT_ID,
  clawdHost: validated.CLAWD_HOST,
  clawdPort: validated.CLAWD_PORT,
  clawdToken: validated.CLAWD_TOKEN
};

export const config = new Elysia()
  .state("config", configObject);
