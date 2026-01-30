import { Elysia } from "elysia";
import { config } from "../services/config.js";

export const auth = new Elysia()
  .use(config)
  .onBeforeHandle({ as: "global" },({ headers, store }) => {
    if (headers["authorization"] !== store.config.token.replace("Bearer ", "")) {
      return new Response("Unauthorized", { status: 401 })
    }
  })
