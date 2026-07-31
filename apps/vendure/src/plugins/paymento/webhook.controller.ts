import { Body, Controller, Headers, HttpCode, Post, Req, UnauthorizedException } from '@nestjs/common';
import {
    Logger,
    OrderService,
    Payment,
    RequestContextService,
    TransactionalConnection,
} from '@vendure/core';
import type { Request } from 'express';
import { PaymentoOrderStatus, verifyPaymentoIpnSignature } from './paymento-client';

// Field names are PascalCase per the callback docs; both casings are accepted
// because Paymento's own examples are inconsistent between the two.
type PaymentoIpnEvent = {
    Token?: string;
    token?: string;
    OrderId?: string;
    orderId?: string;
    OrderStatus?: number | string;
    orderStatus?: number | string;
    AdditionalData?: unknown;
    additionalData?: unknown;
};

type RawBodyRequest = Request & { rawBody?: Buffer };

function parseAdditionalData(raw: unknown): Record<string, unknown> {
    if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
    if (typeof raw === 'string' && raw.trim()) {
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
        } catch {
            /* opaque additionalData is treated as absent */
        }
    }
    return {};
}

@Controller('payments/paymento')
export class PaymentoWebhookController {
    constructor(
        private readonly connection: TransactionalConnection,
        private readonly orderService: OrderService,
        private readonly requestContextService: RequestContextService,
    ) {}

    @Post('webhook')
    @HttpCode(200)
    async webhook(
        @Req() request: RawBodyRequest,
        @Headers('x-hmac-sha256-signature') signature: string | undefined,
        @Body() event: PaymentoIpnEvent,
    ): Promise<{ received: true }> {
        if (!request.rawBody || !verifyPaymentoIpnSignature(request.rawBody, signature)) {
            throw new UnauthorizedException('Invalid Paymento IPN signature');
        }

        const token = event.Token ?? event.token;
        const status = Number(event.OrderStatus ?? event.orderStatus);
        // Paid means confirmed on-chain; Approve can arrive on IPN retries after
        // our own verify call has already flipped the order. Everything else is
        // progress noise — the authoritative verify happens in settlePayment.
        if (!token || (status !== PaymentoOrderStatus.Paid && status !== PaymentoOrderStatus.Approve)) {
            return { received: true };
        }

        const ctx = await this.requestContextService.fromRequest(request);
        const payment = await this.connection.getRepository(ctx, Payment).findOne({
            where: { transactionId: token },
            relations: { order: true },
        });
        if (!payment) throw new Error(`No Vendure payment found for Paymento token ${token}`);
        if (payment.state === 'Settled') return { received: true };
        if (payment.state !== 'Authorized') {
            throw new Error(`Vendure payment ${payment.id} is ${payment.state}, not Authorized`);
        }

        const additional = parseAdditionalData(event.AdditionalData ?? event.additionalData);
        const reportedOrderCode = event.OrderId ?? event.orderId ?? additional.orderCode;
        if (reportedOrderCode && String(reportedOrderCode) !== payment.order.code) {
            throw new Error(`Paymento token ${token} does not match Vendure order ${payment.order.code}`);
        }
        if (additional.vendureOrderId && String(additional.vendureOrderId) !== String(payment.order.id)) {
            throw new Error(`Paymento token ${token} does not match Vendure order id ${payment.order.id}`);
        }

        const result = await this.connection.withTransaction(ctx, transactionCtx =>
            this.orderService.settlePayment(transactionCtx, payment.id),
        );
        if ('errorCode' in result) throw new Error(`Vendure settlement failed: ${result.message}`);

        Logger.info(`Settled Vendure payment ${payment.id} from Paymento token ${token}`, 'PaymentoWebhook');
        return { received: true };
    }
}
