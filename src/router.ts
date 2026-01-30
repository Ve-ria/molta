import { Elysia } from "elysia";
import { models } from "./router/models.js";
import { completions } from "./router/chat/completions.js";

export const route = new Elysia()
  .use(completions)
  .use(models)
