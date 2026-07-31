import type { CollectionConfig } from 'payload'
import { anyone, isAdmin, isStaff } from '../access'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    // Uploads are served publicly; only staff may add or replace them.
    read: anyone,
    create: isStaff,
    update: isStaff,
    delete: isAdmin,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
  ],
  upload: true,
}
