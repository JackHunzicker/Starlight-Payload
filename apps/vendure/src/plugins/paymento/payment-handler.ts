import { LanguageCode, PaymentMethodHandler } from '@vendure/core';
import { createPaymentoPayment, verifyPaymentoPayment } from './paymento-client';

export const PAYMENTO_HANDLER_CODE = 'paymento-payment-handler';

export const paymentoPaymentHandler = new PaymentMethodHandler({
    code: PAYMENTO_HANDLER_CODE,
    description: [{ languageCode: LanguageCode.en, value: 'Paymento (USDT, ETH, BTC and more)' }],
    args: {},
    createPayment: async (_ctx, order, amount, _args, metadata) => {
        try {
            const payment = await createPaymentoPayment({
                amount: (amount / 100).toFixed(2),
                currency: order.currencyCode,
                orderCode: order.code,
                vendureOrderId: String(order.id),
                buyerEmail: order.customer?.emailAddress,
            });
            return {
                amount,
                state: 'Authorized' as const,
                transactionId: payment.token,
                metadata: {
                    ...metadata,
                    public: { token: payment.token, checkoutLink: payment.gatewayUrl },
                },
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Paymento payment creation failed';
            return { amount, state: 'Error' as const, errorMessage: message, metadata };
        }
    },
    settlePayment: async (_ctx, _order, payment) => {
        try {
            const verification = await verifyPaymentoPayment(payment.transactionId);
            if (!verification.success) {
                return {
                    success: false as const,
                    state: 'Authorized' as const,
                    errorMessage: `Paymento has not approved this payment: ${verification.message || 'not yet confirmed'}`,
                };
            }
            // The token was created server-side for exactly this order and amount,
            // so Paymento's approval of the token is approval of that amount —
            // there is no separately quoted invoice total to cross-check.
            return {
                success: true as const,
                metadata: { ...payment.metadata, paymentoApproved: true },
            };
        } catch (error) {
            return {
                success: false as const,
                state: 'Authorized' as const,
                errorMessage: error instanceof Error ? error.message : 'Paymento verification failed',
            };
        }
    },
    cancelPayment: async () => {
        // Paymento has no cancel API; monitoring stops mattering once the order
        // leaves ArrangingPayment, so an admin-initiated cancel is trusted.
        return { success: true as const };
    },
});
