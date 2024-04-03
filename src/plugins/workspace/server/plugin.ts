/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Observable } from 'rxjs';
import { first } from 'rxjs/operators';
import {
  PluginInitializerContext,
  CoreSetup,
  Plugin,
  Logger,
  CoreStart,
  OpenSearchDashboardsRequest,
} from '../../../core/server';
import {
  WORKSPACE_SAVED_OBJECTS_CLIENT_WRAPPER_ID,
  WORKSPACE_CONFLICT_CONTROL_SAVED_OBJECTS_CLIENT_WRAPPER_ID,
} from '../common/constants';
import { AppPluginSetupDependencies, IWorkspaceClientImpl } from './types';
import { WorkspaceClient } from './workspace_client';
import { registerRoutes } from './routes';
import { WorkspaceSavedObjectsClientWrapper } from './saved_objects';
import {
  cleanWorkspaceId,
  getWorkspaceIdFromUrl,
  updateWorkspaceState,
} from '../../../core/server/utils';
import { WorkspaceConflictSavedObjectsClientWrapper } from './saved_objects/saved_objects_wrapper_for_check_workspace_conflict';
import {
  SavedObjectsPermissionControl,
  SavedObjectsPermissionControlContract,
} from './permission_control/client';
import { WorkspacePluginConfigType } from '../config';
import { isRequestByDashboardAdmin } from './utils';

export class WorkspacePlugin implements Plugin<{}, {}> {
  private readonly logger: Logger;
  private client?: IWorkspaceClientImpl;
  private workspaceConflictControl?: WorkspaceConflictSavedObjectsClientWrapper;
  private permissionControl?: SavedObjectsPermissionControlContract;
  private readonly config$: Observable<WorkspacePluginConfigType>;
  private workspaceSavedObjectsClientWrapper?: WorkspaceSavedObjectsClientWrapper;

  private proxyWorkspaceTrafficToRealHandler(setupDeps: CoreSetup) {
    /**
     * Proxy all {basePath}/w/{workspaceId}{osdPath*} paths to {basePath}{osdPath*}
     */
    setupDeps.http.registerOnPreRouting(async (request, response, toolkit) => {
      const workspaceId = getWorkspaceIdFromUrl(
        request.url.toString(),
        '' // No need to pass basePath here because the request.url will be rewrite by registerOnPreRouting method in `src/core/server/http/http_server.ts`
      );

      if (workspaceId) {
        const requestUrl = new URL(request.url.toString());
        requestUrl.pathname = cleanWorkspaceId(requestUrl.pathname);
        return toolkit.rewriteUrl(requestUrl.toString());
      }
      return toolkit.next();
    });
  }

  private async setupPermission(
    core: CoreSetup,
    config: WorkspacePluginConfigType,
    { applicationConfig }: AppPluginSetupDependencies
  ) {
    this.permissionControl = new SavedObjectsPermissionControl(this.logger);

    core.http.registerOnPostAuth(async (request, response, toolkit) => {
      let groups: string[];
      let users: string[];

      // There may be calls to saved objects client before user get authenticated, need to add a try catch here as `getPrincipalsFromRequest` will throw error when user is not authenticated.
      try {
        ({ groups = [], users = [] } = this.permissionControl!.getPrincipalsFromRequest(request));
      } catch (e) {
        return toolkit.next();
      }
      if (groups.length === 0 && users.length === 0) {
        updateWorkspaceState(request, {
          isDashboardAdmin: false,
        });
        return toolkit.next();
      }

      this.logger.info('Dynamic application configuration enabled:' + !!applicationConfig);
      if (!!applicationConfig) {
        const [coreStart] = await core.getStartServices();
        const scopeClient = coreStart.opensearch.client.asScoped(request);
        const applicationConfigClient = applicationConfig.getConfigurationClient(scopeClient);

        const [configGroups, configUsers] = await Promise.all([
          applicationConfigClient
            .getEntityConfig('workspace.dashboardAdmin.groups')
            .catch(() => undefined),
          applicationConfigClient
            .getEntityConfig('workspace.dashboardAdmin.users')
            .catch(() => undefined),
        ]);

        isRequestByDashboardAdmin(
          request,
          groups,
          users,
          configGroups ? [configGroups] : [],
          configUsers ? [configUsers] : []
        );
        return toolkit.next();
      }

      const configGroups = config.dashboardAdmin.groups || [];
      const configUsers = config.dashboardAdmin.users || [];
      isRequestByDashboardAdmin(request, groups, users, configGroups, configUsers);
      return toolkit.next();
    });

    this.workspaceSavedObjectsClientWrapper = new WorkspaceSavedObjectsClientWrapper(
      this.permissionControl
    );

    core.savedObjects.addClientWrapper(
      0,
      WORKSPACE_SAVED_OBJECTS_CLIENT_WRAPPER_ID,
      this.workspaceSavedObjectsClientWrapper.wrapperFactory
    );
  }

  constructor(initializerContext: PluginInitializerContext) {
    this.logger = initializerContext.logger.get('plugins', 'workspace');
    this.config$ = initializerContext.config.create<WorkspacePluginConfigType>();
  }

  public async setup(core: CoreSetup, { applicationConfig }: AppPluginSetupDependencies) {
    this.logger.debug('Setting up Workspaces service');
    const config: WorkspacePluginConfigType = await this.config$.pipe(first()).toPromise();
    const isPermissionControlEnabled =
      config.permission.enabled === undefined ? true : config.permission.enabled;

    this.client = new WorkspaceClient(core, this.logger);

    await this.client.setup(core);

    this.proxyWorkspaceTrafficToRealHandler(core);
    this.workspaceConflictControl = new WorkspaceConflictSavedObjectsClientWrapper();

    core.savedObjects.addClientWrapper(
      -1,
      WORKSPACE_CONFLICT_CONTROL_SAVED_OBJECTS_CLIENT_WRAPPER_ID,
      this.workspaceConflictControl.wrapperFactory
    );

    this.logger.info('Workspace permission control enabled:' + isPermissionControlEnabled);
    if (isPermissionControlEnabled) this.setupPermission(core, config, { applicationConfig });

    registerRoutes({
      http: core.http,
      logger: this.logger,
      client: this.client as IWorkspaceClientImpl,
      permissionControlClient: this.permissionControl,
    });

    core.capabilities.registerProvider(() => ({
      workspaces: {
        enabled: true,
        permissionEnabled: isPermissionControlEnabled,
      },
    }));

    return {
      client: this.client,
    };
  }

  public start(core: CoreStart) {
    this.logger.debug('Starting Workspace service');
    this.permissionControl?.setup(core.savedObjects.getScopedClient, core.http.auth);
    this.client?.setSavedObjects(core.savedObjects);
    this.workspaceConflictControl?.setSerializer(core.savedObjects.createSerializer());
    this.workspaceSavedObjectsClientWrapper?.setScopedClient(core.savedObjects.getScopedClient);

    return {
      client: this.client as IWorkspaceClientImpl,
    };
  }

  public stop() {}
}
