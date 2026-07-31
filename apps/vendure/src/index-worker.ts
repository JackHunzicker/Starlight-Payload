import { bootstrapWorker } from '@vendure/core';
import { config } from './vendure-config';

bootstrapWorker(config)
    .then(async worker => {
        await worker.startJobQueue();
        // Liveness endpoint for the container healthcheck: 200 on /health once
        // the job queue runs. Internal-only (never published or proxied).
        await worker.startHealthCheckServer({ port: 3020 });
    })
    .catch(err => {
        console.error(err);
        // A worker that failed to bootstrap must die visibly — the restart
        // policy brings it back. The old catch logged and idled: an "Up"
        // container silently processing nothing (emails, payload-sync,
        // search indexing all dead).
        process.exit(1);
    });
