/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { CoreSetup, RequestHandlerContext } from 'src/core/server';
import { coreMock, httpServerMock } from '../../../../../../core/server/mocks';
import { SavedObjectsErrorHelpers } from '../../../../../../core/server';
import { updateWorkspaceState } from '../../../../../../core/server/utils';
import { flightsSpecProvider, logsSpecProvider } from '../data_sets';
import { SampleDatasetSchema } from '../lib/sample_dataset_registry_types';
import { createInstallRoute } from './install';

const flightsSampleDataset = flightsSpecProvider();
const logsSampleDataset = logsSpecProvider();

const sampleDatasets: SampleDatasetSchema[] = [flightsSampleDataset, logsSampleDataset];

describe('sample data install route', () => {
  let mockCoreSetup: MockedKeys<CoreSetup>;
  // @ts-expect-error TS7034 TODO(ts-error): fixme
  let mockLogger;
  // @ts-expect-error TS7034 TODO(ts-error): fixme
  let mockUsageTracker;

  beforeEach(() => {
    mockCoreSetup = coreMock.createSetup();
    mockLogger = {
      warn: jest.fn(),
    };

    mockUsageTracker = {
      addInstall: jest.fn(),
      addUninstall: jest.fn(),
    };
  });

  it('handler calls expected api with the given request', async () => {
    const mockClient = jest.fn().mockResolvedValue(true);

    const mockSOClientGetResponse = {
      saved_objects: [
        {
          type: 'dashboard',
          id: '12345',
          namespaces: ['default'],
          attributes: { title: 'dashboard' },
        },
      ],
    };
    const mockSOClient = { bulkCreate: jest.fn().mockResolvedValue(mockSOClientGetResponse) };

    const mockContext = {
      core: {
        opensearch: {
          legacy: {
            client: { callAsCurrentUser: mockClient },
          },
        },
        savedObjects: { client: mockSOClient },
      },
    };
    const mockBody = { id: 'flights' };
    const mockQuery = {};
    const mockRequest = httpServerMock.createOpenSearchDashboardsRequest({
      params: mockBody,
      query: mockQuery,
    });
    const mockResponse = httpServerMock.createResponseFactory();

    createInstallRoute(
      mockCoreSetup.http.createRouter(),
      sampleDatasets,
      // @ts-expect-error TS7005 TODO(ts-error): fixme
      mockLogger,
      // @ts-expect-error TS7005 TODO(ts-error): fixme
      mockUsageTracker
    );

    const mockRouter = mockCoreSetup.http.createRouter.mock.results[0].value;
    const handler = mockRouter.post.mock.calls[0][1];

    await handler((mockContext as unknown) as RequestHandlerContext, mockRequest, mockResponse);

    expect(mockClient.mock.calls[1][1].body.settings).toMatchObject({
      index: { number_of_shards: 1, auto_expand_replicas: '0-1' },
    });

    // expect(mockClient).toBeCalledTimes(2);
    expect(mockResponse.ok).toBeCalled();
    expect(mockResponse.ok.mock.calls[0][0]).toMatchObject({
      body: {
        opensearchIndicesCreated: { opensearch_dashboards_sample_data_flights: 13059 },
        opensearchDashboardsSavedObjectsLoaded: 20,
      },
    });
  });

  it('handler calls expected api with the given request with data source', async () => {
    const mockDataSourceId = 'dataSource';

    const mockClient = jest.fn().mockResolvedValue(true);

    const mockSOClientGetResponse = {
      saved_objects: [
        {
          type: 'dashboard',
          id: '12345',
          namespaces: ['default'],
          attributes: { title: 'dashboard' },
        },
      ],
    };
    const mockSOClient = {
      bulkCreate: jest.fn().mockResolvedValue(mockSOClientGetResponse),
      get: jest.fn().mockResolvedValue(mockSOClientGetResponse),
    };

    const mockContext = {
      dataSource: {
        opensearch: {
          legacy: {
            // @ts-expect-error TS7006 TODO(ts-error): fixme
            getClient: (id) => {
              return {
                callAPI: mockClient,
              };
            },
          },
        },
      },
      core: {
        savedObjects: { client: mockSOClient },
      },
    };
    const mockBody = { id: 'flights' };
    const mockQuery = { data_source_id: mockDataSourceId };
    const mockRequest = httpServerMock.createOpenSearchDashboardsRequest({
      params: mockBody,
      query: mockQuery,
    });
    const mockResponse = httpServerMock.createResponseFactory();

    createInstallRoute(
      mockCoreSetup.http.createRouter(),
      sampleDatasets,
      // @ts-expect-error TS7005 TODO(ts-error): fixme
      mockLogger,
      // @ts-expect-error TS7005 TODO(ts-error): fixme
      mockUsageTracker
    );

    const mockRouter = mockCoreSetup.http.createRouter.mock.results[0].value;
    const handler = mockRouter.post.mock.calls[0][1];

    await handler((mockContext as unknown) as RequestHandlerContext, mockRequest, mockResponse);

    expect(mockClient.mock.calls[1][1].body.settings).toMatchObject({
      index: { number_of_shards: 1 },
    });

    expect(mockResponse.ok).toBeCalled();
    expect(mockResponse.ok.mock.calls[0][0]).toMatchObject({
      body: {
        opensearchIndicesCreated: { opensearch_dashboards_sample_data_flights: 13059 },
        opensearchDashboardsSavedObjectsLoaded: 20,
      },
    });
  });

  it('handler calls expected api with the given request with workspace', async () => {
    const mockWorkspaceId = 'workspace';

    const mockClient = jest.fn().mockResolvedValue(true);

    const mockSOClientGetResponse = {
      saved_objects: [
        {
          type: 'dashboard',
          id: '12345',
          namespaces: ['default'],
          attributes: { title: 'dashboard' },
        },
      ],
    };
    const mockSOClient = {
      bulkCreate: jest.fn().mockResolvedValue(mockSOClientGetResponse),
      get: jest.fn().mockResolvedValue(mockSOClientGetResponse),
    };

    const mockContext = {
      core: {
        opensearch: {
          legacy: {
            client: { callAsCurrentUser: mockClient },
          },
        },
        savedObjects: { client: mockSOClient },
      },
    };
    const mockBody = { id: 'flights' };
    const mockQuery = {};
    const mockRequest = httpServerMock.createOpenSearchDashboardsRequest({
      params: mockBody,
      query: mockQuery,
    });
    updateWorkspaceState(mockRequest, { requestWorkspaceId: mockWorkspaceId });
    const mockResponse = httpServerMock.createResponseFactory();

    createInstallRoute(
      mockCoreSetup.http.createRouter(),
      sampleDatasets,
      // @ts-expect-error TS7005 TODO(ts-error): fixme
      mockLogger,
      // @ts-expect-error TS7005 TODO(ts-error): fixme
      mockUsageTracker
    );

    const mockRouter = mockCoreSetup.http.createRouter.mock.results[0].value;
    const handler = mockRouter.post.mock.calls[0][1];

    await handler((mockContext as unknown) as RequestHandlerContext, mockRequest, mockResponse);

    expect(mockClient.mock.calls[1][1].body.settings).toMatchObject({
      index: { number_of_shards: 1 },
    });

    expect(mockResponse.ok).toBeCalled();
    expect(mockResponse.ok.mock.calls[0][0]).toMatchObject({
      body: {
        opensearchIndicesCreated: { opensearch_dashboards_sample_data_flights: 13059 },
        opensearchDashboardsSavedObjectsLoaded: 20,
      },
    });
  });

  it('handler response forbidden error when bulkCreate forbidden inside workspace', async () => {
    const mockWorkspaceId = 'workspace';

    const mockClient = jest.fn().mockResolvedValue(true);

    const mockSOClientGetResponse = {
      saved_objects: [
        {
          type: 'dashboard',
          id: '12345',
          namespaces: ['default'],
          attributes: { title: 'dashboard' },
        },
      ],
    };
    const mockSOClient = {
      bulkCreate: jest
        .fn()
        .mockRejectedValue(
          SavedObjectsErrorHelpers.decorateForbiddenError(new Error('Invalid workspace permission'))
        ),
      get: jest.fn().mockResolvedValue(mockSOClientGetResponse),
    };

    const mockContext = {
      core: {
        opensearch: {
          legacy: {
            client: { callAsCurrentUser: mockClient },
          },
        },
        savedObjects: { client: mockSOClient },
      },
    };
    const mockBody = { id: 'flights' };
    const mockQuery = {};
    const mockRequest = httpServerMock.createOpenSearchDashboardsRequest({
      params: mockBody,
      query: mockQuery,
    });
    updateWorkspaceState(mockRequest, { requestWorkspaceId: mockWorkspaceId });
    const mockResponse = httpServerMock.createResponseFactory();

    createInstallRoute(
      mockCoreSetup.http.createRouter(),
      sampleDatasets,
      // @ts-expect-error TS7005 TODO(ts-error): fixme
      mockLogger,
      // @ts-expect-error TS7005 TODO(ts-error): fixme
      mockUsageTracker
    );

    const mockRouter = mockCoreSetup.http.createRouter.mock.results[0].value;
    const handler = mockRouter.post.mock.calls[0][1];

    await handler((mockContext as unknown) as RequestHandlerContext, mockRequest, mockResponse);

    expect(mockResponse.forbidden).toBeCalled();
    expect(mockResponse.forbidden.mock.calls[0][0]).toMatchObject({
      body: expect.stringContaining('Invalid workspace permission'),
    });
  });

  it('handler response internal error when bulkCreate throw error', async () => {
    const mockClient = jest.fn().mockResolvedValue(true);

    const mockSOClientGetResponse = {
      saved_objects: [
        {
          type: 'dashboard',
          id: '12345',
          namespaces: ['default'],
          attributes: { title: 'dashboard' },
        },
      ],
    };
    const mockSOClient = {
      bulkCreate: jest.fn().mockRejectedValue(new Error('Unknown error')),
      get: jest.fn().mockResolvedValue(mockSOClientGetResponse),
    };

    const mockContext = {
      core: {
        opensearch: {
          legacy: {
            client: { callAsCurrentUser: mockClient },
          },
        },
        savedObjects: { client: mockSOClient },
      },
    };
    const mockBody = { id: 'flights' };
    const mockQuery = {};
    const mockRequest = httpServerMock.createOpenSearchDashboardsRequest({
      params: mockBody,
      query: mockQuery,
    });
    const mockResponse = httpServerMock.createResponseFactory();

    createInstallRoute(
      mockCoreSetup.http.createRouter(),
      sampleDatasets,
      // @ts-expect-error TS7005 TODO(ts-error): fixme
      mockLogger,
      // @ts-expect-error TS7005 TODO(ts-error): fixme
      mockUsageTracker
    );

    const mockRouter = mockCoreSetup.http.createRouter.mock.results[0].value;
    const handler = mockRouter.post.mock.calls[0][1];

    await handler((mockContext as unknown) as RequestHandlerContext, mockRequest, mockResponse);

    expect(mockResponse.internalError).toBeCalled();
    expect(mockResponse.internalError.mock.calls[0][0]).toMatchObject({
      body: expect.stringContaining('Unknown error'),
    });
  });

  it('strips unsupported field mappings (geo, @timestamp) and installs only index-pattern for AnalyticEngine data source', async () => {
    const mockDataSourceId = 'analytic-engine-ds';

    const mockClient = jest.fn().mockResolvedValue(true);

    const mockSOClient = {
      bulkCreate: jest.fn().mockResolvedValue({ saved_objects: [] }),
      // Both the title lookup in install.ts and isAnalyticEngineDataSource read
      // this same data-source saved object.
      get: jest.fn().mockResolvedValue({
        id: mockDataSourceId,
        attributes: { title: 'AE DS', dataSourceEngineType: 'AnalyticEngine' },
      }),
    };

    const mockContext = {
      dataSource: {
        opensearch: {
          legacy: {
            // @ts-expect-error TS7006 TODO(ts-error): fixme
            getClient: (id) => {
              return {
                callAPI: mockClient,
              };
            },
          },
        },
      },
      core: {
        savedObjects: { client: mockSOClient },
      },
    };
    const mockBody = { id: 'logs' };
    const mockQuery = { data_source_id: mockDataSourceId };
    const mockRequest = httpServerMock.createOpenSearchDashboardsRequest({
      params: mockBody,
      query: mockQuery,
    });
    const mockResponse = httpServerMock.createResponseFactory();

    createInstallRoute(
      mockCoreSetup.http.createRouter(),
      sampleDatasets,
      // @ts-expect-error TS7005 TODO(ts-error): fixme
      mockLogger,
      // @ts-expect-error TS7005 TODO(ts-error): fixme
      mockUsageTracker
    );

    const mockRouter = mockCoreSetup.http.createRouter.mock.results[0].value;
    const handler = mockRouter.post.mock.calls[0][1];

    await handler((mockContext as unknown) as RequestHandlerContext, mockRequest, mockResponse);

    // 1. index created with dynamic:false and unsupported field types removed
    const createCall = mockClient.mock.calls.find((call) => call[0] === 'indices.create');
    expect(createCall).toBeDefined();
    expect(createCall![1].body.mappings.dynamic).toBe(false);
    expect(createCall![1].body.mappings.properties).not.toHaveProperty('geo');
    expect(createCall![1].body.mappings.properties).not.toHaveProperty('@timestamp');
    expect(createCall![1].body.mappings.properties).toHaveProperty('bytes');

    // 2. documents are NOT modified - geo stays in _source (dynamic:false keeps
    //    it unindexed). The dataset file/ingestion path is untouched.
    const bulkCall = mockClient.mock.calls.find((call) => call[0] === 'bulk');
    expect(bulkCall).toBeDefined();
    const firstDoc = bulkCall![1].body[1];
    expect(firstDoc).toBeDefined();
    expect(firstDoc).toHaveProperty('geo');

    // 3. only the index-pattern saved object is installed (DSL viz/dashboards skipped)
    const bulkCreatedObjects = mockSOClient.bulkCreate.mock.calls[0][0];
    expect(bulkCreatedObjects.every((so: any) => so.type === 'index-pattern')).toBe(true);

    expect(mockResponse.ok).toBeCalled();
    expect(mockResponse.ok.mock.calls[0][0]).toMatchObject({
      body: {
        opensearchIndicesCreated: { opensearch_dashboards_sample_data_logs: 14074 },
      },
    });
  });
});
