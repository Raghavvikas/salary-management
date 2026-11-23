import { env } from './config/env.js';
import { createDependencies } from './container.js';
import { createApp } from './http/app.js';

const app = createApp(createDependencies());

const server = app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
