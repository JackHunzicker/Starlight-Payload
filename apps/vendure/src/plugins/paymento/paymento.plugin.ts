import { PluginCommonModule, VendurePlugin } from '@vendure/core';
import { PaymentoWebhookController } from './webhook.controller';

@VendurePlugin({
    compatibility: '^3.7.0',
    imports: [PluginCommonModule],
    controllers: [PaymentoWebhookController],
})
export class PaymentoPlugin {}
