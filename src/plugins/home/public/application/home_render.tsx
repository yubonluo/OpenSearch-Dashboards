/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * This is just a demo of how to use content management plugin
 * TODO: these changes should be removed  before merge to main
 */

import React from 'react';

import { CoreStart } from 'opensearch-dashboards/public';
import { EuiIcon } from '@elastic/eui';
import { Page } from '../../../content_management/public/services';
import { WORKSPACE_USE_CASES } from '../../../workspace/public';
import { UseCaseFooter } from './components/use_case_footer';

export const GET_STARTED_SECTION_ID = 'homepage_get_started';

/**
 * Example: render a arbitrary component
 */
const renderHomeCard = () => <div>Hello World!</div>;

export const initHome = (page: Page, core: CoreStart) => {
  const useCases = [
    WORKSPACE_USE_CASES.analytics,
    WORKSPACE_USE_CASES.observability,
    WORKSPACE_USE_CASES.search,
    WORKSPACE_USE_CASES['security-analytics'],
  ];
  const workspaceEnabled = core.application.capabilities.workspaces.enabled;

  /**
   * init get started section
   */
  useCases.forEach((useCase, index) => {
    page.addContent('get_started', {
      id: useCase.id,
      kind: 'card',
      order: (index + 1) * 1000,
      description: useCase.description,
      title: useCase.title,
      icon: <EuiIcon size="xl" type={'logoOpenSearch'} />,
      footer: workspaceEnabled ? (
        <UseCaseFooter
          useCaseId={useCase.id}
          useCaseTitle={useCase.title}
          workspaceList={core.workspaces.workspaceList$.getValue()}
          basePath={core.http.basePath}
          isDashBoardAdmin={core.application.capabilities?.dashboards?.isDashboardAdmin !== false}
          getUrl={core.application.getUrlForApp}
          getCurrentNavGroup$={core.chrome.navGroup.getCurrentNavGroup$}
        />
      ) : (
        <></>
      ),
    });
  });

  /**
   * Example: embed a dashboard to homepage
   */
  page.addContent('some_dashboard', {
    id: 'dashboard_1',
    kind: 'dashboard',
    order: 0,
    input: {
      kind: 'static',
      id: '722b74f0-b882-11e8-a6d9-e546fe2bba5f',
    },
  });

  /**
   * Example: embed visualization to homepage
   */
  page.addContent('service_cards', {
    id: 'vis_1',
    order: 0,
    kind: 'visualization',
    input: {
      kind: 'dynamic',
      get: () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve('4b3ec120-b892-11e8-a6d9-e546fe2bba5f');
          }, 500);
        });
      },
    },
  });
  page.addContent('service_cards', {
    id: 'vis_2',
    order: 10,
    kind: 'visualization',
    input: {
      kind: 'dynamic',
      get: () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve('4b3ec120-b892-11e8-a6d9-e546fe2bba5f');
          }, 500);
        });
      },
    },
  });
  page.addContent('service_cards', {
    id: 'vis_3',
    order: 20,
    kind: 'visualization',
    input: {
      kind: 'static',
      id: '4b3ec120-b892-11e8-a6d9-e546fe2bba5f',
    },
  });
  page.addContent('service_cards', {
    id: 'vis_4',
    order: 30,
    kind: 'custom',
    render: renderHomeCard,
  });
};
