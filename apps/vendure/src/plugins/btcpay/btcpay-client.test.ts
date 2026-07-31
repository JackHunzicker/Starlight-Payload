import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, test } from 'node:test';
import {
    createBtcpayInvoice,
    getBtcpayInvoice,
    invoiceMatchesExpectedPayment,
    isFullySettledInvoice,
    verifyBtcpayWebhookSignature,
} from './btcpay-client';

const originalFetch = globalThis.fetch;

beforeEach(() => {
    process.env.BTCPAY_SERVER_URL = 'https://pay.example.test/';
    process.env.BTCPAY_STORE_ID = 'store-1';
    process.env.BTCPAY_API_KEY = 'api-key';
    process.env.BTCPAY_WEBHOOK_SECRET = 'webhook-secret';
    process.env.BTCPAY_REDIRECT_URL = 'https://app.example.test/checkout/complete/';
});

afterEach(() => { globalThis.fetch = originalFetch; });

test('creates an invoice with order correlation and a return URL', async () => {
    let requestUrl = '';
    let requestInit: RequestInit | undefined;
    globalThis.fetch = async (input, init) => {
        requestUrl = String(input);
        requestInit = init;
        return new Response(JSON.stringify({
            id: 'invoice-1', storeId: 'store-1', amount: '129.99', currency: 'USD',
            checkoutLink: 'https://pay.example.test/i/invoice-1', status: 'New',
        }), { status: 200 });
    };

    const invoice = await createBtcpayInvoice({
        amount: '129.99', currency: 'USD', orderId: '42', orderCode: 'TL-42', buyerEmail: 'buyer@example.test',
    });
    assert.equal(invoice.id, 'invoice-1');
    assert.equal(requestUrl, 'https://pay.example.test/api/v1/stores/store-1/invoices');
    assert.equal((requestInit?.headers as Record<string, string>).Authorization, 'token api-key');
    const body = JSON.parse(String(requestInit?.body));
    assert.deepEqual(body.metadata, { orderId: '42', orderCode: 'TL-42', buyerEmail: 'buyer@example.test' });
    assert.equal(body.checkout.redirectURL, 'https://app.example.test/checkout/complete/?orderCode=TL-42');
});

test('reads an invoice and rejects non-success API responses', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({
        id: 'invoice-2', storeId: 'store-1', amount: '5.00', currency: 'USD',
        checkoutLink: 'https://pay.example.test/i/invoice-2', status: 'Settled', additionalStatus: 'None',
    }), { status: 200 });
    assert.equal((await getBtcpayInvoice('invoice-2')).status, 'Settled');

    globalThis.fetch = async () => new Response('denied', { status: 401 });
    await assert.rejects(() => getBtcpayInvoice('invoice-2'), /returned 401/);
});

test('verifies signatures in constant time and only accepts fully settled invoices', () => {
    const body = Buffer.from('{"type":"InvoiceSettled"}');
    const signature = `sha256=${createHmac('sha256', 'webhook-secret').update(body).digest('hex')}`;
    assert.equal(verifyBtcpayWebhookSignature(body, signature), true);
    assert.equal(verifyBtcpayWebhookSignature(Buffer.from('tampered'), signature), false);
    assert.equal(isFullySettledInvoice({ id: '1', storeId: 's', amount: '1', currency: 'USD', checkoutLink: '', status: 'Settled', additionalStatus: 'None' }), true);
    assert.equal(isFullySettledInvoice({ id: '1', storeId: 's', amount: '1', currency: 'USD', checkoutLink: '', status: 'Processing' }), false);
    assert.equal(isFullySettledInvoice({ id: '1', storeId: 's', amount: '1', currency: 'USD', checkoutLink: '', status: 'Settled', additionalStatus: 'PaidPartial' }), false);
    const settled = { id: '1', storeId: 's', amount: '129.99', currency: 'USD', checkoutLink: '', status: 'Settled' as const };
    assert.equal(invoiceMatchesExpectedPayment(settled, 'USD', 12_999), true);
    assert.equal(invoiceMatchesExpectedPayment(settled, 'USD', 12_998), false);
    assert.equal(invoiceMatchesExpectedPayment(settled, 'EUR', 12_999), false);
});
