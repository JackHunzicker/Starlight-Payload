import {
    DefaultCachePlugin,
    DefaultJobQueuePlugin,
    DefaultSchedulerPlugin,
    DefaultSearchPlugin,
    VendureConfig,
} from '@vendure/core';
import { defaultEmailHandlers, EmailPlugin, FileBasedTemplateLoader } from '@vendure/email-plugin';
import { AssetServerPlugin, PresetOnlyStrategy } from '@vendure/asset-server-plugin';
import { DashboardPlugin } from '@vendure/dashboard/plugin';
import { HardenPlugin } from '@vendure/harden-plugin';
import { CommunityInvitePlugin } from './plugins/community-invite/community-invite.plugin';
import { PayloadSyncPlugin } from './plugins/payload-sync';
import { BtcpayPlugin, btcpayPaymentHandler } from './plugins/btcpay';
import { PaymentoPlugin, paymentoPaymentHandler } from './plugins/paymento';
import 'dotenv/config';
import path from 'path';

const IS_DEV = process.env.APP_ENV === 'dev';
const appRoot = process.cwd();
const compiledRoot = IS_DEV ? path.join(appRoot, 'src') : path.join(appRoot, 'dist');

// Email posture. devMode renders emails to disk and serves the /mailbox route —
// a customer-data leak if it ever reaches production (the infra audit's exposed
// /mailbox blocker). Production sets EMAIL_DEV_MODE=false, which REQUIRES an
// SMTP transport: failing hard at boot beats a silent order-confirmation
// black hole.
const EMAIL_DEV_MODE = process.env.EMAIL_DEV_MODE !== 'false';
if (!EMAIL_DEV_MODE && !process.env.SMTP_HOST) {
    throw new Error(
        'EMAIL_DEV_MODE=false requires an SMTP transport: set SMTP_HOST ' +
            '(plus SMTP_PORT/SMTP_SECURE/SMTP_USER/SMTP_PASS as the relay requires).',
    );
}
// Base URL for links inside customer emails (verification, password reset) —
// these are STOREFRONT pages, not Vendure API routes.
const PUBLIC_SHOP_URL = (process.env.PUBLIC_SHOP_URL || 'http://localhost:7773').replace(/\/+$/, '');

export const config: VendureConfig = {
    apiOptions: {
        port: parseInt(process.env.PORT || '7774'),
        adminApiPath: 'admin-api',
        shopApiPath: 'shop-api',
        introspection: IS_DEV,
        cors: {
            credentials: true,
            origin: (process.env.CORS_ORIGINS || 'http://localhost:7773,http://localhost:7774')
                .split(',')
                .map(origin => origin.trim()),
        },
        ...(IS_DEV ? {
            adminApiPlayground: {
                settings: { 'request.credentials': 'include' },
            },
            shopApiPlayground: {
                settings: { 'request.credentials': 'include' },
            },
        } : {}),
    },
    authOptions: {
        tokenMethod: ['bearer', 'cookie'],
        superadminCredentials: {
            identifier: process.env.SUPERADMIN_USERNAME!,
            password: process.env.SUPERADMIN_PASSWORD!,
        },
        cookieOptions: {
            secret: process.env.COOKIE_SECRET!,
        },
    },
    dbConnectionOptions: {
        type: 'postgres',
        // Schema changes are always explicit, reviewable migrations. Never enable
        // TypeORM synchronization against this shared database.
        synchronize: false,
        logging: false,
        database: process.env.DB_NAME || 'vendure_db',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(`${process.env.DB_PORT || 5432}`),
        // SECURITY: No fallback - fail hard if DB_USERNAME is missing
        // This prevents accidental privilege escalation to superuser
        username: process.env.DB_USERNAME!,
        password: process.env.DB_PASSWORD!,
        migrations: [path.join(compiledRoot, './migrations/*.+(js|ts)')],
    },
    paymentOptions: {
        paymentMethodHandlers: [btcpayPaymentHandler, paymentoPaymentHandler],
    },
    customFields: {},
    plugins: [
        HardenPlugin.init({
            apiMode: IS_DEV ? 'dev' : 'prod',
            maxQueryComplexity: 500,
        }),
        AssetServerPlugin.init({
            route: 'assets',
            assetUploadDir: path.join(appRoot, 'static/assets'),
            // Production sets VENDURE_ASSET_URL_PREFIX to the public https origin
            // (assets ride the Vendure hostname through Caddy).
            assetUrlPrefix:
                process.env.VENDURE_ASSET_URL_PREFIX ||
                `http://localhost:${process.env.PORT || 7774}/assets/`,
            imageTransformStrategy: new PresetOnlyStrategy({
                defaultPreset: 'large',
                permittedQuality: [0, 50, 75, 85, 95],
                permittedFormats: ['jpg', 'webp', 'avif'],
                allowFocalPoint: false,
            }),
        }),
        DefaultCachePlugin.init({ cacheSize: 20_000 }),
        DefaultJobQueuePlugin.init({ useDatabaseForBuffer: true }),
        DefaultSchedulerPlugin.init(),
        DefaultSearchPlugin.init({ bufferUpdates: false, indexStockStatus: true }),
        EmailPlugin.init({
            ...(EMAIL_DEV_MODE
                ? {
                      // Emails render to disk; /mailbox serves them. Dev/test ONLY —
                      // with EMAIL_DEV_MODE=false neither the files nor the route exist.
                      devMode: true as const,
                      outputPath: path.join(appRoot, 'static/email/test-emails'),
                      route: 'mailbox',
                  }
                : {
                      transport: {
                          type: 'smtp' as const,
                          host: process.env.SMTP_HOST!,
                          port: parseInt(process.env.SMTP_PORT || '587'),
                          secure: process.env.SMTP_SECURE === 'true',
                          ...(process.env.SMTP_USER
                              ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS! } }
                              : {}),
                      },
                  }),
            handlers: defaultEmailHandlers,
            templateLoader: new FileBasedTemplateLoader(path.join(appRoot, 'static/email/templates')),
            globalTemplateVars: {
                fromAddress: process.env.EMAIL_FROM_ADDRESS || 'no-reply@localhost',
                fromName: process.env.EMAIL_FROM_NAME || 'Acme Commerce',
                // Storefront pages that consume the emailed tokens. The routes are
                // part of the email-matrix hardening pass (they 404 until built) —
                // order confirmation, the launch-critical mail, needs no link target.
                verifyEmailAddressUrl: `${PUBLIC_SHOP_URL}/verify`,
                passwordResetUrl: `${PUBLIC_SHOP_URL}/password-reset`,
                changeEmailAddressUrl: `${PUBLIC_SHOP_URL}/verify-email-address-change`,
            },
        }),
        // The React Dashboard is the ONLY administration surface. The legacy
        // Angular AdminUiPlugin was removed 2026-07-31: Vendure deprecates and
        // stops supporting it after July 2026, and its config shipped
        // `apiPort: 7774` to the browser — an internal-only Docker port — so
        // behind Caddy it rendered a login form that could never reach the API
        // ("Could not connect to the Vendure server at auto:7774"). Caddy
        // redirects /admin -> /dashboard/ so old links and bookmarks still land.
        DashboardPlugin.init({
            route: 'dashboard',
            appDir: path.join(appRoot, 'dist/dashboard'),
        }),
        BtcpayPlugin,
        PaymentoPlugin,
        PayloadSyncPlugin,
        CommunityInvitePlugin,
    ],
};
