import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { BtcpayWebhookController } from './webhook.controller';

@VendurePlugin({
    compatibility: '^3.7.0',
    imports: [PluginCommonModule],
    controllers: [BtcpayWebhookController],
})
export class BtcpayPlugin {}
