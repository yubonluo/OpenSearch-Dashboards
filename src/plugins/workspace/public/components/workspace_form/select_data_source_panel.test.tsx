/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { fireEvent, render, act, waitFor } from '@testing-library/react';
import { SelectDataSourcePanel, SelectDataSourcePanelProps } from './select_data_source_panel';
import { coreMock } from '../../../../../core/public/mocks';
import * as utils from '../../utils';

const currentAssignedDataSources = [
  {
    id: 'id1',
    name: 'title1',
    description: 'ds-1-description',
    type: 'OpenSearch',
    connectionType: 0,
  },
  {
    id: 'id2',
    name: 'title2',
    description: 'ds-1-description',
    type: 'S3GLUE',
    connectionType: 0,
  },
];

const dataSources = [
  {
    id: 'id3',
    title: 'title3',
    description: 'ds-3-description',
    auth: '',
    dataSourceEngineType: '',
    workspaces: [],
  },
  {
    id: 'id4',
    title: 'title4',
    description: 'ds-4-description',
    auth: '',
    dataSourceEngineType: '',
    workspaces: [],
  },
];

jest.spyOn(utils, 'getDataSourcesList').mockResolvedValue(dataSources);

const mockCoreStart = coreMock.createStart();

const setup = ({
  savedObjects = mockCoreStart.savedObjects,
  assignedDataSources = [],
  onChange = jest.fn(),
  errors = undefined,
  isDashboardAdmin = true,
}: Partial<SelectDataSourcePanelProps>) => {
  return render(
    <SelectDataSourcePanel
      onChange={onChange}
      savedObjects={savedObjects}
      assignedDataSources={assignedDataSources}
      errors={errors}
      isDashboardAdmin={isDashboardAdmin}
    />
  );
};

describe('SelectDataSourcePanel', () => {
  it('should render consistent data sources when selected data sources passed', () => {
    const { getByText } = setup({ assignedDataSources: currentAssignedDataSources });

    expect(getByText(currentAssignedDataSources[0].name)).toBeInTheDocument();
    expect(getByText(currentAssignedDataSources[1].name)).toBeInTheDocument();
  });

  it('should call onChange when updating data sources', async () => {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      value: 600,
    });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      value: 600,
    });
    const onChangeMock = jest.fn();
    const { getByTestId, getAllByText, getByText } = setup({
      onChange: onChangeMock,
      assignedDataSources: [],
    });

    expect(onChangeMock).not.toHaveBeenCalled();
    fireEvent.click(getByTestId('workspace-creator-dataSources-assign-button'));

    await waitFor(() => {
      expect(getByText(dataSources[0].title)).toBeInTheDocument();
    });

    fireEvent.click(getAllByText(dataSources[0].title)[0]);
    fireEvent.click(getByText('Associate data sources'));
    expect(onChangeMock).toHaveBeenCalledWith([
      {
        connectionType: 0,
        description: 'ds-3-description',
        id: 'id3',
        name: 'title3',
        relatedConnections: [],
        type: '',
      },
    ]);
  });

  it('should call onChange when deleting selected data source', async () => {
    const onChangeMock = jest.fn();
    const { getByTestId } = setup({
      onChange: onChangeMock,
      assignedDataSources: [{ id: '', name: '', type: '', connectionType: 0 }],
    });
    expect(onChangeMock).not.toHaveBeenCalled();
    await act(() => {
      fireEvent.click(getByTestId('workspace-detail-dataSources-table-actions-remove'));
    });
    expect(onChangeMock).toHaveBeenCalledWith([]);
  });
});
