import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noop } from '../src/index.js';

test('noop returns true', () => {
  assert.strictEqual(noop(), true);
});
