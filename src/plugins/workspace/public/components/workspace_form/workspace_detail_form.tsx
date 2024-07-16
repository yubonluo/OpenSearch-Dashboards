/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import './workspace_detail_form.scss';
import React, { useRef } from 'react';
import { EuiPanel, EuiSpacer, EuiForm, EuiFlexGroup, EuiFlexItem, EuiTitle } from '@elastic/eui';

import { WorkspaceBottomBar } from './workspace_bottom_bar';
import { WorkspaceFormProps } from './types';
import { useWorkspaceForm } from './use_workspace_form';
import { WorkspaceUseCase } from './workspace_use_case';
import { WorkspacePermissionSettingPanel } from './workspace_permission_setting_panel';
import { SelectDataSourcePanel } from './select_data_source_panel';
import { EnterDetailsPanel } from './workspace_enter_details_panel';
import {
  DetailTab,
  WorkspaceOperationType,
  selectDataSourceTitle,
  usersAndPermissionsTitle,
  workspaceDetailsTitle,
  workspaceUseCaseTitle,
} from './constants';
import { WorkspaceCreateActionPanel } from './workspace_create_action_panel';
import { WorkspaceFormErrorCallout } from './workspace_form_error_callout';

interface FormGroupProps {
  title: string;
  children: React.ReactNode;
}

const FormGroup = ({ title, children }: FormGroupProps) => (
  <EuiFlexGroup>
    <EuiFlexItem grow={false} className="workspace-detail-form-group">
      <EuiTitle size="xs">
        <h3>{title}</h3>
      </EuiTitle>
    </EuiFlexItem>
    <EuiFlexItem>{children}</EuiFlexItem>
  </EuiFlexGroup>
);

export const WorkspaceDetailForm = (props: WorkspaceFormProps) => {
  const {
    detailTab,
    application,
    savedObjects,
    defaultValues,
    operationType,
    workspaceConfigurableApps,
  } = props;
  const {
    formId,
    formData,
    formErrors,
    numberOfErrors,
    numberOfChanges,
    handleFormSubmit,
    handleColorChange,
    handleUseCasesChange,
    setPermissionSettings,
    handleNameInputChange,
    setSelectedDataSources,
    handleDescriptionChange,
  } = useWorkspaceForm(props);

  const disabledUserOrGroupInputIdsRef = useRef(
    defaultValues?.permissionSettings?.map((item) => item.id) ?? []
  );

  return (
    <EuiForm id={formId} onSubmit={handleFormSubmit} component="form">
      {numberOfErrors > 0 && (
        <>
          <WorkspaceFormErrorCallout errors={formErrors} />
          <EuiSpacer />
        </>
      )}
      <EuiPanel>
        {detailTab === DetailTab.Collaborators && (
          <FormGroup title={usersAndPermissionsTitle}>
            <WorkspacePermissionSettingPanel
              errors={formErrors.permissionSettings?.fields}
              onChange={setPermissionSettings}
              permissionSettings={formData.permissionSettings}
              disabledUserOrGroupInputIds={disabledUserOrGroupInputIdsRef.current}
              data-test-subj={`workspaceForm-permissionSettingPanel`}
            />
          </FormGroup>
        )}
        {detailTab === DetailTab.Settings && (
          <>
            <FormGroup title={workspaceDetailsTitle}>
              <EnterDetailsPanel
                formErrors={formErrors}
                name={formData.name}
                description={formData.description}
                color={formData.color}
                readOnly={!!defaultValues?.reserved}
                handleNameInputChange={handleNameInputChange}
                handleDescriptionChange={handleDescriptionChange}
                handleColorChange={handleColorChange}
              />
            </FormGroup>

            <FormGroup title={workspaceUseCaseTitle}>
              <WorkspaceUseCase
                configurableApps={workspaceConfigurableApps}
                value={formData.useCases}
                onChange={handleUseCasesChange}
                formErrors={formErrors}
              />
            </FormGroup>

            <FormGroup title={selectDataSourceTitle}>
              <SelectDataSourcePanel
                errors={formErrors.selectedDataSources}
                onChange={setSelectedDataSources}
                savedObjects={savedObjects}
                selectedDataSources={formData.selectedDataSources}
                data-test-subj="workspaceForm-dataSourcePanel"
              />
            </FormGroup>
          </>
        )}
      </EuiPanel>
      <EuiSpacer />
      {operationType === WorkspaceOperationType.Create && (
        <WorkspaceCreateActionPanel formId={formId} application={application} />
      )}
      {operationType === WorkspaceOperationType.Update && (
        <WorkspaceBottomBar
          formId={formId}
          application={application}
          numberOfChanges={numberOfChanges}
        />
      )}
    </EuiForm>
  );
};
