/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createTestServers,
  TestOpenSearchUtils,
  TestOpenSearchDashboardsUtils,
  TestUtils,
} from '../../../../../core/test_helpers/osd_server';
import {
  SavedObjectsErrorHelpers,
  WORKSPACE_TYPE,
  ISavedObjectsRepository,
  SavedObjectsClientContract,
} from '../../../../../core/server';
import { httpServerMock } from '../../../../../../src/core/server/mocks';
import * as utilsExports from '../../utils';

const repositoryKit = (() => {
  const savedObjects: Array<{ type: string; id: string }> = [];
  return {
    create: async (
      repository: ISavedObjectsRepository,
      ...params: Parameters<ISavedObjectsRepository['create']>
    ) => {
      let result;
      try {
        result = params[2]?.id ? await repository.get(params[0], params[2].id) : undefined;
      } catch (_e) {
        // ignore error when get failed
      }
      if (!result) {
        result = await repository.create(...params);
      }
      savedObjects.push(result);
      return result;
    },
    clearAll: async (repository: ISavedObjectsRepository) => {
      for (let i = 0; i < savedObjects.length; i++) {
        try {
          await repository.delete(savedObjects[i].type, savedObjects[i].id);
        } catch (_e) {
          // Ignore delete error
        }
      }
    },
  };
})();

const permittedRequest = httpServerMock.createOpenSearchDashboardsRequest();
const notPermittedRequest = httpServerMock.createOpenSearchDashboardsRequest();
const groupIsDashboardAdminRequest = httpServerMock.createOpenSearchDashboardsRequest();
const UserIdIsDashboardAdminRequest = httpServerMock.createOpenSearchDashboardsRequest();

describe('WorkspaceSavedObjectsClientWrapper', () => {
  let internalSavedObjectsRepository: ISavedObjectsRepository;
  let servers: TestUtils;
  let opensearchServer: TestOpenSearchUtils;
  let osd: TestOpenSearchDashboardsUtils;
  let permittedSavedObjectedClient: SavedObjectsClientContract;
  let notPermittedSavedObjectedClient: SavedObjectsClientContract;
  let groupIsDashboardAdminSavedObjectedClient: SavedObjectsClientContract;
  let UserIdIsdashboardAdminSavedObjectedClient: SavedObjectsClientContract;

  beforeAll(async function () {
    servers = createTestServers({
      adjustTimeout: (t) => {
        jest.setTimeout(t);
      },
      settings: {
        osd: {
          workspace: {
            enabled: true,
            dashboardAdmin: {
              groups: ['dashboard_admin'],
              users: ['dashboard_admin'],
            },
          },
          savedObjects: {
            permission: {
              enabled: true,
            },
          },
          migrations: { skip: false },
        },
      },
    });
    opensearchServer = await servers.startOpenSearch();
    osd = await servers.startOpenSearchDashboards();

    internalSavedObjectsRepository = osd.coreStart.savedObjects.createInternalRepository([
      WORKSPACE_TYPE,
    ]);

    await repositoryKit.create(
      internalSavedObjectsRepository,
      'workspace',
      {},
      {
        id: 'workspace-1',
        permissions: {
          library_read: { users: ['foo'] },
          library_write: { users: ['foo'] },
        },
      }
    );

    await repositoryKit.create(
      internalSavedObjectsRepository,
      'dashboard',
      {},
      {
        id: 'inner-workspace-dashboard-1',
        workspaces: ['workspace-1'],
      }
    );

    await repositoryKit.create(
      internalSavedObjectsRepository,
      'dashboard',
      {},
      {
        id: 'acl-controlled-dashboard-2',
        permissions: {
          read: { users: ['foo'], groups: [] },
          write: { users: ['foo'], groups: [] },
        },
      }
    );

    jest.spyOn(utilsExports, 'getPrincipalsFromRequest').mockImplementation((request) => {
      if (request === notPermittedRequest) return { users: ['bar'] };
      else if (request === permittedRequest) return { users: ['foo'] };
      else if (request === groupIsDashboardAdminRequest) return { groups: ['dashboard_admin'] };
      return { users: ['dashboard_admin'] };
    });

    permittedSavedObjectedClient = osd.coreStart.savedObjects.getScopedClient(permittedRequest);
    notPermittedSavedObjectedClient = osd.coreStart.savedObjects.getScopedClient(
      notPermittedRequest
    );
    groupIsDashboardAdminSavedObjectedClient = osd.coreStart.savedObjects.getScopedClient(
      groupIsDashboardAdminRequest
    );
    UserIdIsdashboardAdminSavedObjectedClient = osd.coreStart.savedObjects.getScopedClient(
      UserIdIsDashboardAdminRequest
    );
  });

  afterAll(async () => {
    await repositoryKit.clearAll(internalSavedObjectsRepository);
    await opensearchServer.stop();
    await osd.stop();

    jest.spyOn(utilsExports, 'getPrincipalsFromRequest').mockRestore();
  });

  describe('get', () => {
    it('should throw forbidden error when user not permitted', async () => {
      let error;
      try {
        await notPermittedSavedObjectedClient.get('dashboard', 'inner-workspace-dashboard-1');
      } catch (e) {
        error = e;
      }
      expect(error).not.toBeUndefined();
      expect(SavedObjectsErrorHelpers.isForbiddenError(error)).toBe(true);

      error = undefined;
      try {
        await notPermittedSavedObjectedClient.get('dashboard', 'acl-controlled-dashboard-2');
      } catch (e) {
        error = e;
      }
      expect(error).not.toBeUndefined();
      expect(SavedObjectsErrorHelpers.isForbiddenError(error)).toBe(true);
    });

    it('should return consistent dashboard when user permitted', async () => {
      expect(
        (await permittedSavedObjectedClient.get('dashboard', 'inner-workspace-dashboard-1')).error
      ).toBeUndefined();
      expect(
        (await permittedSavedObjectedClient.get('dashboard', 'acl-controlled-dashboard-2')).error
      ).toBeUndefined();
    });

    it('should return consistent dashboard when groups match dashboard admin', async () => {
      expect(
        (
          await groupIsDashboardAdminSavedObjectedClient.get(
            'dashboard',
            'inner-workspace-dashboard-1'
          )
        ).error
      ).toBeUndefined();
      expect(
        (
          await groupIsDashboardAdminSavedObjectedClient.get(
            'dashboard',
            'acl-controlled-dashboard-2'
          )
        ).error
      ).toBeUndefined();
    });

    it('should return consistent dashboard when user ids match dashboard admin', async () => {
      expect(
        (
          await UserIdIsdashboardAdminSavedObjectedClient.get(
            'dashboard',
            'inner-workspace-dashboard-1'
          )
        ).error
      ).toBeUndefined();
      expect(
        (
          await UserIdIsdashboardAdminSavedObjectedClient.get(
            'dashboard',
            'acl-controlled-dashboard-2'
          )
        ).error
      ).toBeUndefined();
    });
  });

  describe('bulkGet', () => {
    it('should throw forbidden error when user not permitted', async () => {
      let error;
      try {
        await notPermittedSavedObjectedClient.bulkGet([
          { type: 'dashboard', id: 'inner-workspace-dashboard-1' },
        ]);
      } catch (e) {
        error = e;
      }
      expect(error).not.toBeUndefined();
      expect(SavedObjectsErrorHelpers.isForbiddenError(error)).toBe(true);

      error = undefined;
      try {
        await notPermittedSavedObjectedClient.bulkGet([
          { type: 'dashboard', id: 'acl-controlled-dashboard-2' },
        ]);
      } catch (e) {
        error = e;
      }
      expect(error).not.toBeUndefined();
      expect(SavedObjectsErrorHelpers.isForbiddenError(error)).toBe(true);
    });

    it('should return consistent dashboard when user permitted', async () => {
      expect(
        (
          await permittedSavedObjectedClient.bulkGet([
            { type: 'dashboard', id: 'inner-workspace-dashboard-1' },
          ])
        ).saved_objects.length
      ).toEqual(1);
      expect(
        (
          await permittedSavedObjectedClient.bulkGet([
            { type: 'dashboard', id: 'acl-controlled-dashboard-2' },
          ])
        ).saved_objects.length
      ).toEqual(1);
    });

    it('should return consistent dashboard when groups match dashboard admin', async () => {
      expect(
        (
          await groupIsDashboardAdminSavedObjectedClient.bulkGet([
            { type: 'dashboard', id: 'inner-workspace-dashboard-1' },
          ])
        ).saved_objects.length
      ).toEqual(1);
      expect(
        (
          await groupIsDashboardAdminSavedObjectedClient.bulkGet([
            { type: 'dashboard', id: 'acl-controlled-dashboard-2' },
          ])
        ).saved_objects.length
      ).toEqual(1);
    });

    it('should return consistent dashboard when user ids match dashboard admin', async () => {
      expect(
        (
          await UserIdIsdashboardAdminSavedObjectedClient.bulkGet([
            { type: 'dashboard', id: 'inner-workspace-dashboard-1' },
          ])
        ).saved_objects.length
      ).toEqual(1);
      expect(
        (
          await UserIdIsdashboardAdminSavedObjectedClient.bulkGet([
            { type: 'dashboard', id: 'acl-controlled-dashboard-2' },
          ])
        ).saved_objects.length
      ).toEqual(1);
    });
  });

  describe('find', () => {
    it('should throw not authorized error when user not permitted', async () => {
      let error;
      try {
        await notPermittedSavedObjectedClient.find({
          type: 'dashboard',
          workspaces: ['workspace-1'],
          perPage: 999,
          page: 1,
        });
      } catch (e) {
        error = e;
      }

      expect(SavedObjectsErrorHelpers.isNotAuthorizedError(error)).toBe(true);
    });

    it('should return consistent inner workspace data when user permitted', async () => {
      const result = await permittedSavedObjectedClient.find({
        type: 'dashboard',
        workspaces: ['workspace-1'],
        perPage: 999,
        page: 1,
      });

      expect(result.saved_objects.some((item) => item.id === 'inner-workspace-dashboard-1')).toBe(
        true
      );
    });

    it('should return consistent inner workspace data when groups match dashboard admin', async () => {
      const result = await groupIsDashboardAdminSavedObjectedClient.find({
        type: 'dashboard',
        workspaces: ['workspace-1'],
        perPage: 999,
        page: 1,
      });

      expect(result.saved_objects.some((item) => item.id === 'inner-workspace-dashboard-1')).toBe(
        true
      );
    });

    it('should return consistent inner workspace data when user ids match dashboard admin', async () => {
      const result = await UserIdIsdashboardAdminSavedObjectedClient.find({
        type: 'dashboard',
        workspaces: ['workspace-1'],
        perPage: 999,
        page: 1,
      });

      expect(result.saved_objects.some((item) => item.id === 'inner-workspace-dashboard-1')).toBe(
        true
      );
    });
  });

  describe('create', () => {
    it('should throw forbidden error when workspace not permitted and create called', async () => {
      let error;
      try {
        await notPermittedSavedObjectedClient.create(
          'dashboard',
          {},
          {
            workspaces: ['workspace-1'],
          }
        );
      } catch (e) {
        error = e;
      }

      expect(SavedObjectsErrorHelpers.isForbiddenError(error)).toBe(true);
    });

    it('should able to create saved objects into permitted workspaces after create called', async () => {
      const createResult = await permittedSavedObjectedClient.create(
        'dashboard',
        {},
        {
          workspaces: ['workspace-1'],
        }
      );
      expect(createResult.error).toBeUndefined();
      await permittedSavedObjectedClient.delete('dashboard', createResult.id);
    });

    it('should able to create saved objects into any workspaces after create called when groups match dashboard admin', async () => {
      const createResult = await groupIsDashboardAdminSavedObjectedClient.create(
        'dashboard',
        {},
        {
          workspaces: ['workspace-1'],
        }
      );
      expect(createResult.error).toBeUndefined();
      await groupIsDashboardAdminSavedObjectedClient.delete('dashboard', createResult.id);
    });

    it('should able to create saved objects into any workspaces after create called when user ids match dashboard admin', async () => {
      const createResult = await UserIdIsdashboardAdminSavedObjectedClient.create(
        'dashboard',
        {},
        {
          workspaces: ['workspace-1'],
        }
      );
      expect(createResult.error).toBeUndefined();
      await groupIsDashboardAdminSavedObjectedClient.delete('dashboard', createResult.id);
    });

    it('should throw forbidden error when create with override', async () => {
      let error;
      try {
        await notPermittedSavedObjectedClient.create(
          'dashboard',
          {},
          {
            id: 'inner-workspace-dashboard-1',
            overwrite: true,
          }
        );
      } catch (e) {
        error = e;
      }

      expect(SavedObjectsErrorHelpers.isForbiddenError(error)).toBe(true);
    });

    it('should able to create with override', async () => {
      const createResult = await permittedSavedObjectedClient.create(
        'dashboard',
        {},
        {
          id: 'inner-workspace-dashboard-1',
          overwrite: true,
          workspaces: ['workspace-1'],
        }
      );

      expect(createResult.error).toBeUndefined();
    });

    it('should able to create with override when groups match dashboard admin', async () => {
      const createResult = await groupIsDashboardAdminSavedObjectedClient.create(
        'dashboard',
        {},
        {
          id: 'inner-workspace-dashboard-1',
          overwrite: true,
          workspaces: ['workspace-1'],
        }
      );

      expect(createResult.error).toBeUndefined();
    });

    it('should able to create with override when uesr ids match dashboard admin', async () => {
      const createResult = await UserIdIsdashboardAdminSavedObjectedClient.create(
        'dashboard',
        {},
        {
          id: 'inner-workspace-dashboard-1',
          overwrite: true,
          workspaces: ['workspace-1'],
        }
      );

      expect(createResult.error).toBeUndefined();
    });
  });

  describe('bulkCreate', () => {
    it('should throw forbidden error when workspace not permitted and bulkCreate called', async () => {
      let error;
      try {
        await notPermittedSavedObjectedClient.bulkCreate([{ type: 'dashboard', attributes: {} }], {
          workspaces: ['workspace-1'],
        });
      } catch (e) {
        error = e;
      }

      expect(SavedObjectsErrorHelpers.isForbiddenError(error)).toBe(true);
    });

    it('should able to create saved objects into permitted workspaces after bulkCreate called', async () => {
      const objectId = new Date().getTime().toString(16).toUpperCase();
      const result = await permittedSavedObjectedClient.bulkCreate(
        [{ type: 'dashboard', attributes: {}, id: objectId }],
        {
          workspaces: ['workspace-1'],
        }
      );
      expect(result.saved_objects.length).toEqual(1);
      await permittedSavedObjectedClient.delete('dashboard', objectId);
    });

    it('should able to create saved objects into any workspaces after bulkCreate called when groups match dashboard damin', async () => {
      const objectId = new Date().getTime().toString(16).toUpperCase();
      const result = await groupIsDashboardAdminSavedObjectedClient.bulkCreate(
        [{ type: 'dashboard', attributes: {}, id: objectId }],
        {
          workspaces: ['workspace-1'],
        }
      );
      expect(result.saved_objects.length).toEqual(1);
      await groupIsDashboardAdminSavedObjectedClient.delete('dashboard', objectId);
    });

    it('should able to create saved objects into any workspaces after bulkCreate called when user ids match dashboard damin', async () => {
      const objectId = new Date().getTime().toString(16).toUpperCase();
      const result = await UserIdIsdashboardAdminSavedObjectedClient.bulkCreate(
        [{ type: 'dashboard', attributes: {}, id: objectId }],
        {
          workspaces: ['workspace-1'],
        }
      );
      expect(result.saved_objects.length).toEqual(1);
      await UserIdIsdashboardAdminSavedObjectedClient.delete('dashboard', objectId);
    });

    it('should throw forbidden error when create with override', async () => {
      let error;
      try {
        await notPermittedSavedObjectedClient.bulkCreate(
          [
            {
              id: 'inner-workspace-dashboard-1',
              type: 'dashboard',
              attributes: {},
            },
          ],
          {
            overwrite: true,
            workspaces: ['workspace-1'],
          }
        );
      } catch (e) {
        error = e;
      }

      expect(SavedObjectsErrorHelpers.isForbiddenError(error)).toBe(true);
    });

    it('should able to bulk create with override', async () => {
      const createResult = await permittedSavedObjectedClient.bulkCreate(
        [
          {
            id: 'inner-workspace-dashboard-1',
            type: 'dashboard',
            attributes: {},
          },
        ],
        {
          overwrite: true,
          workspaces: ['workspace-1'],
        }
      );

      expect(createResult.saved_objects).toHaveLength(1);
    });

    it('should able to bulk create with override when groups match dashboard admin', async () => {
      const createResult = await groupIsDashboardAdminSavedObjectedClient.bulkCreate(
        [
          {
            id: 'inner-workspace-dashboard-1',
            type: 'dashboard',
            attributes: {},
          },
        ],
        {
          overwrite: true,
          workspaces: ['workspace-1'],
        }
      );

      expect(createResult.saved_objects).toHaveLength(1);
    });

    it('should able to bulk create with override when user ids match dashboard admin', async () => {
      const createResult = await UserIdIsdashboardAdminSavedObjectedClient.bulkCreate(
        [
          {
            id: 'inner-workspace-dashboard-1',
            type: 'dashboard',
            attributes: {},
          },
        ],
        {
          overwrite: true,
          workspaces: ['workspace-1'],
        }
      );

      expect(createResult.saved_objects).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('should throw forbidden error when data not permitted', async () => {
      let error;
      try {
        await notPermittedSavedObjectedClient.update(
          'dashboard',
          'inner-workspace-dashboard-1',
          {}
        );
      } catch (e) {
        error = e;
      }

      expect(SavedObjectsErrorHelpers.isForbiddenError(error)).toBe(true);

      error = undefined;
      try {
        await notPermittedSavedObjectedClient.update('dashboard', 'acl-controlled-dashboard-2', {});
      } catch (e) {
        error = e;
      }

      expect(SavedObjectsErrorHelpers.isForbiddenError(error)).toBe(true);
    });

    it('should update saved objects for permitted workspaces', async () => {
      expect(
        (await permittedSavedObjectedClient.update('dashboard', 'inner-workspace-dashboard-1', {}))
          .error
      ).toBeUndefined();
      expect(
        (await permittedSavedObjectedClient.update('dashboard', 'acl-controlled-dashboard-2', {}))
          .error
      ).toBeUndefined();
    });

    it('should update saved objects for any workspaces when groups match dashboard admin', async () => {
      expect(
        (
          await groupIsDashboardAdminSavedObjectedClient.update(
            'dashboard',
            'inner-workspace-dashboard-1',
            {}
          )
        ).error
      ).toBeUndefined();
      expect(
        (
          await groupIsDashboardAdminSavedObjectedClient.update(
            'dashboard',
            'acl-controlled-dashboard-2',
            {}
          )
        ).error
      ).toBeUndefined();
    });

    it('should update saved objects for any workspaces when user ids match dashboard admin', async () => {
      expect(
        (
          await UserIdIsdashboardAdminSavedObjectedClient.update(
            'dashboard',
            'inner-workspace-dashboard-1',
            {}
          )
        ).error
      ).toBeUndefined();
      expect(
        (
          await UserIdIsdashboardAdminSavedObjectedClient.update(
            'dashboard',
            'acl-controlled-dashboard-2',
            {}
          )
        ).error
      ).toBeUndefined();
    });
  });

  describe('bulkUpdate', () => {
    it('should throw forbidden error when data not permitted', async () => {
      let error;
      try {
        await notPermittedSavedObjectedClient.bulkUpdate(
          [{ type: 'dashboard', id: 'inner-workspace-dashboard-1', attributes: {} }],
          {}
        );
      } catch (e) {
        error = e;
      }

      expect(SavedObjectsErrorHelpers.isForbiddenError(error)).toBe(true);

      error = undefined;
      try {
        await notPermittedSavedObjectedClient.bulkUpdate(
          [{ type: 'dashboard', id: 'acl-controlled-dashboard-2', attributes: {} }],
          {}
        );
      } catch (e) {
        error = e;
      }

      expect(SavedObjectsErrorHelpers.isForbiddenError(error)).toBe(true);
    });

    it('should bulk update saved objects for permitted workspaces', async () => {
      expect(
        (
          await permittedSavedObjectedClient.bulkUpdate([
            { type: 'dashboard', id: 'inner-workspace-dashboard-1', attributes: {} },
          ])
        ).saved_objects.length
      ).toEqual(1);
      expect(
        (
          await permittedSavedObjectedClient.bulkUpdate([
            { type: 'dashboard', id: 'inner-workspace-dashboard-1', attributes: {} },
          ])
        ).saved_objects.length
      ).toEqual(1);
    });

    it('should bulk update saved objects for any workspaces when groups match dashboard admin', async () => {
      expect(
        (
          await groupIsDashboardAdminSavedObjectedClient.bulkUpdate([
            { type: 'dashboard', id: 'inner-workspace-dashboard-1', attributes: {} },
          ])
        ).saved_objects.length
      ).toEqual(1);
      expect(
        (
          await groupIsDashboardAdminSavedObjectedClient.bulkUpdate([
            { type: 'dashboard', id: 'inner-workspace-dashboard-1', attributes: {} },
          ])
        ).saved_objects.length
      ).toEqual(1);
    });

    it('should bulk update saved objects for any workspaces when user ids match dashboard admin', async () => {
      expect(
        (
          await UserIdIsdashboardAdminSavedObjectedClient.bulkUpdate([
            { type: 'dashboard', id: 'inner-workspace-dashboard-1', attributes: {} },
          ])
        ).saved_objects.length
      ).toEqual(1);
      expect(
        (
          await UserIdIsdashboardAdminSavedObjectedClient.bulkUpdate([
            { type: 'dashboard', id: 'inner-workspace-dashboard-1', attributes: {} },
          ])
        ).saved_objects.length
      ).toEqual(1);
    });
  });

  describe('delete', () => {
    it('should throw forbidden error when data not permitted', async () => {
      let error;
      try {
        await notPermittedSavedObjectedClient.delete('dashboard', 'inner-workspace-dashboard-1');
      } catch (e) {
        error = e;
      }

      expect(SavedObjectsErrorHelpers.isForbiddenError(error)).toBe(true);

      error = undefined;
      try {
        await notPermittedSavedObjectedClient.delete('dashboard', 'acl-controlled-dashboard-2');
      } catch (e) {
        error = e;
      }

      expect(SavedObjectsErrorHelpers.isForbiddenError(error)).toBe(true);
    });

    it('should be able to delete permitted data', async () => {
      const createResult = await repositoryKit.create(
        internalSavedObjectsRepository,
        'dashboard',
        {},
        {
          workspaces: ['workspace-1'],
        }
      );

      await permittedSavedObjectedClient.delete('dashboard', createResult.id);

      let error;
      try {
        error = await permittedSavedObjectedClient.get('dashboard', createResult.id);
      } catch (e) {
        error = e;
      }
      expect(SavedObjectsErrorHelpers.isNotFoundError(error)).toBe(true);
    });

    it('should be able to delete acl controlled permitted data', async () => {
      const createResult = await repositoryKit.create(
        internalSavedObjectsRepository,
        'dashboard',
        {},
        {
          permissions: {
            read: { users: ['foo'] },
            write: { users: ['foo'] },
          },
        }
      );

      await permittedSavedObjectedClient.delete('dashboard', createResult.id);

      let error;
      try {
        error = await permittedSavedObjectedClient.get('dashboard', createResult.id);
      } catch (e) {
        error = e;
      }
      expect(SavedObjectsErrorHelpers.isNotFoundError(error)).toBe(true);
    });

    it('should be able to delete any data when groups match dashboard admin', async () => {
      const createPermittedResult = await repositoryKit.create(
        internalSavedObjectsRepository,
        'dashboard',
        {},
        {
          permissions: {
            read: { users: ['foo'] },
            write: { users: ['foo'] },
          },
        }
      );

      await groupIsDashboardAdminSavedObjectedClient.delete('dashboard', createPermittedResult.id);

      let permittedError;
      try {
        permittedError = await groupIsDashboardAdminSavedObjectedClient.get(
          'dashboard',
          createPermittedResult.id
        );
      } catch (e) {
        permittedError = e;
      }
      expect(SavedObjectsErrorHelpers.isNotFoundError(permittedError)).toBe(true);

      const createACLResult = await repositoryKit.create(
        internalSavedObjectsRepository,
        'dashboard',
        {},
        {
          workspaces: ['workspace-1'],
        }
      );

      await groupIsDashboardAdminSavedObjectedClient.delete('dashboard', createACLResult.id);

      let ACLError;
      try {
        ACLError = await groupIsDashboardAdminSavedObjectedClient.get(
          'dashboard',
          createACLResult.id
        );
      } catch (e) {
        ACLError = e;
      }
      expect(SavedObjectsErrorHelpers.isNotFoundError(ACLError)).toBe(true);
    });

    it('should be able to delete any data when user ids match dashboard admin', async () => {
      const createPermittedResult = await repositoryKit.create(
        internalSavedObjectsRepository,
        'dashboard',
        {},
        {
          permissions: {
            read: { users: ['foo'] },
            write: { users: ['foo'] },
          },
        }
      );

      await UserIdIsdashboardAdminSavedObjectedClient.delete('dashboard', createPermittedResult.id);

      let permittedError;
      try {
        permittedError = await UserIdIsdashboardAdminSavedObjectedClient.get(
          'dashboard',
          createPermittedResult.id
        );
      } catch (e) {
        permittedError = e;
      }
      expect(SavedObjectsErrorHelpers.isNotFoundError(permittedError)).toBe(true);

      const createACLResult = await repositoryKit.create(
        internalSavedObjectsRepository,
        'dashboard',
        {},
        {
          workspaces: ['workspace-1'],
        }
      );

      await UserIdIsdashboardAdminSavedObjectedClient.delete('dashboard', createACLResult.id);

      let ACLError;
      try {
        ACLError = await UserIdIsdashboardAdminSavedObjectedClient.get(
          'dashboard',
          createACLResult.id
        );
      } catch (e) {
        ACLError = e;
      }
      expect(SavedObjectsErrorHelpers.isNotFoundError(ACLError)).toBe(true);
    });
  });
});
