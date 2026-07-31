import { LanguageCode, PaymentMethodHandler } from '@vendure/core';
import {
    createBtcpayInvoice,
    getBtcpayInvoice,
    invoiceMatchesExpectedPayment,
    isFullySettledInvoice,
} from './btcpay-client';

export const BTCPAY_HANDLER_CODE = 'btcpay-server-payment-handler';

export const btcpayPaymentHandler = new PaymentMethodHandler({
    code: BTCPAY_HANDLER_CODE,
    description: [{ languageCode: LanguageCode.en, value: 'BTCPay Server (Bitcoin)' }],
    args: {},
    createPayment: async (_ctx, order, amount, _args, metadata) => {
        try {
            const invoice = await createBtcpayInvoice({
                amount: (amount / 100).toFixed(2),
                currency: order.currencyCode,
                orderId: String(order.id),
                orderCode: order.code,
                buyerEmail: order.customer?.emailAddress,
            });
            return {
                amount,
                state: 'Authorized' as const,
                transactionId: invoice.id,
                metadata: {
                    ...metadata,
                    btcpayStoreId: invoice.storeId,
                    public: { invoiceId: invoice.id, checkoutLink: invoice.checkoutLink },
                },
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : 'BTCPay invoice creation failed';
            return { amount, state: 'Error' as const, errorMessage: message, metadata };
        }
    },
    settlePayment: async (_ctx, order, payment) => {
        try {
            const invoice = await getBtcpayInvoice(payment.transactionId);
            if (!isFullySettledInvoice(invoice)) {
                return {
                    success: false as const,
                    state: 'Authorized' as const,
                    errorMessage: `BTCPay invoice is ${invoice.status}/${invoice.additionalStatus ?? 'None'}`,
                };
            }
            if (!invoiceMatchesExpectedPayment(invoice, order.currencyCode, payment.amount)) {
                return {
                    success: false as const,
                    state: 'Authorized' as const,
                    errorMessage: 'BTCPay invoice amount or currency does not match the Vendure payment',
                };
            }
            return {
                success: true as const,
                metadata: { ...payment.metadata, btcpayStatus: invoice.status, btcpayAdditionalStatus: invoice.additionalStatus },
            };
        } catch (error) {
            return {
                success: false as const,
                state: 'Authorized' as const,
                errorMessage: error instanceof Error ? error.message : 'BTCPay settlement verification failed',
            };
        }
    },
    cancelPayment: async (_ctx, _order, payment) => {
        const invoice = await getBtcpayInvoice(payment.transactionId);
        if (invoice.status === 'Expired' || invoice.status === 'Invalid') return { success: true as const };
        return {
            success: false as const,
            state: 'Authorized' as const,
            errorMessage: `BTCPay invoice cannot be cancelled while ${invoice.status}`,
        };
    },
});
