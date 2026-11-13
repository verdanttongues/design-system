// Every check CI owes (CLAUDE.md → §5), over one repository root. The build refuses to run
// on a repository that fails them, and test/repository.test.js runs them in `npm test`.

import { loadTokens } from './dtcg.js';
import { checkContrast } from './contrast.js';
import { checkOrigins, checkLicences } from './assets.js';

export function checkAll(root) {
  const loaded = loadTokens(root);
  const contrast = checkContrast(root, loaded);
  return {
    loaded,
    contrast,
    errors: {
      dtcg: loaded.errors,
      contrast: contrast.errors,
      origin: checkOrigins(root, loaded),
      licences: checkLicences(root),
    },
  };
}

export function formatErrors(errors) {
  return Object.entries(errors)
    .filter(([, list]) => list.length)
    .map(([kind, list]) => `${kind}:\n${list.map((e) => `  - ${e}`).join('\n')}`)
    .join('\n');
}
