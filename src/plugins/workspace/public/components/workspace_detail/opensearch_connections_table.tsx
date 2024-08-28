/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import './data_source_table.scss';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  EuiSpacer,
  EuiInMemoryTable,
  EuiBasicTableColumn,
  EuiTableSelectionType,
  EuiTableActionsColumnType,
  EuiConfirmModal,
  EuiSearchBarProps,
  EuiText,
  EuiListGroup,
  EuiListGroupItem,
  EuiIcon,
  EuiPopover,
  EuiButtonEmpty,
  EuiPopoverTitle,
  EuiSmallButton,
  EuiLink,
  EuiButtonIcon,
} from '@elastic/eui';
import { i18n } from '@osd/i18n';
import { DataSourceConnection, DataSourceConnectionType } from '../../../common/types';
import PrometheusLogo from '../../assets/prometheus_logo.svg';
import S3Logo from '../../assets/s3_logo.svg';
import { AssociationDataSourceModalTab } from '../../../common/constants';

interface OpenSearchConnectionTableProps {
  isDashboardAdmin: boolean;
  connectionType: string;
  dataSourceConnections: DataSourceConnection[];
  handleUnassignDataSources: (dataSources: DataSourceConnection[]) => Promise<void>;
}

export const OpenSearchConnectionTable = ({
  isDashboardAdmin,
  connectionType,
  dataSourceConnections,
  handleUnassignDataSources,
}: OpenSearchConnectionTableProps) => {
  const [selectedItems, setSelectedItems] = useState<DataSourceConnection[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [popoversState, setPopoversState] = useState<Record<string, boolean>>({});
  const [itemIdToExpandedRowMap, setItemIdToExpandedRowMap] = useState<
    Record<string, React.ReactNode>
  >({});

  useEffect(() => {
    // Reset selected items when connectionType changes
    setSelectedItems([]);
    setItemIdToExpandedRowMap({});
  }, [connectionType, setSelectedItems]);

  const filteredDataSources = useMemo(() => {
    return dataSourceConnections.filter(
      (dqc) => dqc.connectionType === DataSourceConnectionType.OpenSearchConnection
    );
  }, [dataSourceConnections]);

  const renderToolsLeft = useCallback(() => {
    return selectedItems.length > 0 && !modalVisible
      ? [
          <EuiSmallButton
            color="danger"
            onClick={() => setModalVisible(true)}
            data-test-subj="workspace-detail-dataSources-table-bulkRemove"
          >
            {i18n.translate('workspace.detail.dataSources.table.remove.button', {
              defaultMessage: 'Remove {numberOfSelect} association(s)',
              values: { numberOfSelect: selectedItems.length },
            })}
          </EuiSmallButton>,
        ]
      : [];
  }, [selectedItems, modalVisible]);

  const onSelectionChange = (selectedDataSources: DataSourceConnection[]) => {
    setSelectedItems(selectedDataSources);
  };

  const search: EuiSearchBarProps = {
    toolsLeft: renderToolsLeft(),
    box: {
      incremental: true,
    },
    filters: [
      {
        type: 'field_value_selection',
        field: 'type',
        name: 'Type',
        multiSelect: 'or',
        options: Array.from(
          new Set(filteredDataSources.map(({ type }) => type).filter(Boolean))
        ).map((type) => ({
          value: type!,
          name: type!,
        })),
      },
    ],
  };

  const directQueryConnectionIcon = (connector: string | undefined) => {
    switch (connector) {
      case 'Amazon S3':
        return <EuiIcon type={S3Logo} />;
      case 'Prometheus':
        return <EuiIcon type={PrometheusLogo} />;
      default:
        return <></>;
    }
  };
  const togglePopover = (itemId: string) => {
    setPopoversState((prevState) => ({
      ...prevState,
      [itemId]: !prevState[itemId],
    }));
  };

  const toggleDetails = (item: DataSourceConnection) => {
    const itemIdToExpandedRowMapValues = { ...itemIdToExpandedRowMap };
    if (itemIdToExpandedRowMapValues[item.id]) {
      delete itemIdToExpandedRowMapValues[item.id];
    } else {
      itemIdToExpandedRowMapValues[item.id] = (
        <EuiInMemoryTable
          items={item?.relatedConnections ?? []}
          itemId="id"
          columns={baseColumns}
          className="customized-table"
          rowProps={{
            className: 'customized-row',
          }}
        />
      );
    }
    setItemIdToExpandedRowMap(itemIdToExpandedRowMapValues);
  };

  const baseColumns: Array<EuiBasicTableColumn<DataSourceConnection>> = [
    ...(connectionType === AssociationDataSourceModalTab.DirectQueryConnections
      ? [
          {
            width: '40px',
            isExpander: true,
            render: (item: DataSourceConnection) =>
              item?.relatedConnections?.length ? (
                <EuiButtonIcon
                  onClick={() => toggleDetails(item)}
                  aria-label={itemIdToExpandedRowMap[item.id] ? 'Collapse' : 'Expand'}
                  iconType={itemIdToExpandedRowMap[item.id] ? 'arrowUp' : 'arrowDown'}
                />
              ) : null,
          },
        ]
      : []),
    {
      width: '25%',
      field: 'name',
      name: i18n.translate('workspace.detail.dataSources.table.title', {
        defaultMessage: 'Title',
      }),
      truncateText: true,
      render: (name: string, record) => {
        const origin = window.location.origin;
        let url: string;
        if (record.connectionType === DataSourceConnectionType.OpenSearchConnection) {
          url = `${origin}/app/dataSources/${record.id}`;
        } else {
          url = `${origin}/app/dataSources/manage/${name}?dataSourceMDSId=${record.parentId}`;
        }
        return (
          <EuiLink href={url} className="eui-textTruncate">
            {name}
          </EuiLink>
        );
      },
    },
    {
      width: '10%',
      field: 'type',
      name: i18n.translate('workspace.detail.dataSources.table.type', {
        defaultMessage: 'Type',
      }),
      truncateText: true,
    },
    {
      width: '35%',
      field: 'description',
      name: i18n.translate('workspace.detail.dataSources.table.description', {
        defaultMessage: 'Description',
      }),
      truncateText: true,
    },
    {
      field: 'relatedConnections',
      name: i18n.translate('workspace.detail.dataSources.table.relatedConnections', {
        defaultMessage: 'Related connections',
      }),
      align: 'right',
      truncateText: true,
      render: (relatedConnections: DataSourceConnection[], record) =>
        relatedConnections?.length > 0 ? (
          <EuiPopover
            key={record.id}
            panelPaddingSize="s"
            anchorPosition="downRight"
            isOpen={popoversState[record.id] || false}
            closePopover={() => togglePopover(record.id)}
            button={
              <EuiButtonEmpty
                size="xs"
                flush="right"
                color="text"
                onClick={() => togglePopover(record.id)}
              >
                {relatedConnections?.length}
              </EuiButtonEmpty>
            }
          >
            <EuiPopoverTitle>
              {i18n.translate('workspace.detail.dataSources.recentConnections.title', {
                defaultMessage: 'RELATED CONNECTIONS',
              })}
            </EuiPopoverTitle>
            <EuiListGroup
              flush
              maxWidth={200}
              className="eui-yScrollWithShadows"
              style={{ maxHeight: '90px' }}
            >
              {relatedConnections.map((item) => (
                <EuiListGroupItem
                  key={item.id}
                  size="xs"
                  label={item.name}
                  icon={directQueryConnectionIcon(item.type)}
                  style={{ maxHeight: '30px' }}
                />
              ))}
            </EuiListGroup>
          </EuiPopover>
        ) : (
          <EuiText>—</EuiText>
        ),
    },
  ];

  const columns: Array<EuiBasicTableColumn<DataSourceConnection>> = [
    ...baseColumns,
    ...(isDashboardAdmin
      ? [
          {
            name: i18n.translate('workspace.detail.dataSources.table.actions', {
              defaultMessage: 'Actions',
            }),
            actions: [
              {
                name: i18n.translate('workspace.detail.dataSources.table.actions.remove.name', {
                  defaultMessage: 'Remove association',
                }),
                isPrimary: true,
                description: i18n.translate(
                  'workspace.detail.dataSources.table.actions.remove.description',
                  {
                    defaultMessage: 'Remove association',
                  }
                ),
                icon: 'unlink',
                type: 'icon',
                onClick: (item: DataSourceConnection) => {
                  setSelectedItems([item]);
                  setModalVisible(true);
                },
                'data-test-subj': 'workspace-detail-dataSources-table-actions-remove',
              },
            ],
          } as EuiTableActionsColumnType<DataSourceConnection>,
        ]
      : []),
  ];

  const selection: EuiTableSelectionType<DataSourceConnection> = {
    selectable: () => isDashboardAdmin,
    onSelectionChange,
  };

  return (
    <>
      <EuiInMemoryTable
        items={filteredDataSources}
        itemId="id"
        columns={columns}
        selection={selection}
        search={search}
        key={connectionType}
        isSelectable={true}
        itemIdToExpandedRowMap={itemIdToExpandedRowMap}
        isExpandable={true}
        pagination={{
          initialPageSize: 10,
          pageSizeOptions: [10, 20, 30],
        }}
      />
      <EuiSpacer />
      {modalVisible && (
        <EuiConfirmModal
          data-test-subj="workspaceForm-cancelModal"
          title={i18n.translate('workspace.detail.dataSources.modal.title', {
            defaultMessage: 'Remove data source(s)',
          })}
          onCancel={() => {
            setModalVisible(false);
            setSelectedItems([]);
          }}
          onConfirm={() => {
            setModalVisible(false);
            handleUnassignDataSources(selectedItems);
          }}
          cancelButtonText={i18n.translate('workspace.detail.dataSources.modal.cancelButton', {
            defaultMessage: 'Cancel',
          })}
          confirmButtonText={i18n.translate('workspace.detail.dataSources.Modal.confirmButton', {
            defaultMessage: 'Remove data source(s)',
          })}
          buttonColor="danger"
          defaultFocusedButton="confirm"
        />
      )}
    </>
  );
};
