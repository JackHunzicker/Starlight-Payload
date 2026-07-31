import { runMigrations } from '@vendure/core';
import { config } from './vendure-config';

runMigrations(config)
    .then(migrations => {
        console.log(`Applied ${migrations.length} migration(s).`);
    })
    .catch(error => {
        console.error('Migration failed:', error);
        process.exitCode = 1;
    });
