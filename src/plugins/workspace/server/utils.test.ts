/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthStatus } from '../../../core/server';
import { httpServerMock, httpServiceMock } from '../../../core/server/mocks';
import {
  generateRandomId,
  getPrincipalsFromRequest,
  stringToArray,
  updateDashboardAdminStateForRequest,
} from './utils';
import { getWorkspaceState } from '../../../core/server/utils';

describe('workspace utils', () => {
  const mockAuth = httpServiceMock.createAuth();
  it('should generate id with the specified size', () => {
    expect(generateRandomId(6)).toHaveLength(6);
  });

  it('should generate random IDs', () => {
    const NUM_OF_ID = 10000;
    const ids = new Set<string>();
    for (let i = 0; i < NUM_OF_ID; i++) {
      ids.add(generateRandomId(6));
    }
    expect(ids.size).toBe(NUM_OF_ID);
  });

  it('should return empty map when request do not have authentication', () => {
    const mockRequest = httpServerMock.createOpenSearchDashboardsRequest();
    mockAuth.get.mockReturnValueOnce({
      status: AuthStatus.unknown,
      state: {
        authInfo: {
          user_name: 'bar',
          backend_roles: ['foo'],
        },
      },
    });
    const result = getPrincipalsFromRequest(mockRequest, mockAuth);
    expect(result).toEqual({});
  });

  it('should return normally when request has authentication', () => {
    const mockRequest = httpServerMock.createOpenSearchDashboardsRequest();
    mockAuth.get.mockReturnValueOnce({
      status: AuthStatus.authenticated,
      state: {
        authInfo: {
          user_name: 'bar',
          backend_roles: ['foo'],
        },
      },
    });
    const result = getPrincipalsFromRequest(mockRequest, mockAuth);
    expect(result.users).toEqual(['bar']);
    expect(result.groups).toEqual(['foo']);
  });

  it('should throw error when request is not authenticated', () => {
    const mockRequest = httpServerMock.createOpenSearchDashboardsRequest();
    mockAuth.get.mockReturnValueOnce({
      status: AuthStatus.unauthenticated,
      state: {},
    });
    expect(() => getPrincipalsFromRequest(mockRequest, mockAuth)).toThrow('NOT_AUTHORIZED');
  });

  it('should throw error when authentication status is not expected', () => {
    const mockRequest = httpServerMock.createOpenSearchDashboardsRequest();
    mockAuth.get.mockReturnValueOnce({
      // @ts-ignore
      status: 'foo',
      state: {},
    });
    expect(() => getPrincipalsFromRequest(mockRequest, mockAuth)).toThrow(
      'UNEXPECTED_AUTHORIZATION_STATUS'
    );
  });

  it('should be dashboard admin when users match configUsers', () => {
    const mockRequest = httpServerMock.createOpenSearchDashboardsRequest();
    const groups: string[] = ['dashboard_admin'];
    const users: string[] = [];
    const configGroups: string[] = ['dashboard_admin'];
    const configUsers: string[] = [];
    updateDashboardAdminStateForRequest(mockRequest, groups, users, configGroups, configUsers);
    expect(getWorkspaceState(mockRequest)?.isDashboardAdmin).toBe(true);
  });

  it('should be dashboard admin when groups match configGroups', () => {
    const mockRequest = httpServerMock.createOpenSearchDashboardsRequest();
    const groups: string[] = [];
    const users: string[] = ['dashboard_admin'];
    const configGroups: string[] = [];
    const configUsers: string[] = ['dashboard_admin'];
    updateDashboardAdminStateForRequest(mockRequest, groups, users, configGroups, configUsers);
    expect(getWorkspaceState(mockRequest)?.isDashboardAdmin).toBe(true);
  });

  it('should be not dashboard admin when groups do not match configGroups', () => {
    const mockRequest = httpServerMock.createOpenSearchDashboardsRequest();
    const groups: string[] = ['dashboard_admin'];
    const users: string[] = [];
    const configGroups: string[] = [];
    const configUsers: string[] = ['dashboard_admin'];
    updateDashboardAdminStateForRequest(mockRequest, groups, users, configGroups, configUsers);
    expect(getWorkspaceState(mockRequest)?.isDashboardAdmin).toBe(false);
  });

  it('should convert string to array', () => {
    const jsonString = '["test1","test2"]';
    const strToArray = stringToArray(jsonString);
    expect(strToArray).toStrictEqual(new Array('test1', 'test2'));
  });

  it('should convert string to a null array if input is invalid', () => {
    const jsonString = '["test1", test2]';
    const strToArray = stringToArray(jsonString);
    expect(strToArray).toStrictEqual([]);
  });
});
