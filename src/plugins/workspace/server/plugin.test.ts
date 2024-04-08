/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { coreMock } from '../../../core/server/mocks';
import { WorkspacePlugin } from './plugin';
import { AppPluginSetupDependencies } from './types';

describe('Workspace server plugin', () => {
  it('#setup', async () => {
    let value;
    const setupMock = coreMock.createSetup();
    const initializerContextConfigMock = coreMock.createPluginInitializerContext({
      enabled: true,
    });
    const mockApplicationConfig = {
      getConfigurationClient: jest.fn().mockResolvedValue({}),
      registerConfigurationClient: jest.fn().mockResolvedValue({}),
    };
    const mockDependencies: AppPluginSetupDependencies = {
      applicationConfig: mockApplicationConfig,
    };
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
  });
});
