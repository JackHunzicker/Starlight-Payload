import { Body, Controller, Headers, HttpCode, Post, Req, UnauthorizedException } from '@nestjs/common';
import {
    Logger,
    OrderService,
    Payment,
    RequestContextService,
    TransactionalConnection,
} from '@vendure/core';
import type { Request } from 'express';
import { getBtcpayInvoice, isFullySettledInvoice, verifyBtcpayWebhookSignature } from './btcpay-client';

type BtcpayWebhookEvent = {
    type?: string;
    storeId?: string;
    invoiceId?: string;
};

type RawBodyRequest = Request & { rawBody?: Buffer };

@Controller('payments/btcpay')
export class BtcpayWebhookController {
    constructor(
        private readonly connection: TransactionalConnection,
        private readonly orderService: OrderService,
        private readonly requestContextService: RequestContextService,
    ) {}

    @Post('webhook')
    @HttpCode(200)
    async webhook(
        @Req() request: RawBodyRequest,
        @Headers('btcpay-sig') signature: string | undefined,
        @Body() event: BtcpayWebhookEvent,
    ): Promise<{ received: true }> {
        if (!request.rawBody || !verifyBtcpayWebhookSignature(request.rawBody, signature)) {
            throw new UnauthorizedException('Invalid BTCPay webhook signature');
        }

        if (event.type !== 'InvoiceSettled' || !event.invoiceId) return { received: true };

        const invoice = await getBtcpayInvoice(event.invoiceId);
        if (!isFullySettledInvoice(invoice)) {
            Logger.warn(
                `Ignoring BTCPay settlement for ${invoice.id}: ${invoice.status}/${invoice.additionalStatus ?? 'None'}`,
                'BtcpayWebhook',
            );
            return { received: true };
        }

        const ctx = await this.requestContextService.fromRequest(request);
        const payment = await this.connection.getRepository(ctx, Payment).findOne({
            where: { transactionId: event.invoiceId },
            relations: { order: true },
        });
        if (!payment) throw new Error(`No Vendure payment found for BTCPay invoice ${event.invoiceId}`);
        if (payment.state === 'Settled') return { received: true };
        if (payment.state !== 'Authorized') {
            throw new Error(`Vendure payment ${payment.id} is ${payment.state}, not Authorized`);
        }

        const metadata = invoice.metadata ?? {};
        if (String(metadata.orderId ?? '') !== String(payment.order.id) || metadata.orderCode !== payment.order.code) {
            throw new Error(`BTCPay invoice ${invoice.id} does not match Vendure order ${payment.order.code}`);
        }

        const result = await this.connection.withTransaction(ctx, transactionCtx =>
            this.orderService.settlePayment(transactionCtx, payment.id),
        );
        if ('errorCode' in result) throw new Error(`Vendure settlement failed: ${result.message}`);

        Logger.info(`Settled Vendure payment ${payment.id} from BTCPay invoice ${invoice.id}`, 'BtcpayWebhook');
        return { received: true };
    }
}
