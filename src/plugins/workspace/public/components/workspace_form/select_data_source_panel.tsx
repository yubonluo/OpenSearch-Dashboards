/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  EuiSpacer,
  EuiFormLabel,
  EuiText,
  EuiFlexItem,
  EuiSmallButton,
  EuiFlexGroup,
} from '@elastic/eui';
import { i18n } from '@osd/i18n';
import { SavedObjectsStart, CoreStart } from '../../../../../core/public';
import { DataSourceConnection } from '../../../common/types';
import { WorkspaceFormError } from './types';
import { AssociationDataSourceModal } from '../workspace_detail/association_data_source_modal';
import { OpenSearchConnectionTable } from '../workspace_detail/opensearch_connections_table';
import { useOpenSearchDashboards } from '../../../../opensearch_dashboards_react/public';
import { WorkspaceClient } from '../../workspace_client';
import { AssociationDataSourceModalTab } from '../../../common/constants';

export interface SelectDataSourcePanelProps {
  errors?: { [key: number]: WorkspaceFormError };
  savedObjects: SavedObjectsStart;
  assignedDataSources: DataSourceConnection[];
  onChange: (value: DataSourceConnection[]) => void;
  isDashboardAdmin: boolean;
}

export const SelectDataSourcePanel = ({
  errors,
  onChange,
  assignedDataSources,
  savedObjects,
  isDashboardAdmin,
}: SelectDataSourcePanelProps) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItems, setSelectedItems] = useState<DataSourceConnection[]>([]);
  const {
    services: { notifications, http },
  } = useOpenSearchDashboards<{ CoreStart: CoreStart; workspaceClient: WorkspaceClient }>();

  const handleAssignDataSources = (dataSources: DataSourceConnection[]) => {
    setModalVisible(false);
    const savedDataSources: DataSourceConnection[] = [...assignedDataSources, ...dataSources];
    onChange(savedDataSources);
  };

  const handleUnassignDataSources = (dataSources: DataSourceConnection[]) => {
    const savedDataSources = (assignedDataSources ?? [])?.filter(
      ({ id }: DataSourceConnection) => !dataSources.some((item) => item.id === id)
    );
    onChange(savedDataSources);
  };

  const renderTableContent = () => {
    return (
      <OpenSearchConnectionTable
        isDashboardAdmin={isDashboardAdmin}
        dataSourceConnections={assignedDataSources}
        handleUnassignDataSources={handleUnassignDataSources}
        getSelectedItems={getSelectedItems}
        inCreatePage={true}
        connectionType={AssociationDataSourceModalTab.DirectQueryConnections}
      />
    );
  };

  const associationButton = (
    <EuiSmallButton
      iconType="plusInCircle"
      onClick={() => setModalVisible(true)}
      data-test-subj="workspace-creator-dataSources-assign-button"
    >
      {i18n.translate('workspace.form.selectDataSourcePanel.addNew', {
        defaultMessage: 'Add data sources',
      })}
    </EuiSmallButton>
  );

  const removeButton = (
    <EuiSmallButton
      iconType="unlink"
      color="danger"
      onClick={() => {
        handleUnassignDataSources(selectedItems);
      }}
      data-test-subj="workspace-creator-dataSources-assign-button"
    >
      {i18n.translate('workspace.form.selectDataSourcePanel.remove', {
        defaultMessage: 'Remove selected',
      })}
    </EuiSmallButton>
  );

  const getSelectedItems = (currentSelectedItems: DataSourceConnection[]) =>
    setSelectedItems(currentSelectedItems);

  return (
    <div>
      <EuiFormLabel>
        <EuiText size="xs">
          {i18n.translate('workspace.form.selectDataSource.subTitle', {
            defaultMessage: 'Add data sources that will be available in the workspace',
          })}
        </EuiText>
      </EuiFormLabel>
      <EuiSpacer size="m" />
      <EuiFlexGroup alignItems="center">
        {isDashboardAdmin && selectedItems.length > 0 && assignedDataSources.length > 0 && (
          <EuiFlexItem grow={false}>{removeButton}</EuiFlexItem>
        )}
        {isDashboardAdmin && <EuiFlexItem grow={false}>{associationButton}</EuiFlexItem>}
      </EuiFlexGroup>
      <EuiSpacer size="xs" />
      <EuiFlexItem style={{ maxWidth: 800 }}>
        {assignedDataSources.length > 0 && renderTableContent()}
      </EuiFlexItem>
      {modalVisible && (
        <AssociationDataSourceModal
          savedObjects={savedObjects}
          assignedConnections={assignedDataSources}
          closeModal={() => setModalVisible(false)}
          handleAssignDataSourceConnections={handleAssignDataSources}
          http={http}
          notifications={notifications}
        />
      )}
    </div>
  );
};
