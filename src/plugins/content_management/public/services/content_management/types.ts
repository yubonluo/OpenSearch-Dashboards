/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PageConfig {
  id: string;
  title?: string;
  description?: string;
}

export type Section =
  | {
      kind: 'custom';
      id: string;
      order: number;
      title?: string;
      description?: string;
      render?: (contents: Map<string, Content>) => React.ReactNode;
    }
  | {
      kind: 'dashboard';
      id: string;
      order: number;
      title?: string;
      description?: string;
    }
  | {
      kind: 'card';
      id: string;
      order: number;
      title?: string;
    };

export type Content =
  | {
      kind: 'visualization';
      id: string;
      order: number;
      input: SavedObjectInput;
    }
  | {
      kind: 'dashboard';
      id: string;
      order: number;
      input: SavedObjectInput;
    }
  | {
      kind: 'custom';
      id: string;
      order: number;
      render: () => React.ReactElement;
    }
  | {
      kind: 'card';
      id: string;
      order: number;
      title: string;
      description: string;
      onClick?: () => void;
      icon?: React.ReactElement;
      footer?: React.ReactElement;
    };

export type SavedObjectInput =
  | {
      kind: 'static';
      /**
       * The visualization id
       */
      id: string;
    }
  | {
      kind: 'dynamic';
      /**
       * A promise that returns a visualization id
       */
      get: () => Promise<string>;
    };
