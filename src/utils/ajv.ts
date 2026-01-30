import { Ajv } from 'ajv';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Logger, type LoggerType } from "./logger.js";
import "./env.js";

const logger = new Logger("ajv") as LoggerType;

interface EnvFormat {
  TOKEN: string;
  HOST?: string;
  PORT?: number;
  CLAWD_CONFIG_PATH?: string;
  CLAWD_AGENT_ID?: string;
  CLAWD_HOST?: string;
  CLAWD_PORT?: number;
  CLAWD_TOKEN?: string;
}

export function validate(obj: object): EnvFormat {
  try {
    const schemaPath = resolve(process.cwd(), 'schema.json');
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

    const ajv = new Ajv({
      allErrors: true,
      coerceTypes: true,
      useDefaults: true
    });

    const validate = ajv.compile(schema);
    const data = { ...obj };

    if (!validate(data)) {
      const errors = validate.errors?.map(err => {
        const path = err.instancePath ? err.instancePath.substring(1) : 'root';
        return `- ${path}: ${err.message}`;
      }).join('\n');
      
      logger.error(`Validation failed:\n${errors}`)
      throw new Error(`Validation failed:\n${errors}`);
    }

    logger.info("Validation passed")
    return data as EnvFormat;
  } catch (error) {
    if ((error as { code: string }).code === 'ENOENT') {
      const schemaPath = resolve(process.cwd(), 'schema.json');
      logger.error(`Schema file not found at: ${schemaPath}`)
      throw new Error(`Schema file not found at: ${schemaPath}`);
    }
    throw error;
  }
}
