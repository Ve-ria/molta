import { Elysia } from "elysia";

export const models = new Elysia()
  .get("/v1/models", () => {
    return {
      object: "list",
      data: [
        {
          id: "molta",
          object: "model",
          created: new Date().toISOString(),
          owned_by: "molta",
        }
      ]
    }
  })