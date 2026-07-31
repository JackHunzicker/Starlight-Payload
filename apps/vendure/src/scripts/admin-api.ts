type GraphQlResponse<T> = { data?: T; errors?: Array<{ message: string }> };

export class VendureAdminClient {
    private token = '';
    private readonly endpoint = process.env.VENDURE_ADMIN_API_URL || 'http://127.0.0.1:7774/admin-api';

    async login(): Promise<void> {
        const username = process.env.SUPERADMIN_USERNAME?.trim();
        const password = process.env.SUPERADMIN_PASSWORD;
        if (!username || !password) throw new Error('SUPERADMIN_USERNAME and SUPERADMIN_PASSWORD are required');
        const response = await this.requestRaw<{
            login: { identifier?: string; errorCode?: string; message?: string };
        }>(
            `mutation Login($username: String!, $password: String!) {
                login(username: $username, password: $password) {
                    ... on CurrentUser { identifier }
                    ... on ErrorResult { errorCode message }
                }
            }`,
            { username, password },
        );
        const result = response.body.data?.login;
        if (!result?.identifier) throw new Error(result?.message || 'Vendure administrator login failed');
        this.token = response.headers.get('vendure-auth-token') || '';
        if (!this.token) throw new Error('Vendure did not return an administrator bearer token');
    }

    async request<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
        const response = await this.requestRaw<T>(query, variables);
        if (response.body.errors?.length) throw new Error(response.body.errors.map(error => error.message).join('; '));
        if (!response.body.data) throw new Error('Vendure Admin API returned no data');
        return response.body.data;
    }

    private async requestRaw<T>(query: string, variables: Record<string, unknown>): Promise<{
        body: GraphQlResponse<T>;
        headers: Headers;
    }> {
        const response = await fetch(this.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
            },
            body: JSON.stringify({ query, variables }),
        });
        const body = await response.json() as GraphQlResponse<T>;
        if (!response.ok) {
            const details = body.errors?.map(error => error.message).join('; ') || 'no GraphQL error details';
            throw new Error(`Vendure Admin API returned HTTP ${response.status}: ${details}`);
        }
        return { body, headers: response.headers };
    }
}
