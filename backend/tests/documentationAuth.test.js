import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import documentationRoutes from '../routes/documentationRoutes.js';
import { PERMS, ROLES, roleHasPermission } from '../config/permissions.js';

test('private documentation endpoint does not deliver content without authentication', async () => {
  const app = express();
  app.use('/api/docs', documentationRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/docs/private`);
    const body = await response.text();
    assert.equal(response.status, 401);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.match(body, /No token provided/);
    assert.doesNotMatch(body, /Architecture|DB Schema|hosting-scaling|Cloudinary/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('only platform-level roles have the documentation permission', () => {
  assert.equal(roleHasPermission(ROLES.OWNER, PERMS.PLATFORM_DASHBOARD_VIEW), true);
  assert.equal(roleHasPermission(ROLES.PLATFORM_ADMIN, PERMS.PLATFORM_DASHBOARD_VIEW), true);
  assert.equal(roleHasPermission(ROLES.SUPPORT_MANAGER, PERMS.PLATFORM_DASHBOARD_VIEW), true);
  assert.equal(roleHasPermission(ROLES.ORG_ADMIN, PERMS.PLATFORM_DASHBOARD_VIEW), false);
  assert.equal(roleHasPermission(ROLES.ORG_MANAGER, PERMS.PLATFORM_DASHBOARD_VIEW), false);
});
