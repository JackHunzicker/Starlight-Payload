import { VendureAdminClient } from './admin-api';

async function main() {
    const newIdentifier = process.env.VENDURE_NEW_ADMIN_IDENTIFIER?.trim();
    if (!newIdentifier) throw new Error('VENDURE_NEW_ADMIN_IDENTIFIER is required');
    const client = new VendureAdminClient();
    await client.login();
    const result = await client.request<{
        updateActiveAdministrator?: { emailAddress?: string };
    }>(`mutation RotateAdminIdentifier($input: UpdateActiveAdministratorInput!) {
        updateActiveAdministrator(input: $input) { emailAddress }
    }`, { input: { emailAddress: newIdentifier } });
    if (result.updateActiveAdministrator?.emailAddress !== newIdentifier.toLowerCase()) {
        throw new Error('Vendure did not confirm the new administrator identifier');
    }
    console.log(`Vendure administrator identifier changed to ${result.updateActiveAdministrator.emailAddress}`);
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
});
