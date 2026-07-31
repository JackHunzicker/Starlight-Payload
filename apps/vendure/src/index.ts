import { bootstrap, runMigrations } from '@vendure/core';
import { config } from './vendure-config';

console.log('Running migrations...');
runMigrations(config)
    .then(() => {
        console.log('Migrations complete. Bootstrapping...');
        // Nest's native rawBody support preserves the exact bytes needed for
        // BTCPay HMAC verification without adding a second JSON parser.
        return bootstrap(config, { nestApplicationOptions: { rawBody: true } });
    })
    .then(app => {
        console.log('Bootstrapped successfully!');
        // Keep alive check?
    })
    .catch(err => {
        console.error('Fatal Error:', err);
    });
