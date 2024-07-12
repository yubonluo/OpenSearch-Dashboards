/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { EuiButton, EuiPopover, EuiContextMenu, EuiAvatar, EuiToolTip } from '@elastic/eui';
import React, { useMemo, useState } from 'react';
import { FormattedMessage } from 'react-intl';
import { i18n } from '@osd/i18n';
import { formatUrlWithWorkspaceId } from '../../../../../core/public/utils';
import { getUseCaseFromFeatureConfig } from '../../../../workspace/public';
import { IBasePath, WorkspaceObject } from '../../../../../core/public';

interface UseCaseFooterProps {
  useCaseId: string;
  workspaceList: WorkspaceObject[];
  basePath: IBasePath;
  isDashBoardAdmin: boolean;
  getUrl: Function;
}

export const UseCaseFooter: React.FC<UseCaseFooterProps> = ({
  useCaseId,
  workspaceList,
  basePath,
  isDashBoardAdmin,
  getUrl,
}) => {
  const [isPopoverOpen, setPopover] = useState(false);
  const filterWorkspaces = useMemo(
    () =>
      workspaceList.filter(
        (workspace) =>
          workspace.features?.map(getUseCaseFromFeatureConfig).filter(Boolean)[0] === useCaseId
      ),
    [useCaseId, workspaceList]
  );

  if (filterWorkspaces.length === 0) {
    const toolTipMessage = i18n.translate('useCase.footer.toolTipMessage', {
      defaultMessage: 'You have no workspaces with {useCaseId}, please contact to OSD Admin.',
      values: {
        useCaseId,
      },
    });
    return isDashBoardAdmin ? (
      <EuiButton
        iconType="plus"
        href={getUrl('workspace_create', {
          absolute: false,
        })}
      >
        <FormattedMessage id="useCase.footer.createWorkspace" defaultMessage="Create workspace" />
      </EuiButton>
    ) : (
      <EuiToolTip content={toolTipMessage} position="top">
        <EuiButton isDisabled={true}>
          <FormattedMessage id="useCase.footer.disable.openWorkspace" defaultMessage="Open" />
        </EuiButton>
      </EuiToolTip>
    );
  }

  if (filterWorkspaces.length === 1) {
    const URL = formatUrlWithWorkspaceId(
      getUrl('workspace_overview', { absolute: false }),
      filterWorkspaces[0].id,
      basePath
    );
    return (
      <EuiButton href={URL}>
        <FormattedMessage id="useCase.footer.openWorkspace" defaultMessage="Open" />
      </EuiButton>
    );
  }

  const workspaceToItem = (workspace: WorkspaceObject) => {
    const workspaceURL = formatUrlWithWorkspaceId(
      getUrl('workspace_overview', { absolute: false }),
      workspace.id,
      basePath
    );
    const workspaceName = workspace.name;

    return {
      name: workspaceName,
      key: workspace.id,
      icon: (
        <EuiAvatar
          size="s"
          type="space"
          name={workspaceName}
          color={workspace.color}
          initialsLength={2}
        />
      ),
      onClick: () => {
        window.location.assign(workspaceURL);
      },
    };
  };

  const onButtonClick = () => {
    setPopover(!isPopoverOpen);
  };

  const closePopover = () => {
    setPopover(false);
  };

  const button = (
    <EuiButton iconType="arrowDown" iconSide="right" onClick={onButtonClick}>
      <FormattedMessage id="useCase.footer.selectWorkspace" defaultMessage="Select workspace" />
    </EuiButton>
  );
  const panels = [
    {
      id: 0,
      items: filterWorkspaces.map(workspaceToItem),
    },
  ];

  return (
    <EuiPopover
      id="useCaseFooterSelectWorkspace"
      button={button}
      isOpen={isPopoverOpen}
      closePopover={closePopover}
      panelPaddingSize="none"
      anchorPosition="downCenter"
    >
      <EuiContextMenu initialPanelId={0} panels={panels} />
    </EuiPopover>
  );
};
