/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import {
  AuthStatus,
  HttpAuth,
  OpenSearchDashboardsRequest,
  Principals,
  PrincipalType,
} from '../../../core/server';
import { AuthInfo } from './types';
import { updateWorkspaceState } from '../../../core/server/utils';

/**
 * Generate URL friendly random ID
 */
export const generateRandomId = (size: number) => {
  return crypto.randomBytes(size).toString('base64url').slice(0, size);
};

export const getPrincipalsFromRequest = (
  request: OpenSearchDashboardsRequest,
  auth?: HttpAuth
): Principals => {
  const payload: Principals = {};
  const authInfoResp = auth?.get(request);
  if (authInfoResp?.status === AuthStatus.unknown) {
    /**
     * Login user have access to all the workspaces when no authentication is presented.
     */
    return payload;
  }

  if (authInfoResp?.status === AuthStatus.authenticated) {
    const authInfo = authInfoResp?.state as { authInfo: AuthInfo } | null;
    if (authInfo?.authInfo?.backend_roles) {
      payload[PrincipalType.Groups] = authInfo.authInfo.backend_roles;
    }
    if (authInfo?.authInfo?.user_name) {
      payload[PrincipalType.Users] = [authInfo.authInfo.user_name];
    }
    return payload;
  }

  if (authInfoResp?.status === AuthStatus.unauthenticated) {
    throw new Error('NOT_AUTHORIZED');
  }

  throw new Error('UNEXPECTED_AUTHORIZATION_STATUS');
};

export const isRequestByDashboardAdmin = (
  request: OpenSearchDashboardsRequest,
  groups: string[],
  users: string[],
  configGroups: string[],
  configUsers: string[]
) => {
  if (configGroups.length === 0 && configUsers.length === 0) {
    updateWorkspaceState(request, {
      isDashboardAdmin: false,
    });
    return;
  }
  const groupMatchAny = groups.some((group) => configGroups.includes(group)) || false;
  const userMatchAny = users.some((user) => configUsers.includes(user)) || false;
  updateWorkspaceState(request, {
    isDashboardAdmin: groupMatchAny || userMatchAny,
  });
};
