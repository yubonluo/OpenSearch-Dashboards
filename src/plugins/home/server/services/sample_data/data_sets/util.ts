/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { SavedObject } from 'opensearch-dashboards/server';
import {
  extractTimelineExpression,
  extractVegaSpecFromSavedObject,
  updateDataSourceNameInTimeline,
  updateDataSourceNameInVegaSpec,
} from '../../../../../../core/server';
import { SampleDatasetSchema } from '../lib/sample_dataset_registry_types';

export const appendDataSourceId = (id: string) => {
  return (dataSourceId?: string, workspaceId?: string) => {
    const idWithDataSource = dataSourceId ? `${dataSourceId}_` + id : id;
    if (!workspaceId) {
      return idWithDataSource;
    }
    return `${workspaceId}_${idWithDataSource}`;
  };
};

const overrideSavedObjectId = (savedObject: SavedObject, idGenerator: (id: string) => string) => {
  savedObject.id = idGenerator(savedObject.id);
  // update reference
  if (savedObject.type === 'dashboard' || savedObject.type === 'visualization-visbuilder') {
    savedObject.references.map((reference) => {
      if (reference.id) {
        reference.id = idGenerator(reference.id);
      }
    });
  }

  // update reference
  if (savedObject.type === 'visualization' || savedObject.type === 'search') {
    // @ts-expect-error TS2571 TODO(ts-error): fixme
    const searchSourceString = savedObject.attributes?.kibanaSavedObjectMeta?.searchSourceJSON;
    // @ts-expect-error TS2571 TODO(ts-error): fixme
    const visStateString = savedObject.attributes?.visState;

    if (searchSourceString) {
      const searchSource = JSON.parse(searchSourceString);
      if (searchSource.index) {
        searchSource.index = idGenerator(searchSource.index);
        if (Array.isArray(searchSource.filter)) {
          // @ts-expect-error TS7006 TODO(ts-error): fixme
          searchSource.filter.forEach((item) => {
            if (item.meta?.index) {
              item.meta.index = idGenerator(item.meta.index);
            }
          });
        }
        // @ts-expect-error TS2571 TODO(ts-error): fixme
        savedObject.attributes.kibanaSavedObjectMeta.searchSourceJSON = JSON.stringify(
          searchSource
        );
      }
    }

    if (visStateString) {
      const visState = JSON.parse(visStateString);
      const controlList = visState.params?.controls;
      if (controlList) {
        // @ts-expect-error TS7006 TODO(ts-error): fixme
        controlList.map((control) => {
          if (control.indexPattern) {
            control.indexPattern = idGenerator(control.indexPattern);
          }
        });
      }
      // @ts-expect-error TS2571 TODO(ts-error): fixme
      savedObject.attributes.visState = JSON.stringify(visState);
    }
  }
};

export const getSavedObjectsWithDataSource = (
  saveObjectList: SavedObject[],
  dataSourceId?: string,
  dataSourceTitle?: string
): SavedObject[] => {
  if (dataSourceId) {
    const idGenerator = (id: string) => `${dataSourceId}_${id}`;
    return saveObjectList.map((saveObject) => {
      overrideSavedObjectId(saveObject, idGenerator);

      // update reference
      if (saveObject.type === 'index-pattern') {
        saveObject.references = [
          {
            id: `${dataSourceId}`,
            type: 'data-source',
            name: 'dataSource',
          },
        ];
      }

      if (dataSourceTitle) {
        if (
          saveObject.type === 'dashboard' ||
          saveObject.type === 'visualization' ||
          saveObject.type === 'search' ||
          saveObject.type === 'visualization-visbuilder'
        ) {
          // @ts-expect-error TS2571 TODO(ts-error): fixme
          saveObject.attributes.title = saveObject.attributes.title + `_${dataSourceTitle}`;
        }

        if (saveObject.type === 'visualization') {
          const vegaSpec = extractVegaSpecFromSavedObject(saveObject);

          const visualizationSavedObject = saveObject as SavedObject & {
            attributes: { visState: string };
          };
          const visStateObject = JSON.parse(visualizationSavedObject.attributes.visState);

          if (!!vegaSpec) {
            const updatedVegaSpec = updateDataSourceNameInVegaSpec({
              spec: vegaSpec,
              newDataSourceName: dataSourceTitle,
              // Spacing of 1 prevents the Sankey visualization in logs data from exceeding the default url length and breaking
              spacing: 1,
            });

            visStateObject.params.spec = updatedVegaSpec;

            // @ts-expect-error
            saveObject.attributes.visState = JSON.stringify(visStateObject);
            saveObject.references.push({
              id: `${dataSourceId}`,
              type: 'data-source',
              name: 'dataSource',
            });
          }

          const timelineExpression = extractTimelineExpression(saveObject);
          if (!!timelineExpression) {
            // Get the timeline expression with the updated data source name
            const modifiedExpression = updateDataSourceNameInTimeline(
              timelineExpression,
              dataSourceTitle
            );

            // @ts-expect-error
            const timelineStateObject = JSON.parse(saveObject.attributes?.visState);
            timelineStateObject.params.expression = modifiedExpression;
            // @ts-expect-error
            saveObject.attributes.visState = JSON.stringify(timelineStateObject);
          }

          if (visStateObject.type === 'metrics') {
            visStateObject.params.data_source_id = dataSourceId;

            visualizationSavedObject.attributes.visState = JSON.stringify(visStateObject);
            visualizationSavedObject.references.push({
              id: `${dataSourceId}`,
              type: 'data-source',
              name: 'dataSource',
            });
          }
        }
      }

      return saveObject;
    });
  }

  return saveObjectList;
};

export const overwriteSavedObjectsWithWorkspaceId = (
  savedObjectList: SavedObject[],
  workspaceId: string
) => {
  const idGenerator = (id: string) => `${workspaceId}_${id}`;
  savedObjectList.forEach((savedObject) => {
    overrideSavedObjectId(savedObject, idGenerator);
  });
  return savedObjectList;
};

export const getFinalSavedObjects = ({
  dataset,
  workspaceId,
  dataSourceId,
  dataSourceTitle,
  isEngineSupported = true,
}: {
  dataset: SampleDatasetSchema;
  workspaceId?: string;
  dataSourceId?: string;
  dataSourceTitle?: string;
  // When false (e.g. AnalyticEngine), only the index-pattern saved objects are
  // installed (DSL visualizations/dashboards are skipped) and geo fields are
  // stripped from the index-pattern field list.
  isEngineSupported?: boolean;
}) => {
  const baseSavedObjects = (() => {
    if (workspaceId && dataSourceId) {
      return overwriteSavedObjectsWithWorkspaceId(
        dataset.getDataSourceIntegratedSavedObjects(dataSourceId, dataSourceTitle),
        workspaceId
      );
    }
    if (workspaceId) {
      return dataset.getWorkspaceIntegratedSavedObjects(workspaceId);
    }
    if (dataSourceId) {
      return dataset.getDataSourceIntegratedSavedObjects(dataSourceId, dataSourceTitle);
    }

    return dataset.savedObjects;
  })();

  if (isEngineSupported) {
    return baseSavedObjects;
  }

  const fieldsToSkip = dataset.dataIndices.reduce<string[]>(
    (acc, dataIndex) => acc.concat(dataIndex.fieldsToSkipForUnsupportedEngine ?? []),
    []
  );

  // Only datasets that explicitly declare fields to skip (e.g. logs declares
  // `geo`) opt into unsupported-engine handling. Other datasets allowed on the
  // engine (e.g. otel, whose visualizations may be PPL-based) are left intact.
  if (fieldsToSkip.length === 0) {
    return baseSavedObjects;
  }

  return filterSavedObjectsForUnsupportedEngine(baseSavedObjects, fieldsToSkip);
};

// Returns true when a field name matches one of the top-level fields to skip,
// either exactly (`geo`) or as a nested child (`geo.coordinates`, `geo.src`...).
const isSkippedField = (fieldName: unknown, fieldsToSkip: string[]): boolean => {
  if (typeof fieldName !== 'string') {
    return false;
  }
  return fieldsToSkip.some((skip) => fieldName === skip || fieldName.startsWith(`${skip}.`));
};

// Removes the skipped fields (e.g. geo.*) from an index-pattern's stored field
// list. The index-pattern keeps its known fields as a JSON string in
// `attributes.fields`. A shallow clone is taken so the shared dataset spec is
// never mutated.
const stripFieldsFromIndexPattern = (
  savedObject: SavedObject,
  fieldsToSkip: string[]
): SavedObject => {
  // @ts-expect-error TS2571 attributes is typed as unknown
  const fieldsString = savedObject.attributes?.fields;
  if (typeof fieldsString !== 'string' || fieldsToSkip.length === 0) {
    return savedObject;
  }

  let parsedFields: any;
  try {
    parsedFields = JSON.parse(fieldsString);
  } catch (e) {
    // Leave the field list untouched if it cannot be parsed.
    return savedObject;
  }

  if (!Array.isArray(parsedFields)) {
    return savedObject;
  }

  const filteredFields = parsedFields.filter((field) => !isSkippedField(field?.name, fieldsToSkip));

  return {
    ...savedObject,
    attributes: {
      // @ts-expect-error TS2698 attributes is typed as unknown
      ...savedObject.attributes,
      fields: JSON.stringify(filteredFields),
    },
  };
};

// For unsupported engine types, keep only the index-pattern saved objects
// (skip DSL visualizations and dashboards) and strip skipped fields from the
// retained index patterns.
export const filterSavedObjectsForUnsupportedEngine = (
  savedObjects: SavedObject[],
  fieldsToSkip: string[]
): SavedObject[] => {
  return savedObjects
    .filter((savedObject) => savedObject.type === 'index-pattern')
    .map((savedObject) => stripFieldsFromIndexPattern(savedObject, fieldsToSkip));
};

// Returns a shallow copy of `fields` (an OpenSearch mappings `properties`
// object) with the given top-level field names removed. Used to drop geo
// mappings when installing against an unsupported engine type.
export const omitMappingFields = (fields: object, fieldsToSkip: string[]): object => {
  if (!fieldsToSkip || fieldsToSkip.length === 0) {
    return fields;
  }
  const result: Record<string, any> = { ...(fields as Record<string, any>) };
  fieldsToSkip.forEach((field) => {
    delete result[field];
  });
  return result;
};

// Helper function to get a nested field by path
export const getNestedField = (doc: any, path: string) => {
  // First check if the exact path exists as a field
  if (path in doc) {
    return doc[path];
  }
  // If not, treat it as a nested path
  return path
    .split('.')
    .reduce((obj, key) => (obj && obj[key] !== 'undefined' ? obj[key] : undefined), doc);
};

// Helper function to set a nested field by path
export const setNestedField = (doc: any, path: string, value: any) => {
  // First check if the exact path exists as a field
  if (path in doc) {
    doc[path] = value;
    return;
  }
  // If not, treat it as a nested path
  const keys = path.split('.');
  keys.reduce((obj, key, indexName) => {
    if (indexName === keys.length - 1) {
      obj[key] = value;
    } else {
      if (!obj[key]) obj[key] = {}; // Create the object if it doesn't exist
      return obj[key];
    }
  }, doc);
};
