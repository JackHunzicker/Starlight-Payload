import * as migration_20260131_024603_initial_setup from './20260131_024603_initial_setup';
import * as migration_20260202_162519 from './20260202_162519';
import * as migration_20260712_052116_schema_sync_post_dev_push from './20260712_052116_schema_sync_post_dev_push';
import * as migration_20260725_201503_user_roles_rbac from './20260725_201503_user_roles_rbac';
import * as migration_20260728_182856_multi_tenant_brand_settings from './20260728_182856_multi_tenant_brand_settings';
import * as migration_20260728_183500_drop_site_settings_global from './20260728_183500_drop_site_settings_global';
import * as migration_20260729_170000_lms_completion from './20260729_170000_lms_completion';
import * as migration_20260731_190000_vendure_customer_identity from './20260731_190000_vendure_customer_identity';
import * as migration_20260731_200000_community_invite from './20260731_200000_community_invite';

export const migrations = [
  {
    up: migration_20260131_024603_initial_setup.up,
    down: migration_20260131_024603_initial_setup.down,
    name: '20260131_024603_initial_setup',
  },
  {
    up: migration_20260202_162519.up,
    down: migration_20260202_162519.down,
    name: '20260202_162519',
  },
  {
    up: migration_20260712_052116_schema_sync_post_dev_push.up,
    down: migration_20260712_052116_schema_sync_post_dev_push.down,
    name: '20260712_052116_schema_sync_post_dev_push',
  },
  {
    up: migration_20260725_201503_user_roles_rbac.up,
    down: migration_20260725_201503_user_roles_rbac.down,
    name: '20260725_201503_user_roles_rbac',
  },
  {
    up: migration_20260728_182856_multi_tenant_brand_settings.up,
    down: migration_20260728_182856_multi_tenant_brand_settings.down,
    name: '20260728_182856_multi_tenant_brand_settings'
  },
  {
    up: migration_20260728_183500_drop_site_settings_global.up,
    down: migration_20260728_183500_drop_site_settings_global.down,
    name: '20260728_183500_drop_site_settings_global'
  },
  {
    up: migration_20260729_170000_lms_completion.up,
    down: migration_20260729_170000_lms_completion.down,
    name: '20260729_170000_lms_completion'
  },
  {
    up: migration_20260731_190000_vendure_customer_identity.up,
    down: migration_20260731_190000_vendure_customer_identity.down,
    name: '20260731_190000_vendure_customer_identity',
  },
  {
    up: migration_20260731_200000_community_invite.up,
    down: migration_20260731_200000_community_invite.down,
    name: '20260731_200000_community_invite',
  },
];
