/* eslint-disable @nx/enforce-module-boundaries */
import { createVitestConfig } from '../../../vitest.base';

export default createVitestConfig({
  // Package-specific overrides
  outputFile: '../../../reports/packages/common/has-date/vitest-unit-test.xml',
});
