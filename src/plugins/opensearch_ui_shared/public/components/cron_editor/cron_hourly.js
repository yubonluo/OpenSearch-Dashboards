/*
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 * Any modifications Copyright OpenSearch Contributors. See
 * GitHub history for details.
 */

/*
 * Licensed to Elasticsearch B.V. under one or more contributor
 * license agreements. See the NOTICE file distributed with
 * this work for additional information regarding copyright
 * ownership. Elasticsearch B.V. licenses this file to you under
 * the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from '@osd/i18n/react';
import { i18n } from '@osd/i18n';

import { EuiCompressedFormRow, EuiCompressedSelect } from '@elastic/eui';

export const CronHourly = ({ minute, minuteOptions, onChange }) => (
  <Fragment>
    <EuiCompressedFormRow
      label={
        <FormattedMessage
          id="opensearchUi.cronEditor.cronHourly.fieldTimeLabel"
          defaultMessage="Minute"
        />
      }
      fullWidth
      data-test-subj="cronFrequencyConfiguration"
    >
      <EuiCompressedSelect
        options={minuteOptions}
        value={minute}
        onChange={(e) => onChange({ minute: e.target.value })}
        fullWidth
        prepend={i18n.translate('opensearchUi.cronEditor.cronHourly.fieldMinute.textAtLabel', {
          defaultMessage: 'At',
        })}
        data-test-subj="cronFrequencyHourlyMinuteSelect"
      />
    </EuiCompressedFormRow>
  </Fragment>
);

CronHourly.propTypes = {
  minute: PropTypes.string.isRequired,
  minuteOptions: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
};
