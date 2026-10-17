// Issue #15: the frontend route guards, CRM mock permissions, backend
// middleware and the API permission checks must all come from ONE role
// matrix. This test fails the build if they ever drift apart.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

import {
  PERMS as BACKEND_PERMS, ROLE_MATRIX as BACKEND_MATRIX, ROLES as BACKEND_ROLES,
  normalizeRole, roleHasPermission, permissionsFor, isPlatformRole, isOrgRole,
} from '../config/permissions.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const crmRolesPath = path.resolve(here, '../../crm/src/lib/roles.js');
const crmRolesUrl = pathToFileURL(crmRolesPath).href;

const crm = await import(crmRolesUrl).catch(() => null);

test('CRM role library is importable and exposes the shared matrix', () => {
  assert.ok(crm, 'crm/src/lib/roles.js must be importable');
  assert.ok(crm.ROLE_MATRIX, 'CRM must export ROLE_MATRIX');
  assert.ok(crm.PERMS, 'CRM must export PERMS');
});

test('permission keys are identical on both sides', () => {
  const backendKeys = Object.keys(BACKEND_PERMS).sort();
  const crmKeys = Object.keys(crm.PERMS).sort();
  assert.deepEqual(backendKeys, crmKeys);
});

test('each permission maps to the same roles on both sides', () => {
  for (const [key, backendPerm] of Object.entries(BACKEND_PERMS)) {
    const backendRoles = BACKEND_MATRIX[backendPerm];
    const crmRoles = crm.ROLE_MATRIX[crm.PERMS[key]];
    assert.deepEqual(
      [...backendRoles].sort(),
      [...crmRoles].sort(),
      `matrix mismatch for ${key} (${backendPerm})`,
    );
  }
});

test('role names match exactly', () => {
  assert.deepEqual(Object.values(BACKEND_ROLES).sort(), Object.values(crm.ROLES).sort());
});

test('CRM matrix + backend middleware agree on the four case-study roles', () => {
  // Owner manages the platform team; Platform Admin + Support Manager read it.
  assert.equal(roleHasPermission('OWNER', BACKEND_PERMS.PLATFORM_USERS_MANAGE), true);
  assert.equal(roleHasPermission('PLATFORM_ADMIN', BACKEND_PERMS.PLATFORM_USERS_MANAGE), false);
  assert.equal(roleHasPermission('SUPPORT_MANAGER', BACKEND_PERMS.PLATFORM_USERS_MANAGE), false);
  assert.equal(roleHasPermission('PLATFORM_ADMIN', BACKEND_PERMS.PLATFORM_TEAM_VIEW), true);
  assert.equal(roleHasPermission('SUPPORT_MANAGER', BACKEND_PERMS.PLATFORM_TEAM_VIEW), true);

  // Issue #6: Organization Admins have Guest Support permissions.
  for (const perm of [BACKEND_PERMS.TICKETS_RESOLVE]) {
    assert.equal(roleHasPermission('ORG_ADMIN', perm), true);
    assert.equal(roleHasPermission(crm.ROLES.ORG_ADMIN, perm), true);
  }

  // Issue #7: Org Admin + Org Manager can edit events and manage devices.
  for (const role of ['ORG_ADMIN', 'ORG_MANAGER']) {
    assert.equal(roleHasPermission(role, BACKEND_PERMS.EVENTS_DEVICES_MANAGE), true);
    assert.equal(roleHasPermission(role, BACKEND_PERMS.EVENT_EDIT), true);
  }

  // Issues #12/#13: Owner + Platform Admin own gallery settings.
  assert.equal(roleHasPermission('OWNER', BACKEND_PERMS.PLATFORM_GALLERY_SETTINGS), true);
  assert.equal(roleHasPermission('PLATFORM_ADMIN', BACKEND_PERMS.PLATFORM_GALLERY_SETTINGS), true);
  assert.equal(roleHasPermission('SUPPORT_MANAGER', BACKEND_PERMS.PLATFORM_GALLERY_SETTINGS), false);
});

test('legacy / cased role values normalise instead of failing (#14)', () => {
  const cases = {
    owner: 'OWNER',
    Owner: 'OWNER',
    SUPER_ADMIN: 'OWNER',
    admin: 'PLATFORM_ADMIN',
    platformadmin: 'PLATFORM_ADMIN',
    'platform-admin': 'PLATFORM_ADMIN',
    'org admin': 'ORG_ADMIN',
    client_admin: 'ORG_ADMIN',
    OrgManager: 'ORG_MANAGER',
  };
  for (const [raw, expected] of Object.entries(cases)) {
    assert.equal(normalizeRole(raw), expected, `${raw} → ${expected}`);
    assert.equal(crm.normalizeRole(raw), expected, `CRM ${raw} → ${expected}`);
  }
  assert.equal(normalizeRole('nonsense'), null);
  assert.equal(roleHasPermission('OrG-Admin', BACKEND_PERMS.COUPONS_MANAGE), true);
  assert.equal(roleHasPermission('nonsense', BACKEND_PERMS.COUPONS_MANAGE), false);
});

test('platform and organization role groups stay disjoint', () => {
  for (const role of ['OWNER', 'PLATFORM_ADMIN', 'SUPPORT_MANAGER']) {
    assert.equal(isPlatformRole(role), true);
    assert.equal(isOrgRole(role), false);
  }
  for (const role of ['ORG_ADMIN', 'ORG_MANAGER']) {
    assert.equal(isOrgRole(role), true);
    assert.equal(isPlatformRole(role), false);
  }
});

test('platform users without a role permission never get one implicitly', () => {
  const supportPerms = permissionsFor('SUPPORT_MANAGER');
  assert.ok(supportPerms.includes(BACKEND_PERMS.PLATFORM_TEAM_VIEW));
  assert.ok(!supportPerms.includes(BACKEND_PERMS.PLATFORM_REVENUE_VIEW));
  assert.ok(!supportPerms.includes(BACKEND_PERMS.PLATFORM_AUDIT_VIEW));
  assert.ok(!supportPerms.includes(BACKEND_PERMS.PLATFORM_ORG_SUSPEND));
});

test('the CRM has no mock API (real backend only)', () => {
  assert.throws(
    () => readFileSync(path.resolve(here, '../../crm/src/api/mock/server.js'), 'utf8'),
    /ENOENT/,
    'the in-browser mock API must stay deleted — the CRM talks to the real backend only',
  );
});

test('backend middleware enforces permissions through the shared matrix', () => {
  const middleware = readFileSync(path.resolve(here, '../middleware/auth.js'), 'utf8');
  assert.match(middleware, /roleHasPermission\(req\.user\.role, perm\)/);
  assert.match(middleware, /normalizeRole/);
});
