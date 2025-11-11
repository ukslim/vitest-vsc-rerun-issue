import { createVitestConfig } from './vitest.base';

export default createVitestConfig({
  // Testing sidebar specific overrides
  projects: ['packages/*/*'],
});
