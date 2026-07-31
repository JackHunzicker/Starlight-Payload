import {
    PluginCommonModule,
    VendurePlugin,
    EventBus,
    JobQueue,
    JobQueueService,
    OrderStateTransitionEvent,
    OrderService,
    RequestContextService,
} from '@vendure/core';
import { OnApplicationBootstrap } from '@nestjs/common';

interface InviteJobData {
    customerId: string;
    orderCode: string;
}

/**
 * A paying customer gets community access without having to ask.
 *
 * Fires on the transition INTO PaymentSettled — not on order placement. An
 * order that is placed but never paid must not buy someone entry to a private
 * community, and settlement is the first point at which money has actually
 * moved.
 *
 * The invite itself is minted by the web app, not here: Sharkey's admin
 * credentials and the Payload user record both live there, and duplicating
 * either into Vendure would put the same secret in two places. This plugin only
 * says "this customer paid" — the same shape, secret and transport as
 * payload-sync, so there is one webhook pattern to understand rather than two.
 *
 * Runs on a JobQueue, so it executes on the WORKER and a Sharkey outage retries
 * instead of failing a checkout. Community access is never on the critical path
 * of taking money.
 */
@VendurePlugin({
    imports: [PluginCommonModule],
    compatibility: '^3.0.0',
})
export class CommunityInvitePlugin implements OnApplicationBootstrap {
    private jobQueue!: JobQueue<InviteJobData>;

    constructor(
        private eventBus: EventBus,
        private jobQueueService: JobQueueService,
        private orderService: OrderService,
        private requestContextService: RequestContextService,
    ) {}

    async onApplicationBootstrap() {
        this.jobQueue = await this.jobQueueService.createQueue({
            name: 'community-invite',
            process: async job => {
                const { customerId, orderCode } = job.data;
                const url =
                    process.env.COMMUNITY_INVITE_URL ||
                    'http://web:7773/api/community/auto-invite/';
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-webhook-secret': process.env.VENDURE_WEBHOOK_SECRET || '',
                    },
                    body: JSON.stringify({ customerId, orderCode }),
                });
                if (!response.ok) {
                    // Throwing puts it back on the queue rather than losing it.
                    throw new Error(
                        `community-invite webhook responded ${response.status} for order ${orderCode}`,
                    );
                }
            },
        });

        this.eventBus.ofType(OrderStateTransitionEvent).subscribe(async event => {
            if (event.toState !== 'PaymentSettled') return;
            const customerId = event.order.customer?.id;
            if (!customerId) {
                // Guest checkout: there is no account to attach an invite to.
                return;
            }
            await this.jobQueue.add(
                { customerId: String(customerId), orderCode: event.order.code },
                { retries: 5 },
            );
        });
    }
}
