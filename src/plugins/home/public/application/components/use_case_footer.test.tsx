/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
import { UseCaseFooter as UseCaseFooterComponent } from './use_case_footer';
import { CoreStart, WorkspaceObject } from '../../../../../core/public';
import { coreMock, httpServiceMock } from '../../../../../core/public/mocks';
import { createOpenSearchDashboardsReactContext } from 'src/plugins/opensearch_dashboards_react/public';
import { IntlProvider } from 'react-intl';

const mockBasePath = httpServiceMock.createSetupContract().basePath;
const getUrl = (appId: string) => `https://test.com/app/${appId}`;

const createWorkspace = (id: string, name: string, useCaseId: string) => ({
  id,
  name,
  description: '',
  features: [useCaseId],
  reserved: false,
  permissions: {
    library_write: { users: [] },
    write: { users: [] },
  },
});

const UseCaseFooter = (props: any) => {
  return (
    <IntlProvider locale="en">
      <UseCaseFooterComponent {...props} />
    </IntlProvider>
  );
};

describe('UseCaseFooter', () => {
  it('renders create workspace button for admin when no workspaces within use case exist', () => {
    const { getByTestId } = render(
      <UseCaseFooter
        useCaseId="analytics"
        workspaceList={[]}
        basePath={mockBasePath}
        isDashBoardAdmin={true}
        getUrl={getUrl}
      />
    );

    const button = getByTestId('useCase.footer.disable.createWorkspace.button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('href', 'https://test.com/app/workspace_create');
  });

  it('renders disabled button with tooltip for non-admin when no workspaces exist', () => {
    const { getByTestId } = render(
      <UseCaseFooter
        useCaseId="analytics"
        workspaceList={[]}
        basePath={mockBasePath}
        isDashBoardAdmin={false}
        getUrl={getUrl}
      />
    );

    const button = getByTestId('useCase.footer.disable.openWorkspace.button');
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it('renders open workspace button when one workspace exists', () => {
    const { getByTestId } = render(
      <UseCaseFooter
        useCaseId="observability"
        workspaceList={[createWorkspace('1', 'Workspace 1', 'use-case-observability')]}
        basePath={mockBasePath}
        isDashBoardAdmin={false}
        getUrl={getUrl}
      />
    );

    const button = getByTestId('useCase.footer.disable.openWorkspace.button');
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('href', 'https://test.com/w/1/app/workspace_overview');
  });

  it('renders select workspace popover when multiple workspaces exist', () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      value: {
        assign: jest.fn(),
      },
    });
    const workspaces = [
      createWorkspace('1', 'Workspace 1', 'use-case-observability'),
      createWorkspace('2', 'Workspace 2', 'use-case-observability'),
    ];
    render(
      <UseCaseFooter
        useCaseId="observability"
        workspaceList={workspaces}
        basePath={mockBasePath}
        isDashBoardAdmin={false}
        getUrl={getUrl}
      />
    );

    const button = screen.getByText('Select workspace');
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(screen.getByText('Workspace 1')).toBeInTheDocument();
    expect(screen.getByText('Workspace 2')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Workspace 1'));
    expect(window.location.assign).toHaveBeenCalledWith(
      'https://test.com/w/1/app/workspace_overview'
    );
    Object.defineProperty(window, 'location', {
      value: originalLocation,
    });
  });
});
