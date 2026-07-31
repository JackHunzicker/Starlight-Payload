import { VendureAdminClient } from './admin-api';

type Entity = { id: string; code: string };

async function main() {
    const client = new VendureAdminClient();
    await client.login();

    const existing = await client.request<{
        paymentMethods: { items: Entity[] };
        shippingMethods: { items: Entity[] };
    }>(`query MvpConfiguration {
        paymentMethods { items { id code } }
        shippingMethods { items { id code } }
    }`);

    const paymentInput = {
        code: 'btcpay-server',
        enabled: true,
        handler: { code: 'btcpay-server-payment-handler', arguments: [] },
        translations: [{ languageCode: 'en', name: 'Bitcoin via BTCPay Server', description: 'Self-hosted Bitcoin checkout' }],
    };
    const existingPayment = existing.paymentMethods.items.find(item => item.code === paymentInput.code);
    if (existingPayment) {
        await client.request(`mutation UpdatePayment($input: UpdatePaymentMethodInput!) {
            updatePaymentMethod(input: $input) { id code enabled }
        }`, { input: { ...paymentInput, id: existingPayment.id } });
        console.log('Updated BTCPay payment method');
    } else {
        await client.request(`mutation CreatePayment($input: CreatePaymentMethodInput!) {
            createPaymentMethod(input: $input) { id code enabled }
        }`, { input: paymentInput });
        console.log('Created BTCPay payment method');
    }

    // Paymento only becomes a visible checkout option once its credentials are
    // configured — an unconfigured handler would error on every invoice.
    if (process.env.PAYMENTO_API_KEY?.trim()) {
        const paymentoInput = {
            code: 'paymento',
            enabled: true,
            handler: { code: 'paymento-payment-handler', arguments: [] },
            translations: [{
                languageCode: 'en',
                name: 'Crypto via Paymento (USDT, ETH, BTC & more)',
                description: 'Pay in USDT (TRC-20/ERC-20/Solana), ETH, BNB or BTC — funds settle to our own wallet',
            }],
        };
        const existingPaymento = existing.paymentMethods.items.find(item => item.code === paymentoInput.code);
        if (existingPaymento) {
            await client.request(`mutation UpdatePayment($input: UpdatePaymentMethodInput!) {
                updatePaymentMethod(input: $input) { id code enabled }
            }`, { input: { ...paymentoInput, id: existingPaymento.id } });
            console.log('Updated Paymento payment method');
        } else {
            await client.request(`mutation CreatePayment($input: CreatePaymentMethodInput!) {
                createPaymentMethod(input: $input) { id code enabled }
            }`, { input: paymentoInput });
            console.log('Created Paymento payment method');
        }
    } else {
        console.log('PAYMENTO_API_KEY not set — skipping Paymento payment method');
    }

    // Real shipping rates (the owner, 2026-07-29): flat $10 Priority / $20 Express.
    // These REPLACE the mvp-free-shipping placeholder, retired below. `rate` is
    // minor units (cents); tax stays 0% like the rest of the catalogue pending
    // the accounting call.
    const shippingMethods = [
        { code: 'priority-shipping', rate: '1000', name: 'Priority Shipping', description: 'Flat-rate priority shipping' },
        { code: 'express-shipping', rate: '2000', name: 'Express Shipping', description: 'Flat-rate express shipping' },
    ];

    for (const method of shippingMethods) {
        const shippingInput = {
            code: method.code,
            fulfillmentHandler: 'manual-fulfillment',
            checker: { code: 'default-shipping-eligibility-checker', arguments: [{ name: 'orderMinimum', value: '0' }] },
            calculator: {
                code: 'default-shipping-calculator',
                arguments: [
                    { name: 'rate', value: method.rate },
                    { name: 'includesTax', value: 'true' },
                    { name: 'taxRate', value: '0' },
                ],
            },
            translations: [{ languageCode: 'en', name: method.name, description: method.description }],
        };
        const existingShipping = existing.shippingMethods.items.find(item => item.code === method.code);
        if (existingShipping) {
            await client.request(`mutation UpdateShipping($input: UpdateShippingMethodInput!) {
                updateShippingMethod(input: $input) { id code }
            }`, { input: { ...shippingInput, id: existingShipping.id } });
            console.log(`Updated shipping method ${method.code}`);
        } else {
            await client.request(`mutation CreateShipping($input: CreateShippingMethodInput!) {
                createShippingMethod(input: $input) { id code }
            }`, { input: shippingInput });
            console.log(`Created shipping method ${method.code}`);
        }
    }

    // Retire the placeholder so checkout cannot still offer free shipping.
    // Soft delete — historical orders keep their recorded method.
    const legacyFreeShipping = existing.shippingMethods.items.find(item => item.code === 'mvp-free-shipping');
    if (legacyFreeShipping) {
        const removal = await client.request<{ deleteShippingMethod: { result: string; message?: string } }>(
            `mutation DeleteShipping($id: ID!) {
                deleteShippingMethod(id: $id) { result message }
            }`,
            { id: legacyFreeShipping.id },
        );
        const { result, message } = removal.deleteShippingMethod;
        console.log(`Retired mvp-free-shipping: ${result}${message ? ` (${message})` : ''}`);
    }
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
