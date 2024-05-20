/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { OnPostAuthHandler, OnPreRoutingHandler } from 'src/core/server';
import { coreMock, httpServerMock } from '../../../core/server/mocks';
import { WorkspacePlugin } from './plugin';
import { AppPluginSetupDependencies } from './types';
import { getWorkspaceState } from '../../../core/server/utils';
import * as utilsExports from './utils';

describe('Workspace server plugin', () => {
  const mockApplicationConfig = {
    getConfigurationClient: jest.fn().mockResolvedValue({}),
    registerConfigurationClient: jest.fn().mockResolvedValue({}),
  };
  const mockDependencies: AppPluginSetupDependencies = {
    applicationConfig: mockApplicationConfig,
  };
  it('#setup', async () => {
    let value;
    const setupMock = coreMock.createSetup();
    const initializerContextConfigMock = coreMock.createPluginInitializerContext({
      enabled: true,
    });
    setupMock.capabilities.registerProvider.mockImplementationOnce((fn) => (value = fn()));
    const workspacePlugin = new WorkspacePlugin(initializerContextConfigMock);
    await workspacePlugin.setup(setupMock, mockDependencies);
    expect(value).toMatchInlineSnapshot(`
      Object {
        "workspaces": Object {
          "enabled": true,
          "permissionEnabled": true,
        },
      }
    `);
    expect(setupMock.savedObjects.addClientWrapper).toBeCalledTimes(4);
  });

  it('#proxyWorkspaceTrafficToRealHandler', async () => {
    const setupMock = coreMock.createSetup();
    const initializerContextConfigMock = coreMock.createPluginInitializerContext({
      enabled: true,
      permission: {
        enabled: true,
      },
    });
    let onPreRoutingFn: OnPreRoutingHandler = () => httpServerMock.createResponseFactory().ok();
    setupMock.http.registerOnPreRouting.mockImplementation((fn) => {
      onPreRoutingFn = fn;
      return fn;
    });
    const workspacePlugin = new WorkspacePlugin(initializerContextConfigMock);
    await workspacePlugin.setup(setupMock, mockDependencies);
    const toolKitMock = httpServerMock.createToolkit();

    const requestWithWorkspaceInUrl = httpServerMock.createOpenSearchDashboardsRequest({
      path: '/w/foo/app',
    });
    onPreRoutingFn(requestWithWorkspaceInUrl, httpServerMock.createResponseFactory(), toolKitMock);
    expect(toolKitMock.rewriteUrl).toBeCalledWith('http://localhost/app');
    expect(toolKitMock.next).toBeCalledTimes(0);
    expect(getWorkspaceState(requestWithWorkspaceInUrl)).toEqual({
      requestWorkspaceId: 'foo',
    });

    const requestWithoutWorkspaceInUrl = httpServerMock.createOpenSearchDashboardsRequest({
      path: '/app',
    });
    onPreRoutingFn(
      requestWithoutWorkspaceInUrl,
      httpServerMock.createResponseFactory(),
      toolKitMock
    );
    expect(toolKitMock.next).toBeCalledTimes(1);
  });

  describe('#setupPermission', () => {
    const setupMock = coreMock.createSetup();
    const initializerContextConfigMock = coreMock.createPluginInitializerContext({
      enabled: true,
      permission: {
        enabled: true,
      },
    });
    let registerOnPostAuthFn: OnPostAuthHandler = () => httpServerMock.createResponseFactory().ok();
    setupMock.http.registerOnPostAuth.mockImplementation((fn) => {
      registerOnPostAuthFn = fn;
      return fn;
    });
    const workspacePlugin = new WorkspacePlugin(initializerContextConfigMock);
    const requestWithWorkspaceInUrl = httpServerMock.createOpenSearchDashboardsRequest({
      path: '/w/foo/app',
    });

    it('catch error', async () => {
      await workspacePlugin.setup(setupMock, mockDependencies);
      const toolKitMock = httpServerMock.createToolkit();

      await registerOnPostAuthFn(
        requestWithWorkspaceInUrl,
        httpServerMock.createResponseFactory(),
        toolKitMock
      );
      expect(toolKitMock.next).toBeCalledTimes(1);
    });

    it('with yml config', async () => {
      jest.spyOn(utilsExports, 'getPrincipalsFromRequest').mockImplementation(() => ({}));
      jest
        .spyOn(utilsExports, 'getOSDAdminConfigFromYMLConfig')
        .mockResolvedValue([['group1'], ['user1']]);
      const mockNoDependencies: AppPluginSetupDependencies = {};

      await workspacePlugin.setup(setupMock, mockNoDependencies);
      const toolKitMock = httpServerMock.createToolkit();

      await registerOnPostAuthFn(
        requestWithWorkspaceInUrl,
        httpServerMock.createResponseFactory(),
        toolKitMock
      );
      expect(toolKitMock.next).toBeCalledTimes(1);
    });

    it('with application config', async () => {
      jest.spyOn(utilsExports, 'getPrincipalsFromRequest').mockImplementation(() => ({}));
      jest
        .spyOn(utilsExports, 'getOSDAdminConfigFromApplicationConfig')
        .mockResolvedValue([['group1'], ['user1']]);
      await workspacePlugin.setup(setupMock, mockDependencies);
      const toolKitMock = httpServerMock.createToolkit();

      await registerOnPostAuthFn(
        requestWithWorkspaceInUrl,
        httpServerMock.createResponseFactory(),
        toolKitMock
      );
      expect(toolKitMock.next).toBeCalledTimes(1);
    });
  });

  it('#start', async () => {
    const setupMock = coreMock.createSetup();
    const startMock = coreMock.createStart();
    const initializerContextConfigMock = coreMock.createPluginInitializerContext({
      enabled: true,
      permission: {
        enabled: true,
      },
    });

    const workspacePlugin = new WorkspacePlugin(initializerContextConfigMock);
    await workspacePlugin.setup(setupMock, mockDependencies);
    await workspacePlugin.start(startMock);
    expect(startMock.savedObjects.createSerializer).toBeCalledTimes(1);
  });

  it('#stop', () => {
    const initializerContextConfigMock = coreMock.createPluginInitializerContext();
    const workspacePlugin = new WorkspacePlugin(initializerContextConfigMock);
    workspacePlugin.stop();
  });
});
