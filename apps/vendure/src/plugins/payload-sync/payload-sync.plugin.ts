import { PluginCommonModule, VendurePlugin, EventBus, JobQueue, JobQueueService, ProductEvent } from '@vendure/core';
import { OnApplicationBootstrap } from '@nestjs/common';

interface SyncJobData {
    type: string;
    productId: string;
    data: {
        name: string;
        slug: string;
        description: string;
    };
}

@VendurePlugin({
    imports: [PluginCommonModule],
    compatibility: '^3.0.0',
})
export class PayloadSyncPlugin implements OnApplicationBootstrap {
    private jobQueue!: JobQueue<SyncJobData>;

    constructor(
        private eventBus: EventBus,
        private jobQueueService: JobQueueService,
    ) { }

    async onApplicationBootstrap() {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'payload-sync',
            process: async (job) => {
                const { type, productId, data } = job.data;

                const response = await fetch(process.env.PAYLOAD_SYNC_URL || 'http://localhost:7773/api/vendure-sync', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-webhook-secret': process.env.VENDURE_WEBHOOK_SECRET || '',
                    },
                    body: JSON.stringify({
                        type,
                        productId,
                        data,
                        timestamp: new Date().toISOString()
                    }),
                });

                if (!response.ok) {
                    throw new Error(`Sync failed: ${response.statusText}`);
                }
            },
        });

        this.eventBus.ofType(ProductEvent).subscribe((event) => {
            const product = event.entity;
            this.jobQueue.add({
                type: `product.${event.type}`,
                productId: String(product.id),
                data: {
                    name: product.translations?.[0]?.name || '',
                    slug: product.translations?.[0]?.slug || '',
                    description: product.translations?.[0]?.description || '',
                },
            });
        });
    }
}
