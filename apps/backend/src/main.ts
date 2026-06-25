import { createApp } from "./app.js";
import { getEnv } from "./config/env.js";

const env = getEnv();
const app = createApp();

app.listen(env.PORT, () => {
  process.stdout.write(`backend listening on ${env.PORT}\n`);
});

