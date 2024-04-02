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
import { isRequestByDashboardAdmin } from './saved_objects/workspace_saved_objects_client_wrapper';

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
    if (isPermissionControlEnabled) {
      this.permissionControl = new SavedObjectsPermissionControl(this.logger);

      this.logger.info('Dynamic application configuration enabled:' + !!applicationConfig);
      if (!!applicationConfig) {
        core.http.registerOnPostAuth(async (request, response, toolkit) => {
          const [coreStart] = await core.getStartServices();
          const scopeClient = coreStart.opensearch.client.asScoped(request);
          const configClient = applicationConfig.getConfigurationClient(scopeClient);

          const [adminGroups, adminUsers] = await Promise.all([
            configClient.getEntityConfig('workspace.dashboardAdmin.groups').catch(() => {
              return undefined;
            }),
            configClient.getEntityConfig('workspace.dashboardAdmin.users').catch(() => {
              return undefined;
            }),
          ]);

          const isDashboardAdmin = isRequestByDashboardAdmin(
            request,
            adminGroups ? [adminGroups] : [],
            adminUsers ? [adminUsers] : [],
            this.permissionControl!
          );
          updateWorkspaceState(request, {
            isDashboardAdmin,
          });
          return toolkit.next();
        });
      }

      this.workspaceSavedObjectsClientWrapper = new WorkspaceSavedObjectsClientWrapper(
        this.permissionControl,
        { config$: this.config$ },
        !!applicationConfig
      );

      core.savedObjects.addClientWrapper(
        0,
        WORKSPACE_SAVED_OBJECTS_CLIENT_WRAPPER_ID,
        this.workspaceSavedObjectsClientWrapper.wrapperFactory
      );
    }

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
