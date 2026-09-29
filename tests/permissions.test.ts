/**
 * Authorization is the security backbone of the admin console — every protected
 * action funnels through `hasPermission`. These are pure unit tests: no database,
 * no server. They pin down the role matrix so a well-meaning edit to
 * `SYSTEM_ROLES` cannot silently widen someone's access.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ALL_PERMISSIONS,
  PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  SYSTEM_ROLES,
  hasAnyPermission,
  hasPermission,
  type PermissionKey,
} from '../src/lib/permissions';

function role(name: string) {
  const found = SYSTEM_ROLES.find((entry) => entry.name === name);
  assert.ok(found, `expected a system role called "${name}"`);
  return found;
}

describe('hasPermission', () => {
  it('grants only an exact key match', () => {
    const granted = [PERMISSIONS.ORDERS_VIEW, PERMISSIONS.PRODUCTS_VIEW];
    assert.equal(hasPermission(granted, PERMISSIONS.ORDERS_VIEW), true);
    assert.equal(hasPermission(granted, PERMISSIONS.ORDERS_MANAGE), false);
  });

  it('does not treat a "view" grant as a "manage" grant', () => {
    // The pairing matters: read access must never imply write access.
    const pairs: [PermissionKey, PermissionKey][] = [
      [PERMISSIONS.PRODUCTS_VIEW, PERMISSIONS.PRODUCTS_MANAGE],
      [PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_MANAGE],
      [PERMISSIONS.CUSTOMERS_VIEW, PERMISSIONS.CUSTOMERS_MANAGE],
      [PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_MANAGE],
      [PERMISSIONS.MARKETING_VIEW, PERMISSIONS.MARKETING_MANAGE],
      [PERMISSIONS.SHIPPING_VIEW, PERMISSIONS.SHIPPING_MANAGE],
      [PERMISSIONS.REQUESTS_VIEW, PERMISSIONS.REQUESTS_MANAGE],
      [PERMISSIONS.ROLES_VIEW, PERMISSIONS.ROLES_MANAGE],
      [PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_MANAGE],
    ];
    for (const [view, manage] of pairs) {
      assert.equal(hasPermission([view], manage), false, `${view} must not imply ${manage}`);
    }
  });

  it('refuses everything for an empty grant list', () => {
    for (const key of ALL_PERMISSIONS) {
      assert.equal(hasPermission([], key), false, `empty grants must refuse ${key}`);
    }
  });

  it('ignores unknown or look-alike keys', () => {
    assert.equal(hasPermission(['products.manage '], PERMISSIONS.PRODUCTS_MANAGE), false);
    assert.equal(hasPermission(['PRODUCTS.MANAGE'], PERMISSIONS.PRODUCTS_MANAGE), false);
    assert.equal(hasPermission(['products'], PERMISSIONS.PRODUCTS_MANAGE), false);
    assert.equal(hasPermission(['*'], PERMISSIONS.PRODUCTS_MANAGE), false, 'no wildcard escape hatch');
  });
});

describe('hasAnyPermission', () => {
  it('passes when at least one key is held', () => {
    assert.equal(
      hasAnyPermission([PERMISSIONS.REPORTS_VIEW], [PERMISSIONS.REPORTS_EXPORT, PERMISSIONS.REPORTS_VIEW]),
      true,
    );
  });

  it('fails when none are held, and for an empty requirement list', () => {
    assert.equal(hasAnyPermission([PERMISSIONS.ORDERS_VIEW], [PERMISSIONS.ROLES_MANAGE]), false);
    assert.equal(hasAnyPermission([PERMISSIONS.ORDERS_VIEW], []), false, 'requiring nothing grants nothing');
  });
});

describe('system roles', () => {
  it('gives Super Admin every permission', () => {
    const permissions = role('Super Admin').permissions;
    assert.deepEqual([...permissions].sort(), [...ALL_PERMISSIONS].sort());
  });

  it('withholds role and settings management from every non-super role', () => {
    // Privilege escalation guard: only Super Admin may rewrite roles or
    // security settings, otherwise a lesser admin could grant themselves more.
    const escalation: PermissionKey[] = [
      PERMISSIONS.ROLES_MANAGE,
      PERMISSIONS.SETTINGS_MANAGE,
      PERMISSIONS.ROLES_VIEW,
    ];
    for (const entry of SYSTEM_ROLES) {
      if (entry.name === 'Super Admin') continue;
      for (const key of escalation) {
        assert.equal(
          entry.permissions.includes(key),
          false,
          `role "${entry.name}" must not hold ${key}`,
        );
      }
    }
  });

  it('keeps Customer Support out of the catalogue and money settings', () => {
    const support = role('Customer Support').permissions;
    assert.equal(support.includes(PERMISSIONS.PRODUCTS_VIEW), true, 'support needs to look products up');
    assert.equal(support.includes(PERMISSIONS.PRODUCTS_MANAGE), false);
    assert.equal(support.includes(PERMISSIONS.INVENTORY_MANAGE), false);
    assert.equal(support.includes(PERMISSIONS.MARKETING_MANAGE), false);
  });

  it('keeps Marketing out of orders and customer records', () => {
    const marketing = role('Marketing').permissions;
    assert.equal(marketing.includes(PERMISSIONS.MARKETING_MANAGE), true);
    assert.equal(marketing.includes(PERMISSIONS.ORDERS_VIEW), false);
    assert.equal(marketing.includes(PERMISSIONS.ORDERS_MANAGE), false);
    assert.equal(marketing.includes(PERMISSIONS.CUSTOMERS_VIEW), false);
  });

  it('keeps Manager out of order mutation and customer records', () => {
    const manager = role('Manager').permissions;
    assert.equal(manager.includes(PERMISSIONS.ORDERS_VIEW), true);
    assert.equal(manager.includes(PERMISSIONS.ORDERS_MANAGE), false);
    assert.equal(manager.includes(PERMISSIONS.CUSTOMERS_MANAGE), false);
  });

  it('grants no key outside the known set, and never duplicates one', () => {
    for (const entry of SYSTEM_ROLES) {
      const unknown = entry.permissions.filter((key) => !ALL_PERMISSIONS.includes(key));
      assert.deepEqual(unknown, [], `role "${entry.name}" holds unknown key(s)`);
      assert.equal(
        new Set(entry.permissions).size,
        entry.permissions.length,
        `role "${entry.name}" lists a permission twice`,
      );
    }
  });

  it('gives every role the dashboard, so no role signs in to a dead console', () => {
    for (const entry of SYSTEM_ROLES) {
      assert.equal(
        entry.permissions.includes(PERMISSIONS.DASHBOARD_VIEW),
        true,
        `role "${entry.name}" cannot see the dashboard`,
      );
    }
  });
});

describe('permission metadata', () => {
  it('labels every permission', () => {
    for (const key of ALL_PERMISSIONS) {
      assert.ok(PERMISSION_LABELS[key], `${key} has no label`);
    }
  });

  it('exposes every permission in exactly one UI group', () => {
    // A key missing from the groups is invisible in the role editor, which means
    // it can never be granted or revoked through the console.
    const grouped = PERMISSION_GROUPS.flatMap((group) => group.keys);
    assert.deepEqual([...grouped].sort(), [...ALL_PERMISSIONS].sort());
    assert.equal(new Set(grouped).size, grouped.length, 'a key appears in two groups');
  });

  it('has no duplicate permission strings in PERMISSIONS', () => {
    assert.equal(new Set(ALL_PERMISSIONS).size, ALL_PERMISSIONS.length);
  });
});
