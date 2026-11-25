import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveRepoRoot } from '../src/config/env.js';

test('repository layout resolves the repo root above apps/', () => {
  const repo = path.resolve('C:/work/clinic');
  assert.equal(resolveRepoRoot(path.join(repo, 'apps', 'server')), repo);
});

test('packaged layout resolves the install folder containing server/', () => {
  const install = path.resolve('C:/Program Files/ZhanX Server');
  assert.equal(resolveRepoRoot(path.join(install, 'server')), install);
});
