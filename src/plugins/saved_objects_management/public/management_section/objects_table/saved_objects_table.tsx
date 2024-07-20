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

/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import React, { Component } from 'react';
import { debounce } from 'lodash';
// @ts-expect-error
import { saveAs } from '@elastic/filesaver';
import {
  EuiSpacer,
  Query,
  EuiInMemoryTable,
  EuiIcon,
  EuiConfirmModal,
  EuiLoadingSpinner,
  EuiOverlayMask,
  EUI_MODAL_CONFIRM_BUTTON,
  EuiCompressedCheckboxGroup,
  EuiToolTip,
  EuiPageContent,
  EuiCompressedSwitch,
  EuiModal,
  EuiModalHeader,
  EuiModalBody,
  EuiModalFooter,
  EuiSmallButtonEmpty,
  EuiSmallButton,
  EuiModalHeaderTitle,
  EuiCompressedFormRow,
  EuiFlexGroup,
  EuiFlexItem,
  EuiText,
} from '@elastic/eui';
import { i18n } from '@osd/i18n';
import { FormattedMessage } from '@osd/i18n/react';
import { DataSourceManagementPluginSetup } from 'src/plugins/data_source_management/public';
import {
  SavedObjectsClientContract,
  SavedObjectsFindOptions,
  HttpStart,
  OverlayStart,
  NotificationsStart,
  ApplicationStart,
  WorkspacesStart,
  WorkspaceAttribute,
} from 'src/core/public';
import { Subscription } from 'rxjs';
import { RedirectAppLinks } from '../../../../opensearch_dashboards_react/public';
import { IndexPatternsContract } from '../../../../data/public';
import {
  parseQuery,
  getSavedObjectCounts,
  SavedObjectCountOptions,
  getRelationships,
  getSavedObjectLabel,
  fetchExportObjects,
  fetchExportByTypeAndSearch,
  filterQuery,
  findObjects,
  findObject,
  extractExportDetails,
  SavedObjectsExportResultDetails,
} from '../../lib';
import { SavedObjectWithMetadata } from '../../types';
import {
  ISavedObjectsManagementServiceRegistry,
  SavedObjectsManagementActionServiceStart,
  SavedObjectsManagementColumnServiceStart,
  SavedObjectsManagementNamespaceServiceStart,
} from '../../services';
import { Header, Table, Flyout, Relationships } from './components';
import { DataPublicPluginStart } from '../../../../../plugins/data/public';
import { formatWorkspaceIdParams } from '../../utils';

interface ExportAllOption {
  id: string;
  label: string;
}

export interface SavedObjectsTableProps {
  allowedTypes: string[];
  serviceRegistry: ISavedObjectsManagementServiceRegistry;
  actionRegistry: SavedObjectsManagementActionServiceStart;
  columnRegistry: SavedObjectsManagementColumnServiceStart;
  namespaceRegistry: SavedObjectsManagementNamespaceServiceStart;
  savedObjectsClient: SavedObjectsClientContract;
  indexPatterns: IndexPatternsContract;
  http: HttpStart;
  search: DataPublicPluginStart['search'];
  overlays: OverlayStart;
  notifications: NotificationsStart;
  applications: ApplicationStart;
  workspaces: WorkspacesStart;
  perPageConfig: number;
  goInspectObject: (obj: SavedObjectWithMetadata) => void;
  canGoInApp: (obj: SavedObjectWithMetadata) => boolean;
  dateFormat: string;
  dataSourceEnabled: boolean;
  dataSourceManagement?: DataSourceManagementPluginSetup;
}

export interface SavedObjectsTableState {
  totalCount: number;
  page: number;
  perPage: number;
  savedObjects: SavedObjectWithMetadata[];
  savedObjectCounts: Record<string, Record<string, number>>;
  activeQuery: Query;
  selectedSavedObjects: SavedObjectWithMetadata[];
  isShowingImportFlyout: boolean;
  isSearching: boolean;
  filteredItemCount: number;
  isShowingRelationships: boolean;
  relationshipObject?: SavedObjectWithMetadata;
  isShowingDeleteConfirmModal: boolean;
  isShowingExportAllOptionsModal: boolean;
  isDeleting: boolean;
  exportAllOptions: ExportAllOption[];
  exportAllSelectedOptions: Record<string, boolean>;
  isIncludeReferencesDeepChecked: boolean;
  currentWorkspaceId?: string;
  workspaceEnabled: boolean;
  availableWorkspaces?: WorkspaceAttribute[];
}
export class SavedObjectsTable extends Component<SavedObjectsTableProps, SavedObjectsTableState> {
  private _isMounted = false;
  private currentWorkspaceIdSubscription?: Subscription;
  private workspacesSubscription?: Subscription;

  constructor(props: SavedObjectsTableProps) {
    super(props);

    const typeCounts = props.allowedTypes.reduce((typeToCountMap, type) => {
      typeToCountMap[type] = 0;
      return typeToCountMap;
    }, {} as Record<string, number>);

    this.state = {
      totalCount: 0,
      page: 0,
      perPage: props.perPageConfig || 50,
      savedObjects: [],
      savedObjectCounts: { type: typeCounts } as Record<string, Record<string, number>>,
      activeQuery: Query.parse(''),
      selectedSavedObjects: [],
      isShowingImportFlyout: false,
      isSearching: false,
      filteredItemCount: 0,
      isShowingRelationships: false,
      relationshipObject: undefined,
      isShowingDeleteConfirmModal: false,
      isShowingExportAllOptionsModal: false,
      isDeleting: false,
      exportAllOptions: [],
      exportAllSelectedOptions: {},
      isIncludeReferencesDeepChecked: true,
      currentWorkspaceId: this.props.workspaces.currentWorkspaceId$.getValue(),
      availableWorkspaces: this.props.workspaces.workspaceList$.getValue(),
      workspaceEnabled: this.props.applications.capabilities.workspaces.enabled,
    };
  }

  private get workspaceIdQuery() {
    const { currentWorkspaceId, workspaceEnabled } = this.state;
    // workspace is turned off
    if (!workspaceEnabled) {
      return undefined;
    } else {
      // not in any workspace
      if (!currentWorkspaceId) {
        return undefined;
      } else {
        return [currentWorkspaceId];
      }
    }
  }

  private get workspaceNameIdLookup() {
    const { availableWorkspaces } = this.state;
    const workspaceNameIdMap = new Map<string, string>();
    // workspace name is unique across the system
    availableWorkspaces?.forEach((workspace) => {
      workspaceNameIdMap.set(workspace.name, workspace.id);
    });
    return workspaceNameIdMap;
  }

  /**
   * convert workspace names to ids
   * @param workspaceNames workspace name list
   * @returns workspace id list
   */
  private workspaceNamesToIds(workspaceNames?: string[]): string[] | undefined {
    return workspaceNames
      ?.map((wsName) => this.workspaceNameIdLookup.get(wsName) || '')
      .filter((wsId) => !!wsId);
  }

  componentDidMount() {
    this._isMounted = true;
    this.subscribeWorkspace();
    this.fetchSavedObjects();
    this.fetchCounts();
  }

  componentWillUnmount() {
    this._isMounted = false;
    this.debouncedFetchObjects.cancel();
    this.unSubscribeWorkspace();
  }

  fetchCounts = async () => {
    const { allowedTypes, namespaceRegistry } = this.props;
    const { queryText, visibleTypes, visibleNamespaces, visibleWorkspaces } = parseQuery(
      this.state.activeQuery
    );

    const filteredTypes = filterQuery(allowedTypes, visibleTypes);

    const availableNamespaces = namespaceRegistry.getAll()?.map((ns) => ns.id) || [];

    const filteredCountOptions: SavedObjectCountOptions = formatWorkspaceIdParams({
      typesToInclude: filteredTypes,
      searchString: queryText,
      workspaces: this.workspaceIdQuery,
      availableWorkspaces: this.state.availableWorkspaces?.map((ws) => ws.id),
    });

    if (availableNamespaces.length) {
      const filteredNamespaces = filterQuery(availableNamespaces, visibleNamespaces);
      filteredCountOptions.namespacesToInclude = filteredNamespaces;
    }
    if (visibleWorkspaces?.length) {
      filteredCountOptions.workspaces = this.workspaceNamesToIds(visibleWorkspaces);
    }

    // These are the saved objects visible in the table.
    const filteredSavedObjectCounts = await getSavedObjectCounts(
      this.props.http,
      filteredCountOptions
    );

    const exportAllOptions: ExportAllOption[] = [];
    const exportAllSelectedOptions: Record<string, boolean> = {};

    const filteredTypeCounts = filteredSavedObjectCounts.type || {};

    Object.keys(filteredTypeCounts).forEach((id) => {
      // Add this type as a bulk-export option.
      exportAllOptions.push({
        id,
        label: `${id} (${filteredTypeCounts[id] || 0})`,
      });

      // Select it by default.
      exportAllSelectedOptions[id] = true;
    });

    const countOptions: SavedObjectCountOptions = formatWorkspaceIdParams({
      typesToInclude: allowedTypes,
      searchString: queryText,
      workspaces: this.workspaceIdQuery,
      availableWorkspaces: this.state.availableWorkspaces?.map((ws) => ws.id),
    });

    if (availableNamespaces.length) {
      countOptions.namespacesToInclude = availableNamespaces;
    }

    // Fetch all the saved objects that exist so we can accurately populate the counts within
    // the table filter dropdown.
    const savedObjectCounts = await getSavedObjectCounts(this.props.http, countOptions);

    this.setState((state) => ({
      ...state,
      savedObjectCounts,
      exportAllOptions,
      exportAllSelectedOptions,
    }));
  };

  fetchSavedObjects = () => {
    this.setState({ isSearching: true }, this.debouncedFetchObjects);
  };

  subscribeWorkspace = () => {
    const workspace = this.props.workspaces;
    this.currentWorkspaceIdSubscription = workspace.currentWorkspaceId$.subscribe((workspaceId) =>
      this.setState({
        currentWorkspaceId: workspaceId,
      })
    );

    this.workspacesSubscription = workspace.workspaceList$.subscribe((workspaceList) => {
      this.setState({ availableWorkspaces: workspaceList });
    });
  };

  unSubscribeWorkspace = () => {
    this.currentWorkspaceIdSubscription?.unsubscribe();
    this.workspacesSubscription?.unsubscribe();
  };

  fetchSavedObject = (type: string, id: string) => {
    this.setState({ isSearching: true }, () => this.debouncedFetchObject(type, id));
  };

  debouncedFetchObjects = debounce(async () => {
    const { activeQuery: query, page, perPage } = this.state;
    const { notifications, http, allowedTypes, namespaceRegistry } = this.props;
    const { queryText, visibleTypes, visibleNamespaces, visibleWorkspaces } = parseQuery(query);
    const filteredTypes = filterQuery(allowedTypes, visibleTypes);
    // "searchFields" is missing from the "findOptions" but gets injected via the API.
    // The API extracts the fields from each uiExports.savedObjectsManagement "defaultSearchField" attribute
    const findOptions: SavedObjectsFindOptions = formatWorkspaceIdParams({
      search: queryText ? `${queryText}*` : undefined,
      perPage,
      page: page + 1,
      fields: ['id'],
      type: filteredTypes,
      workspaces: this.workspaceIdQuery,
    });

    const availableNamespaces = namespaceRegistry.getAll()?.map((ns) => ns.id) || [];
    if (availableNamespaces.length) {
      const filteredNamespaces = filterQuery(availableNamespaces, visibleNamespaces);
      findOptions.namespaces = filteredNamespaces;
    }

    if (visibleWorkspaces?.length) {
      findOptions.workspaces = this.workspaceNamesToIds(visibleWorkspaces);
    }

    if (findOptions.type.length > 1) {
      findOptions.sortField = 'type';
    }

    try {
      const resp = await findObjects(http, findOptions);
      if (!this._isMounted) {
        return;
      }

      this.setState(({ activeQuery }) => {
        // ignore results for old requests
        if (activeQuery.text !== query.text) {
          return null;
        }

        return {
          savedObjects: resp.savedObjects,
          filteredItemCount: resp.total,
          isSearching: false,
        };
      });
    } catch (error) {
      if (this._isMounted) {
        this.setState({
          isSearching: false,
        });
      }
      notifications.toasts.addDanger({
        title: i18n.translate(
          'savedObjectsManagement.objectsTable.unableFindSavedObjectsNotificationMessage',
          { defaultMessage: 'Unable find saved objects' }
        ),
        text: `${error}`,
      });
    }
  }, 300);

  debouncedFetchObject = debounce(async (type: string, id: string) => {
    const { notifications, http } = this.props;
    try {
      const resp = await findObject(http, type, id);
      if (!this._isMounted) {
        return;
      }

      this.setState(({ savedObjects, filteredItemCount }) => {
        const refreshedSavedObjects = savedObjects.map((object) =>
          object.type === type && object.id === id ? resp : object
        );
        return {
          savedObjects: refreshedSavedObjects,
          filteredItemCount,
          isSearching: false,
        };
      });
    } catch (error) {
      if (this._isMounted) {
        this.setState({
          isSearching: false,
        });
      }
      notifications.toasts.addDanger({
        title: i18n.translate(
          'savedObjectsManagement.objectsTable.unableFindSavedObjectNotificationMessage',
          { defaultMessage: 'Unable to find saved object' }
        ),
        text: `${error}`,
      });
    }
  }, 300);

  refreshObjects = async () => {
    await Promise.all([this.fetchSavedObjects(), this.fetchCounts()]);
  };

  refreshObject = async ({ type, id }: SavedObjectWithMetadata) => {
    await this.fetchSavedObject(type, id);
  };

  onSelectionChanged = (selection: SavedObjectWithMetadata[]) => {
    this.setState({ selectedSavedObjects: selection });
  };

  onQueryChange = ({ query }: { query: Query }) => {
    // TODO: Use isSameQuery to compare new query with state.activeQuery to avoid re-fetching the
    // same data we already have.
    this.setState(
      {
        activeQuery: query,
        page: 0, // Reset this on each query change
        selectedSavedObjects: [],
      },
      () => {
        this.fetchSavedObjects();
        this.fetchCounts();
      }
    );
  };

  onTableChange = async (table: any) => {
    const { index: page, size: perPage } = table.page || {};

    this.setState(
      {
        page,
        perPage,
        selectedSavedObjects: [],
      },
      this.fetchSavedObjects
    );
  };

  onShowRelationships = (object: SavedObjectWithMetadata) => {
    this.setState({
      isShowingRelationships: true,
      relationshipObject: object,
    });
  };

  onHideRelationships = () => {
    this.setState({
      isShowingRelationships: false,
      relationshipObject: undefined,
    });
  };

  onExport = async (includeReferencesDeep: boolean) => {
    const { selectedSavedObjects } = this.state;
    const { notifications, http } = this.props;
    const objectsToExport = selectedSavedObjects.map((obj) => ({ id: obj.id, type: obj.type }));

    let blob;
    try {
      blob = await fetchExportObjects(http, objectsToExport, includeReferencesDeep);
    } catch (e) {
      notifications.toasts.addDanger({
        title: i18n.translate('savedObjectsManagement.objectsTable.export.dangerNotification', {
          defaultMessage: 'Unable to generate export',
        }),
      });
      throw e;
    }

    saveAs(blob, 'export.ndjson');

    const exportDetails = await extractExportDetails(blob);
    this.showExportSuccessMessage(exportDetails);
  };

  onExportAll = async () => {
    const { exportAllSelectedOptions, isIncludeReferencesDeepChecked, activeQuery } = this.state;
    const { notifications, http } = this.props;

    const { queryText, visibleWorkspaces } = parseQuery(activeQuery);
    const exportTypes = Object.entries(exportAllSelectedOptions).reduce((accum, [id, selected]) => {
      if (selected) {
        accum.push(id);
      }
      return accum;
    }, [] as string[]);

    const filteredWorkspaceIds = this.workspaceNamesToIds(visibleWorkspaces);
    const workspaces = filteredWorkspaceIds || this.workspaceIdQuery;

    let blob;
    try {
      blob = await fetchExportByTypeAndSearch(
        http,
        exportTypes,
        queryText ? `${queryText}*` : undefined,
        isIncludeReferencesDeepChecked,
        workspaces
      );
    } catch (e) {
      notifications.toasts.addDanger({
        title: i18n.translate('savedObjectsManagement.objectsTable.export.dangerNotification', {
          defaultMessage: 'Unable to generate export',
        }),
      });
      throw e;
    }

    saveAs(blob, 'export.ndjson');

    const exportDetails = await extractExportDetails(blob);
    this.showExportSuccessMessage(exportDetails);
    this.setState({ isShowingExportAllOptionsModal: false });
  };

  showExportSuccessMessage = (exportDetails: SavedObjectsExportResultDetails | undefined) => {
    const { notifications } = this.props;
    if (exportDetails && exportDetails.missingReferences.length > 0) {
      notifications.toasts.addWarning({
        title: i18n.translate(
          'savedObjectsManagement.objectsTable.export.successWithMissingRefsNotification',
          {
            defaultMessage:
              'Your file is downloading in the background. ' +
              'Some related objects could not be found. ' +
              'Please see the last line in the exported file for a list of missing objects.',
          }
        ),
      });
    } else {
      notifications.toasts.addSuccess({
        title: i18n.translate('savedObjectsManagement.objectsTable.export.successNotification', {
          defaultMessage: 'Your file is downloading in the background',
        }),
      });
    }
  };

  finishImport = () => {
    this.hideImportFlyout();
    this.fetchSavedObjects();
    this.fetchCounts();
  };

  showImportFlyout = () => {
    this.setState({ isShowingImportFlyout: true });
  };

  hideImportFlyout = () => {
    this.setState({ isShowingImportFlyout: false });
  };

  onDelete = () => {
    this.setState({ isShowingDeleteConfirmModal: true });
  };

  delete = async () => {
    const { savedObjectsClient, notifications } = this.props;
    const { selectedSavedObjects, isDeleting } = this.state;

    if (isDeleting) {
      return;
    }

    this.setState({ isDeleting: true });

    const indexPatterns = selectedSavedObjects.filter((object) => object.type === 'index-pattern');

    try {
      if (indexPatterns.length) {
        await this.props.indexPatterns.clearCache();
      }
      const objects = await savedObjectsClient.bulkGet(selectedSavedObjects);
      const deletes = objects.savedObjects.map((object) =>
        savedObjectsClient.delete(object.type, object.id, { force: true })
      );
      await Promise.all(deletes);
      // Unset this
      this.setState({
        selectedSavedObjects: [],
      });
      // Fetching all data
      await this.fetchSavedObjects();
      await this.fetchCounts();

      // Allow the user to interact with the table once the saved objects have been re-fetched.
      // If the user fails to delete the saved objects, the delete modal will continue to display.
      this.setState({ isShowingDeleteConfirmModal: false });
    } catch (error) {
      notifications.toasts.addDanger({
        title: i18n.translate(
          'savedObjectsManagement.objectsTable.unableDeleteSavedObjectsNotificationMessage',
          { defaultMessage: 'Unable to delete saved objects' }
        ),
        text: `${error}`,
      });
    }

    this.setState({ isDeleting: false });
  };

  getRelationships = async (type: string, id: string) => {
    const { allowedTypes, http } = this.props;
    return await getRelationships(http, type, id, allowedTypes);
  };

  renderFlyout() {
    if (!this.state.isShowingImportFlyout) {
      return null;
    }
    const { applications } = this.props;
    const newIndexPatternUrl = applications.getUrlForApp('management', {
      path: 'opensearch-dashboards/indexPatterns',
    });

    return (
      <Flyout
        close={this.hideImportFlyout}
        done={this.finishImport}
        http={this.props.http}
        serviceRegistry={this.props.serviceRegistry}
        indexPatterns={this.props.indexPatterns}
        newIndexPatternUrl={newIndexPatternUrl}
        allowedTypes={this.props.allowedTypes}
        overlays={this.props.overlays}
        search={this.props.search}
        dataSourceEnabled={this.props.dataSourceEnabled}
        savedObjects={this.props.savedObjectsClient}
        notifications={this.props.notifications}
        dataSourceManagement={this.props.dataSourceManagement}
      />
    );
  }

  renderRelationships() {
    if (!this.state.isShowingRelationships) {
      return null;
    }

    return (
      <Relationships
        basePath={this.props.http.basePath}
        savedObject={this.state.relationshipObject!}
        getRelationships={this.getRelationships}
        close={this.onHideRelationships}
        goInspectObject={this.props.goInspectObject}
        canGoInApp={this.props.canGoInApp}
      />
    );
  }

  renderDeleteConfirmModal() {
    const { isShowingDeleteConfirmModal, isDeleting, selectedSavedObjects } = this.state;

    if (!isShowingDeleteConfirmModal) {
      return null;
    }

    let modal;

    if (isDeleting) {
      // Block the user from interacting with the table while its contents are being deleted.
      modal = (
        <EuiOverlayMask>
          <EuiLoadingSpinner size="xl" />
        </EuiOverlayMask>
      );
    } else {
      const onCancel = () => {
        this.setState({ isShowingDeleteConfirmModal: false });
      };

      const onConfirm = () => {
        this.delete();
      };

      modal = (
        <EuiConfirmModal
          title={
            <FormattedMessage
              id="savedObjectsManagement.objectsTable.deleteSavedObjectsConfirmModalTitle"
              defaultMessage="Delete saved objects"
            />
          }
          onCancel={onCancel}
          onConfirm={onConfirm}
          buttonColor="danger"
          cancelButtonText={
            <FormattedMessage
              id="savedObjectsManagement.objectsTable.deleteSavedObjectsConfirmModal.cancelButtonLabel"
              defaultMessage="Cancel"
            />
          }
          confirmButtonText={
            isDeleting ? (
              <FormattedMessage
                id="savedObjectsManagement.objectsTable.deleteSavedObjectsConfirmModal.deleteProcessButtonLabel"
                defaultMessage="Deleting…"
              />
            ) : (
              <FormattedMessage
                id="savedObjectsManagement.objectsTable.deleteSavedObjectsConfirmModal.deleteButtonLabel"
                defaultMessage="Delete"
              />
            )
          }
          defaultFocusedButton={EUI_MODAL_CONFIRM_BUTTON}
        >
          <EuiText size="s">
            <p>
              <FormattedMessage
                id="savedObjectsManagement.deleteSavedObjectsConfirmModalDescription"
                defaultMessage="This action will delete the following saved objects:"
              />
            </p>
          </EuiText>
          <EuiInMemoryTable
            items={selectedSavedObjects}
            columns={[
              {
                field: 'type',
                name: i18n.translate(
                  'savedObjectsManagement.objectsTable.deleteSavedObjectsConfirmModal.typeColumnName',
                  { defaultMessage: 'Type' }
                ),
                width: '50px',
                render: (type, object) => (
                  <EuiToolTip position="top" content={getSavedObjectLabel(type)}>
                    <EuiIcon type={object.meta.icon || 'apps'} />
                  </EuiToolTip>
                ),
              },
              {
                field: 'id',
                name: i18n.translate(
                  'savedObjectsManagement.objectsTable.deleteSavedObjectsConfirmModal.idColumnName',
                  { defaultMessage: 'Id' }
                ),
              },
              {
                field: 'meta.title',
                name: i18n.translate(
                  'savedObjectsManagement.objectsTable.deleteSavedObjectsConfirmModal.titleColumnName',
                  { defaultMessage: 'Title' }
                ),
              },
            ]}
            pagination={true}
            sorting={false}
          />
        </EuiConfirmModal>
      );
    }

    return modal;
  }

  changeIncludeReferencesDeep = () => {
    this.setState((state) => ({
      isIncludeReferencesDeepChecked: !state.isIncludeReferencesDeepChecked,
    }));
  };

  closeExportAllModal = () => {
    this.setState({ isShowingExportAllOptionsModal: false });
  };

  renderExportAllOptionsModal() {
    const {
      isShowingExportAllOptionsModal,
      filteredItemCount,
      exportAllOptions,
      exportAllSelectedOptions,
      isIncludeReferencesDeepChecked,
    } = this.state;

    if (!isShowingExportAllOptionsModal) {
      return null;
    }

    return (
      <EuiModal onClose={this.closeExportAllModal}>
        <EuiModalHeader>
          <EuiModalHeaderTitle>
            <FormattedMessage
              id="savedObjectsManagement.objectsTable.exportObjectsConfirmModalTitle"
              defaultMessage="Export {filteredItemCount, plural, one{# object} other {# objects}}"
              values={{
                filteredItemCount,
              }}
            />
          </EuiModalHeaderTitle>
        </EuiModalHeader>
        <EuiModalBody>
          <EuiCompressedFormRow
            label={
              <FormattedMessage
                id="savedObjectsManagement.objectsTable.exportObjectsConfirmModalDescription"
                defaultMessage="Select which types to export"
              />
            }
            labelType="legend"
          >
            <EuiCompressedCheckboxGroup
              options={exportAllOptions}
              idToSelectedMap={exportAllSelectedOptions}
              onChange={(optionId) => {
                const newExportAllSelectedOptions = {
                  ...exportAllSelectedOptions,
                  ...{
                    [optionId]: !exportAllSelectedOptions[optionId],
                  },
                };

                this.setState({
                  exportAllSelectedOptions: newExportAllSelectedOptions,
                });
              }}
            />
          </EuiCompressedFormRow>
          <EuiSpacer size="m" />
          <EuiCompressedSwitch
            name="includeReferencesDeep"
            label={
              <FormattedMessage
                id="savedObjectsManagement.objectsTable.exportObjectsConfirmModal.includeReferencesDeepLabel"
                defaultMessage="Include related objects"
              />
            }
            checked={isIncludeReferencesDeepChecked}
            onChange={this.changeIncludeReferencesDeep}
          />
        </EuiModalBody>
        <EuiModalFooter>
          <EuiFlexGroup justifyContent="flexEnd">
            <EuiFlexItem grow={false}>
              <EuiFlexGroup>
                <EuiFlexItem grow={false}>
                  <EuiSmallButtonEmpty onClick={this.closeExportAllModal}>
                    <FormattedMessage
                      id="savedObjectsManagement.objectsTable.exportObjectsConfirmModal.cancelButtonLabel"
                      defaultMessage="Cancel"
                    />
                  </EuiSmallButtonEmpty>
                </EuiFlexItem>
                <EuiFlexItem grow={false}>
                  <EuiSmallButton fill onClick={this.onExportAll}>
                    <FormattedMessage
                      id="savedObjectsManagement.objectsTable.exportObjectsConfirmModal.exportAllButtonLabel"
                      defaultMessage="Export all"
                    />
                  </EuiSmallButton>
                </EuiFlexItem>
              </EuiFlexGroup>
            </EuiFlexItem>
          </EuiFlexGroup>
        </EuiModalFooter>
      </EuiModal>
    );
  }

  render() {
    const {
      selectedSavedObjects,
      page,
      perPage,
      savedObjects,
      filteredItemCount,
      isSearching,
      savedObjectCounts,
      availableWorkspaces,
      workspaceEnabled,
      currentWorkspaceId,
    } = this.state;
    const { http, allowedTypes, applications, namespaceRegistry } = this.props;

    const selectionConfig = {
      onSelectionChange: this.onSelectionChanged,
    };
    const typeCounts = savedObjectCounts.type || {};

    const filterOptions = allowedTypes.map((type) => ({
      value: type,
      name: type,
      view: `${type} (${typeCounts[type] || 0})`,
    }));

    const filters = [
      {
        type: 'field_value_selection',
        field: 'type',
        name: i18n.translate('savedObjectsManagement.objectsTable.table.typeFilterName', {
          defaultMessage: 'Type',
        }),
        multiSelect: 'or',
        options: filterOptions,
      },
    ];

    const availableNamespaces = namespaceRegistry.getAll() || [];
    if (availableNamespaces.length) {
      const nsCounts = savedObjectCounts.namespaces || {};
      const nsFilterOptions = availableNamespaces.map((ns) => {
        return {
          name: ns.name,
          value: ns.id,
          view: `${ns.name} (${nsCounts[ns.id] || 0})`,
        };
      });

      filters.push({
        type: 'field_value_selection',
        field: 'namespaces',
        name:
          namespaceRegistry.getAlias() ||
          i18n.translate('savedObjectsManagement.objectsTable.table.namespaceFilterName', {
            defaultMessage: 'Namespaces',
          }),
        multiSelect: 'or',
        options: nsFilterOptions,
      });
    }

    // Add workspace filter
    if (workspaceEnabled && availableWorkspaces?.length) {
      const wsCounts = savedObjectCounts.workspaces || {};
      const wsFilterOptions = availableWorkspaces
        .filter((ws) => (currentWorkspaceId ? currentWorkspaceId === ws.id : true))
        .map((ws) => {
          return {
            name: ws.name,
            value: ws.name,
            view: `${ws.name} (${wsCounts[ws.id] || 0})`,
          };
        });

      filters.push({
        type: 'field_value_selection',
        field: 'workspaces',
        name: i18n.translate('savedObjectsManagement.objectsTable.table.workspaceFilterName', {
          defaultMessage: 'Workspaces',
        }),
        multiSelect: 'or',
        options: wsFilterOptions,
      });
    }

    return (
      <EuiPageContent horizontalPosition="center">
        {this.renderFlyout()}
        {this.renderRelationships()}
        {this.renderDeleteConfirmModal()}
        {this.renderExportAllOptionsModal()}
        <Header
          onExportAll={() => this.setState({ isShowingExportAllOptionsModal: true })}
          onImport={this.showImportFlyout}
          onRefresh={this.refreshObjects}
          filteredCount={filteredItemCount}
        />
        <EuiSpacer size="xs" />
        <RedirectAppLinks application={applications}>
          <Table
            basePath={http.basePath}
            itemId={'id'}
            actionRegistry={this.props.actionRegistry}
            columnRegistry={this.props.columnRegistry}
            selectionConfig={selectionConfig}
            selectedSavedObjects={selectedSavedObjects}
            onQueryChange={this.onQueryChange}
            onTableChange={this.onTableChange}
            filters={filters}
            onExport={this.onExport}
            canDelete={applications.capabilities.savedObjectsManagement.delete as boolean}
            onDelete={this.onDelete}
            onActionRefresh={this.refreshObject}
            goInspectObject={this.props.goInspectObject}
            pageIndex={page}
            pageSize={perPage}
            items={savedObjects}
            totalItemCount={filteredItemCount}
            isSearching={isSearching}
            onShowRelationships={this.onShowRelationships}
            canGoInApp={this.props.canGoInApp}
            dateFormat={this.props.dateFormat}
            availableWorkspaces={availableWorkspaces}
            currentWorkspaceId={currentWorkspaceId}
          />
        </RedirectAppLinks>
      </EuiPageContent>
    );
  }
}
