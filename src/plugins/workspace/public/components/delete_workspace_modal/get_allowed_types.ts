/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 * Any modifications Copyright OpenSearch Contributors. See
 * GitHub history for details.
 */

import { HttpStart } from 'src/core/public';

interface GetAllowedTypesResponse {
  types: string[];
}

export async function getAllowedTypes(http: HttpStart) {
  const response = await http.get<GetAllowedTypesResponse>('/api/workspaces/_allowed_types');
  return response.types;
}
