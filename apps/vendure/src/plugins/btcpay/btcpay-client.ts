import { createHmac, timingSafeEqual } from 'node:crypto';

export type BtcpayInvoiceStatus = 'New' | 'Processing' | 'Expired' | 'Invalid' | 'Settled';

export interface BtcpayInvoice {
    id: string;
    storeId: string;
    amount: string;
    currency: string;
    checkoutLink: string;
    status: BtcpayInvoiceStatus;
    additionalStatus?: string;
    metadata?: Record<string, unknown>;
}

export interface CreateBtcpayInvoiceInput {
    amount: string;
    currency: string;
    orderId: string;
    orderCode: string;
    buyerEmail?: string;
}

type BtcpayConfig = {
    serverUrl: string;
    storeId: string;
    apiKey: string;
    webhookSecret: string;
    redirectUrl: string;
};

function requiredEnvironment(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is required for BTCPay payments`);
    return value;
}

export function getBtcpayConfig(): BtcpayConfig {
    return {
        serverUrl: requiredEnvironment('BTCPAY_SERVER_URL').replace(/\/$/, ''),
        storeId: requiredEnvironment('BTCPAY_STORE_ID'),
        apiKey: requiredEnvironment('BTCPAY_API_KEY'),
        webhookSecret: requiredEnvironment('BTCPAY_WEBHOOK_SECRET'),
        redirectUrl: requiredEnvironment('BTCPAY_REDIRECT_URL'),
    };
}

async function greenfieldRequest<T>(path: string, init?: RequestInit): Promise<T> {
    const config = getBtcpayConfig();
    const response = await fetch(`${config.serverUrl}${path}`, {
        ...init,
        headers: {
            Authorization: `token ${config.apiKey}`,
            'Content-Type': 'application/json',
            ...init?.headers,
        },
        signal: init?.signal ?? AbortSignal.timeout(15_000),
    });

    const text = await response.text();
    if (!response.ok) {
        throw new Error(`BTCPay Greenfield API returned ${response.status}: ${text.slice(0, 300)}`);
    }
    return (text ? JSON.parse(text) : undefined) as T;
}

export async function createBtcpayInvoice(input: CreateBtcpayInvoiceInput): Promise<BtcpayInvoice> {
    const config = getBtcpayConfig();
    return greenfieldRequest<BtcpayInvoice>(`/api/v1/stores/${encodeURIComponent(config.storeId)}/invoices`, {
        method: 'POST',
        body: JSON.stringify({
            amount: input.amount,
            currency: input.currency,
            metadata: {
                orderId: input.orderId,
                orderCode: input.orderCode,
                ...(input.buyerEmail ? { buyerEmail: input.buyerEmail } : {}),
            },
            checkout: {
                redirectURL: `${config.redirectUrl}?orderCode=${encodeURIComponent(input.orderCode)}`,
                redirectAutomatically: false,
            },
        }),
    });
}

export async function getBtcpayInvoice(invoiceId: string): Promise<BtcpayInvoice> {
    const config = getBtcpayConfig();
    return greenfieldRequest<BtcpayInvoice>(
        `/api/v1/stores/${encodeURIComponent(config.storeId)}/invoices/${encodeURIComponent(invoiceId)}`,
    );
}

export function verifyBtcpayWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
    if (!signature?.startsWith('sha256=')) return false;
    const expected = Buffer.from(
        createHmac('sha256', getBtcpayConfig().webhookSecret).update(rawBody).digest('hex'),
        'utf8',
    );
    const received = Buffer.from(signature.slice('sha256='.length), 'utf8');
    return expected.length === received.length && timingSafeEqual(expected, received);
}

export function isFullySettledInvoice(invoice: BtcpayInvoice): boolean {
    return invoice.status === 'Settled' && !['PaidPartial', 'Invalid'].includes(invoice.additionalStatus ?? '');
}

export function invoiceMatchesExpectedPayment(
    invoice: BtcpayInvoice,
    currencyCode: string,
    amountInMinorUnits: number,
): boolean {
    const invoiceAmount = Number(invoice.amount);
    return invoice.currency === currencyCode &&
        Number.isFinite(invoiceAmount) &&
        invoiceAmount.toFixed(2) === (amountInMinorUnits / 100).toFixed(2);
}
