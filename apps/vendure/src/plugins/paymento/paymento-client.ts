import { createHmac, timingSafeEqual } from 'node:crypto';

export const PAYMENTO_API_BASE = 'https://api.paymento.io/v1';
export const PAYMENTO_GATEWAY_URL = 'https://app.paymento.io/gateway';

// Order statuses per https://docs.paymento.io/api-documention/payment-callback.md
export const PaymentoOrderStatus = {
    Initialize: 0,
    Pending: 1,
    PartialPaid: 2,
    WaitingToConfirm: 3,
    Timeout: 4,
    UserCanceled: 5,
    Paid: 7,
    Approve: 8,
    Reject: 9,
} as const;

export interface CreatePaymentoPaymentInput {
    amount: string;
    currency: string;
    orderCode: string;
    vendureOrderId: string;
    buyerEmail?: string;
}

export interface PaymentoEnvelope<T> {
    success: boolean;
    message?: string;
    body?: T;
}

type PaymentoConfig = {
    apiKey: string;
    ipnSecret: string;
    redirectUrl: string;
    speed: number;
};

function requiredEnvironment(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is required for Paymento payments`);
    return value;
}

export function getPaymentoConfig(): PaymentoConfig {
    return {
        apiKey: requiredEnvironment('PAYMENTO_API_KEY'),
        ipnSecret: requiredEnvironment('PAYMENTO_IPN_SECRET'),
        redirectUrl: requiredEnvironment('PAYMENTO_REDIRECT_URL'),
        // 0 accepts at mempool sight, 1 waits for block confirmation. Default to
        // confirmation — the same conservatism the BTCPay rail runs with.
        speed: Number(process.env.PAYMENTO_SPEED ?? '1'),
    };
}

async function paymentoRequest<T>(path: string, payload: unknown): Promise<PaymentoEnvelope<T>> {
    const config = getPaymentoConfig();
    const response = await fetch(`${PAYMENTO_API_BASE}${path}`, {
        method: 'POST',
        headers: {
            'Api-key': config.apiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
    });
    const text = await response.text();
    if (!response.ok) {
        throw new Error(`Paymento API returned ${response.status}: ${text.slice(0, 300)}`);
    }
    return JSON.parse(text) as PaymentoEnvelope<T>;
}

export async function createPaymentoPayment(
    input: CreatePaymentoPaymentInput,
): Promise<{ token: string; gatewayUrl: string }> {
    const config = getPaymentoConfig();
    const result = await paymentoRequest<string>('/payment/request', {
        fiatAmount: input.amount,
        fiatCurrency: input.currency,
        ReturnUrl: `${config.redirectUrl}?orderCode=${encodeURIComponent(input.orderCode)}`,
        orderId: input.orderCode,
        Speed: config.speed,
        additionalData: { vendureOrderId: input.vendureOrderId, orderCode: input.orderCode },
        ...(input.buyerEmail ? { EmailAddress: input.buyerEmail } : {}),
    });
    if (!result.success || !result.body) {
        throw new Error(`Paymento payment request failed: ${result.message || 'no token returned'}`);
    }
    return {
        token: result.body,
        gatewayUrl: `${PAYMENTO_GATEWAY_URL}?token=${encodeURIComponent(result.body)}`,
    };
}

export async function verifyPaymentoPayment(token: string): Promise<PaymentoEnvelope<unknown>> {
    // The docs leave open whether the verify call that flips Paid→Approve itself
    // reports success, so a single false is re-checked once before we report
    // "not approved" — either reading of the API settles a genuinely Paid order.
    const first = await paymentoRequest<unknown>('/payment/verify', { token });
    if (first.success) return first;
    return paymentoRequest<unknown>('/payment/verify', { token });
}

export function verifyPaymentoIpnSignature(rawBody: Buffer, signature: string | undefined): boolean {
    if (!signature) return false;
    // Paymento signs the raw callback body with HMAC-SHA256 and sends the digest
    // as uppercase hex; compare case-insensitively and in constant time.
    const expected = Buffer.from(
        createHmac('sha256', getPaymentoConfig().ipnSecret).update(rawBody).digest('hex').toUpperCase(),
        'utf8',
    );
    const received = Buffer.from(signature.trim().toUpperCase(), 'utf8');
    return expected.length === received.length && timingSafeEqual(expected, received);
}
