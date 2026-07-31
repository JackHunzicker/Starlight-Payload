import type { CollectionConfig } from 'payload'
import { hasRole, isAdmin, isAdminField, isSelfOrStaff } from '../access'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'roles', 'accountType'],
  },
  auth: true,
  access: {
    // Gates the Admin Panel itself. Public SSO customers land in this same
    // collection, so without this every customer could open /admin.
    admin: ({ req: { user } }) => hasRole(user, 'admin', 'editor'),
    // Only admins manage accounts. A user may read and update their own record.
    create: isAdmin,
    read: isSelfOrStaff('id'),
    update: isSelfOrStaff('id'),
    delete: isAdmin,
  },
  fields: [
    /**
     * The storefront identity is the VENDURE CUSTOMER, and this row is derived
     * from it — not the other way round.
     *
     * Vendure owns the things that must be authoritative: orders, addresses,
     * payments, the verification and password-reset emails. The previous model
     * kept a second register here (keyed by an Authentik OIDC subject) that had
     * no link to any of that, so /account/ rendered a session which could not
     * show the customer a single order they had placed.
     *
     * Populated by the Vendure auth strategy on first authenticated request.
     * readOnly because nothing in the admin panel should be able to repoint a
     * Payload user at a different customer.
     */
    {
      name: 'vendureCustomerId',
      type: 'text',
      unique: true,
      index: true,
      admin: { readOnly: true, description: 'Vendure Customer id this account is derived from' },
    },
    {
      name: 'name',
      type: 'text',
      admin: { description: 'Display name, mirrored from the Vendure customer' },
    },
    // Authorization
    {
      name: 'roles',
      type: 'select',
      hasMany: true,
      required: true,
      defaultValue: ['customer'],
      // Field-level access is what stops privilege escalation: without it a user
      // with `update` on their own record could simply add 'admin' to themselves.
      access: {
        create: isAdminField,
        update: isAdminField,
      },
      options: [
        { label: 'Admin (full control)', value: 'admin' },
        { label: 'Editor (content only)', value: 'editor' },
        { label: 'Customer (storefront only)', value: 'customer' },
      ],
      admin: {
        description: 'Admin and Editor grant Admin Panel access. Customer does not.',
      },
    },
    {
      name: 'accountType',
      type: 'select',
      options: [
        { label: 'B2C (Consumer)', value: 'b2c' },
        { label: 'B2B (Business)', value: 'b2b' },
      ],
      defaultValue: 'b2c',
    },
    /**
     * Community access. Sharkey cannot consume OIDC, so membership is granted
     * by invite code rather than sign-on — and its registration is closed
     * except by invite, which makes an issued code equivalent to "this store
     * customer may join". Stored so a customer gets exactly one: re-issuing on
     * demand would turn any signed-in account into an invite generator for a
     * private community.
     */
    {
      name: 'sharkeyInviteCode',
      type: 'text',
      access: { create: isAdminField, update: isAdminField },
      admin: { readOnly: true, description: 'Community invite issued to this customer' },
    },
    {
      name: 'sharkeyInviteIssuedAt',
      type: 'date',
      access: { create: isAdminField, update: isAdminField },
      admin: { readOnly: true, description: 'When the community invite was issued' },
    },
    {
      name: 'hasLibraryAccess',
      type: 'checkbox',
      defaultValue: false,
      access: {
        create: isAdminField,
        update: isAdminField,
      },
      admin: { description: 'Grants access to private docs/Starlight library' },
    },
  ],
}
