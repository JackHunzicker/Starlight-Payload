import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, test } from 'node:test';
import {
    createPaymentoPayment,
    verifyPaymentoIpnSignature,
    verifyPaymentoPayment,
} from './paymento-client';

const originalFetch = globalThis.fetch;

beforeEach(() => {
    process.env.PAYMENTO_API_KEY = 'merchant-api-key';
    process.env.PAYMENTO_IPN_SECRET = 'ipn-secret';
    process.env.PAYMENTO_REDIRECT_URL = 'https://app.example.test/checkout/complete/';
    delete process.env.PAYMENTO_SPEED;
});

afterEach(() => { globalThis.fetch = originalFetch; });

test('creates a payment request with order correlation and returns the gateway link', async () => {
    let requestUrl = '';
    let requestInit: RequestInit | undefined;
    globalThis.fetch = async (input, init) => {
        requestUrl = String(input);
        requestInit = init;
        return new Response(JSON.stringify({ success: true, message: '', body: 'token-123' }), { status: 200 });
    };

    const payment = await createPaymentoPayment({
        amount: '129.99', currency: 'USD', orderCode: 'TL-42', vendureOrderId: '42', buyerEmail: 'buyer@example.test',
    });
    assert.equal(payment.token, 'token-123');
    assert.equal(payment.gatewayUrl, 'https://app.paymento.io/gateway?token=token-123');
    assert.equal(requestUrl, 'https://api.paymento.io/v1/payment/request');
    assert.equal((requestInit?.headers as Record<string, string>)['Api-key'], 'merchant-api-key');
    const body = JSON.parse(String(requestInit?.body));
    assert.equal(body.fiatAmount, '129.99');
    assert.equal(body.fiatCurrency, 'USD');
    assert.equal(body.orderId, 'TL-42');
    assert.equal(body.Speed, 1);
    assert.equal(body.EmailAddress, 'buyer@example.test');
    assert.equal(body.ReturnUrl, 'https://app.example.test/checkout/complete/?orderCode=TL-42');
    assert.deepEqual(body.additionalData, { vendureOrderId: '42', orderCode: 'TL-42' });
});

test('rejects a payment request the API refuses', async () => {
    globalThis.fetch = async () =>
        new Response(JSON.stringify({ success: false, message: 'Invalid API key' }), { status: 200 });
    await assert.rejects(() => createPaymentoPayment({
        amount: '5.00', currency: 'USD', orderCode: 'TL-1', vendureOrderId: '1',
    }), /Invalid API key/);

    globalThis.fetch = async () => new Response('denied', { status: 401 });
    await assert.rejects(() => createPaymentoPayment({
        amount: '5.00', currency: 'USD', orderCode: 'TL-1', vendureOrderId: '1',
    }), /returned 401/);
});

test('verify re-checks once so the Paid-to-Approve transition is not reported as failure', async () => {
    let calls = 0;
    globalThis.fetch = async () => {
        calls += 1;
        return new Response(JSON.stringify({ success: calls > 1, message: calls > 1 ? '' : 'Order is Paid' }), { status: 200 });
    };
    const verification = await verifyPaymentoPayment('token-123');
    assert.equal(verification.success, true);
    assert.equal(calls, 2);

    globalThis.fetch = async () =>
        new Response(JSON.stringify({ success: false, message: 'Invalid Token' }), { status: 200 });
    const failed = await verifyPaymentoPayment('token-404');
    assert.equal(failed.success, false);
});

test('verifies IPN signatures case-insensitively and in constant time', () => {
    const body = Buffer.from('{"OrderStatus":7}');
    const digest = createHmac('sha256', 'ipn-secret').update(body).digest('hex');
    assert.equal(verifyPaymentoIpnSignature(body, digest.toUpperCase()), true);
    assert.equal(verifyPaymentoIpnSignature(body, digest.toLowerCase()), true);
    assert.equal(verifyPaymentoIpnSignature(Buffer.from('tampered'), digest.toUpperCase()), false);
    assert.equal(verifyPaymentoIpnSignature(body, undefined), false);
});
