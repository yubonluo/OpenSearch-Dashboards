/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import './workspace_menu.scss';
import { i18n } from '@osd/i18n';
import React, { useMemo, useState } from 'react';
import { useObservable } from 'react-use';
import {
  EuiAvatar,
  EuiButton,
  EuiButtonEmpty,
  EuiContextMenu,
  EuiFlexGroup,
  EuiFlexItem,
  EuiIcon,
  EuiListGroup,
  EuiListGroupItem,
  EuiPanel,
  EuiPopover,
} from '@elastic/eui';
import { FormattedMessage } from '@osd/i18n/react';
import { first } from 'rxjs/operators';
import { truncate } from 'lodash';
import {
  WORKSPACE_CREATE_APP_ID,
  WORKSPACE_LIST_APP_ID,
  WORKSPACE_OVERVIEW_APP_ID,
  MAX_WORKSPACE_PICKER_NUM,
  MAX_WORKSPACE_NAME_LENGTH,
} from '../../../common/constants';
import { cleanWorkspaceId, formatUrlWithWorkspaceId } from '../../../../../core/public/utils';
import { CoreStart, WorkspaceObject } from '../../../../../core/public';
import { getUseCaseFromFeatureConfig } from '../../utils';
import { recentWorkspaceManager } from '../../recent_workspace_manager';

interface Props {
  coreStart: CoreStart;
}

export const WorkspaceMenu = ({ coreStart }: Props) => {
  const [isPopoverOpen, setPopover] = useState(false);
  const currentWorkspace = useObservable(coreStart.workspaces.currentWorkspace$, null);
  const workspaceList = useObservable(coreStart.workspaces.workspaceList$, []);
  const isDashboardAdmin = !!coreStart.application.capabilities.dashboards;
  const isNewNav = coreStart.uiSettings.isOverridden('home:useNewHomePage');

  const defaultHeaderName = i18n.translate(
    'core.ui.primaryNav.workspacePickerMenu.defaultHeaderName',
    {
      defaultMessage: 'Workspaces',
    }
  );

  const filteredWorkspaceList = useMemo(() => {
    return workspaceList.slice(0, MAX_WORKSPACE_PICKER_NUM);
  }, [workspaceList]);

  const filteredRecentWorkspaces = useMemo(() => {
    return recentWorkspaceManager
      .getRecentWorkspaces()
      .map((workspaceId) => workspaceList.find((ws) => ws.id === workspaceId))
      .filter((workspace): workspace is WorkspaceObject => workspace !== undefined)
      .slice(0, MAX_WORKSPACE_PICKER_NUM);
  }, [workspaceList]);

  const currentWorkspaceName = currentWorkspace?.name ?? defaultHeaderName;

  const getUseCase = (workspace: WorkspaceObject) => {
    return workspace?.features?.map(getUseCaseFromFeatureConfig).filter(Boolean)[0];
  };

  const openPopover = () => {
    setPopover(!isPopoverOpen);
  };

  const closePopover = () => {
    setPopover(false);
  };

  const workspaceToItem = (workspace: WorkspaceObject) => {
    const workspaceURL = formatUrlWithWorkspaceId(
      coreStart.application.getUrlForApp(WORKSPACE_OVERVIEW_APP_ID, {
        absolute: false,
      }),
      workspace.id,
      coreStart.http.basePath
    );

    const workspaceName = truncate(workspace.name, { length: MAX_WORKSPACE_NAME_LENGTH });

    return {
      name: workspaceName,
      key: workspace.id,
      'data-test-subj': `context-menu-item-${workspace.id}`,
      icon: (
        <EuiAvatar
          size="s"
          type="space"
          name={workspaceName}
          color={workspace.color}
          initialsLength={2}
        />
      ),
      onClick: async () => {
        const navGroupsMap = await coreStart.chrome.navGroup
          .getNavGroupsMap$()
          .pipe(first())
          .toPromise();
        window.location.assign(workspaceURL);
      },
    };
  };

  const getWorkspaceListItems = (panelsWorkspaceList: WorkspaceObject[]) => {
    const workspaceListItems = panelsWorkspaceList.map((workspace) => workspaceToItem(workspace));
    return workspaceListItems;
  };

  const currentWorkspaceButton = (
    <>
      <EuiListGroup style={{ width: 318 }} maxWidth={false}>
        <EuiListGroupItem
          icon={
            currentWorkspace ? (
              <EuiAvatar
                size="s"
                type="space"
                name={currentWorkspace.name}
                color={currentWorkspace.color}
                initialsLength={2}
              />
            ) : (
              <EuiIcon type="spacesApp" />
            )
          }
          label={currentWorkspaceName}
          onClick={openPopover}
          extraAction={{
            color: 'subdued',
            onClick: openPopover,
            iconType: isPopoverOpen ? 'arrowDown' : 'arrowRight',
            iconSize: 's',
            'aria-label': 'Show workspace dropdown selector',
            alwaysShow: true,
          }}
          data-test-subj="current-workspace-button"
        />
      </EuiListGroup>
    </>
  );

  const allWorkspacesPanels = [
    {
      id: 0,
      title: (
        <span className="custom-title">
          <FormattedMessage
            id="core.ui.primaryNav.contextMenuTitle.allWorkspaces"
            defaultMessage="All workspaces"
          />
        </span>
      ),
      width: 280,
      items: getWorkspaceListItems(filteredWorkspaceList),
    },
  ];

  const recentWorkspacesPanels = [
    {
      id: 0,
      title: (
        <span className="custom-title">
          <FormattedMessage
            id="core.ui.primaryNav.contextMenuTitle.recentWorkspaces"
            defaultMessage="Recent workspaces"
          />
        </span>
      ),
      width: 280,
      items: getWorkspaceListItems(filteredRecentWorkspaces),
    },
  ];

  return (
    <EuiPopover
      id="workspaceDropdownMenu"
      display="block"
      button={currentWorkspaceButton}
      isOpen={isPopoverOpen}
      closePopover={closePopover}
      panelPaddingSize="none"
      anchorPosition="downCenter"
    >
      <EuiPanel paddingSize="m" hasBorder={false} color="transparent">
        <EuiFlexGroup justifyContent="center" alignItems="center" direction="column" gutterSize="s">
          {currentWorkspace ? (
            <>
              <EuiFlexItem grow={false}>
                <EuiAvatar
                  size="m"
                  type="space"
                  name={currentWorkspaceName}
                  color={currentWorkspace?.color}
                  initialsLength={2}
                />
              </EuiFlexItem>
              <EuiFlexItem grow={false} data-test-subj="context-menu-current-workspace-name">
                {currentWorkspaceName}
              </EuiFlexItem>
              <EuiFlexItem grow={false} data-test-subj="context-menu-current-use-case">
                {getUseCase(currentWorkspace)}
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiButton
                  key={'objects'}
                  color="text"
                  onClick={() => {
                    window.location.assign(
                      formatUrlWithWorkspaceId(
                        coreStart.application.getUrlForApp(WORKSPACE_OVERVIEW_APP_ID, {
                          absolute: false,
                        }),
                        currentWorkspace.id,
                        coreStart.http.basePath
                      )
                    );
                  }}
                >
                  <FormattedMessage
                    id="core.ui.primaryNav.workspace.manage"
                    defaultMessage="Manage workspace"
                  />
                </EuiButton>
              </EuiFlexItem>
            </>
          ) : (
            <>
              <EuiFlexItem grow={false}>
                <EuiAvatar size="m" color="plain" name="spacesApp" iconType="spacesApp" />
              </EuiFlexItem>
              <EuiFlexItem grow={false} data-test-subj="context-menu-current-workspace-name">
                {currentWorkspaceName}
              </EuiFlexItem>
              <EuiFlexItem grow={false}>
                <EuiButton
                  key={'objects'}
                  color="text"
                  onClick={() => {
                    window.location.assign(
                      cleanWorkspaceId(
                        coreStart.application.getUrlForApp(WORKSPACE_LIST_APP_ID, {
                          absolute: false,
                        })
                      )
                    );
                  }}
                >
                  <FormattedMessage
                    id="core.ui.primaryNav.workspaces.manage"
                    defaultMessage="Manage workspaces"
                  />
                </EuiButton>
              </EuiFlexItem>
            </>
          )}
        </EuiFlexGroup>
      </EuiPanel>
      <EuiContextMenu
        initialPanelId={0}
        panels={recentWorkspacesPanels}
        size="s"
        data-test-subj="context-menu-recent-workspaces"
      />
      <EuiContextMenu
        initialPanelId={0}
        panels={allWorkspacesPanels}
        size="s"
        data-test-subj="context-menu-all-workspaces"
      />
      <EuiPanel paddingSize="s" hasBorder={false} color="transparent">
        <EuiFlexGroup alignItems="center" justifyContent="spaceBetween" gutterSize="s">
          <EuiFlexItem grow={false}>
            <EuiButtonEmpty
              size="xs"
              flush="left"
              key={WORKSPACE_LIST_APP_ID}
              onClick={() => {
                window.location.assign(
                  cleanWorkspaceId(
                    coreStart.application.getUrlForApp(WORKSPACE_LIST_APP_ID, {
                      absolute: false,
                    })
                  )
                );
              }}
            >
              <FormattedMessage id="core.ui.primaryNav.allWorkspace" defaultMessage="View all" />
            </EuiButtonEmpty>
          </EuiFlexItem>
          {isDashboardAdmin && (
            <EuiFlexItem grow={false}>
              <EuiButton
                color="text"
                iconType="plus"
                size="s"
                key={WORKSPACE_CREATE_APP_ID}
                onClick={() => {
                  window.location.assign(
                    cleanWorkspaceId(
                      coreStart.application.getUrlForApp(WORKSPACE_CREATE_APP_ID, {
                        absolute: false,
                      })
                    )
                  );
                }}
              >
                <FormattedMessage
                  id="core.ui.primaryNav.createWorkspace"
                  defaultMessage="Create workspace"
                />
              </EuiButton>
            </EuiFlexItem>
          )}
        </EuiFlexGroup>
      </EuiPanel>
    </EuiPopover>
  );
};
