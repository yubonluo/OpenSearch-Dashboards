/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { schema, TypeOf } from '@osd/config-schema';

export const configSchema = schema.object({
  enabled: schema.boolean({ defaultValue: false }),
  permission: schema.object({
    enabled: schema.boolean({ defaultValue: true }),
  }),
  dashboardAdmin: schema.object({
    groups: schema.arrayOf(schema.string(), {
      defaultValue: [],
    }),
    users: schema.arrayOf(schema.string(), {
      defaultValue: [],
    }),
  }),
});

export type WorkspacePluginConfigType = TypeOf<typeof configSchema>;
