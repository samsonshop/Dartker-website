/**
 * Permission keys are the single source of truth for admin authorization.
 * Every protected admin API and server action checks one of these keys —
 * hiding a sidebar link is never treated as access control.
 */
export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  PRODUCTS_VIEW: 'products.view',
  PRODUCTS_MANAGE: 'products.manage',
  ORDERS_VIEW: 'orders.view',
  ORDERS_MANAGE: 'orders.manage',
  CUSTOMERS_VIEW: 'customers.view',
  CUSTOMERS_MANAGE: 'customers.manage',
  INVENTORY_VIEW: 'inventory.view',
  INVENTORY_MANAGE: 'inventory.manage',
  MARKETING_VIEW: 'marketing.view',
  MARKETING_MANAGE: 'marketing.manage',
  ANALYTICS_VIEW: 'analytics.view',
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',
  SHIPPING_VIEW: 'shipping.view',
  SHIPPING_MANAGE: 'shipping.manage',
  REQUESTS_VIEW: 'requests.view',
  REQUESTS_MANAGE: 'requests.manage',
  ROLES_VIEW: 'roles.view',
  ROLES_MANAGE: 'roles.manage',
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_MANAGE: 'settings.manage',
  AUDIT_VIEW: 'audit.view',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(PERMISSIONS);

export const PERMISSION_GROUPS: { label: string; keys: PermissionKey[] }[] = [
  { label: 'Dashboard', keys: [PERMISSIONS.DASHBOARD_VIEW] },
  { label: 'Products', keys: [PERMISSIONS.PRODUCTS_VIEW, PERMISSIONS.PRODUCTS_MANAGE] },
  { label: 'Orders', keys: [PERMISSIONS.ORDERS_VIEW, PERMISSIONS.ORDERS_MANAGE] },
  { label: 'Customers', keys: [PERMISSIONS.CUSTOMERS_VIEW, PERMISSIONS.CUSTOMERS_MANAGE] },
  { label: 'Inventory', keys: [PERMISSIONS.INVENTORY_VIEW, PERMISSIONS.INVENTORY_MANAGE] },
  { label: 'Marketing', keys: [PERMISSIONS.MARKETING_VIEW, PERMISSIONS.MARKETING_MANAGE] },
  {
    label: 'Analytics & reports',
    keys: [PERMISSIONS.ANALYTICS_VIEW, PERMISSIONS.REPORTS_VIEW, PERMISSIONS.REPORTS_EXPORT],
  },
  { label: 'Shipping', keys: [PERMISSIONS.SHIPPING_VIEW, PERMISSIONS.SHIPPING_MANAGE] },
  {
    label: 'Returns & cancellations',
    keys: [PERMISSIONS.REQUESTS_VIEW, PERMISSIONS.REQUESTS_MANAGE],
  },
  { label: 'Roles', keys: [PERMISSIONS.ROLES_VIEW, PERMISSIONS.ROLES_MANAGE] },
  {
    label: 'Settings & security',
    keys: [PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_MANAGE, PERMISSIONS.AUDIT_VIEW],
  },
];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  [PERMISSIONS.DASHBOARD_VIEW]: 'View dashboard',
  [PERMISSIONS.PRODUCTS_VIEW]: 'View products',
  [PERMISSIONS.PRODUCTS_MANAGE]: 'Create, edit & archive products',
  [PERMISSIONS.ORDERS_VIEW]: 'View orders',
  [PERMISSIONS.ORDERS_MANAGE]: 'Update order status & notes',
  [PERMISSIONS.CUSTOMERS_VIEW]: 'View customers',
  [PERMISSIONS.CUSTOMERS_MANAGE]: 'Edit customer accounts',
  [PERMISSIONS.INVENTORY_VIEW]: 'View inventory',
  [PERMISSIONS.INVENTORY_MANAGE]: 'Adjust stock levels',
  [PERMISSIONS.MARKETING_VIEW]: 'View coupons & campaigns',
  [PERMISSIONS.MARKETING_MANAGE]: 'Create & edit coupons',
  [PERMISSIONS.ANALYTICS_VIEW]: 'View analytics',
  [PERMISSIONS.REPORTS_VIEW]: 'View reports',
  [PERMISSIONS.REPORTS_EXPORT]: 'Export reports',
  [PERMISSIONS.SHIPPING_VIEW]: 'View shipments',
  [PERMISSIONS.SHIPPING_MANAGE]: 'Create shipments & sync tracking',
  [PERMISSIONS.REQUESTS_VIEW]: 'View return & cancellation requests',
  [PERMISSIONS.REQUESTS_MANAGE]: 'Approve or reject requests',
  [PERMISSIONS.ROLES_VIEW]: 'View roles',
  [PERMISSIONS.ROLES_MANAGE]: 'Create & edit roles',
  [PERMISSIONS.SETTINGS_VIEW]: 'View settings',
  [PERMISSIONS.SETTINGS_MANAGE]: 'Change store settings & security',
  [PERMISSIONS.AUDIT_VIEW]: 'View activity & audit logs',
};

export const SYSTEM_ROLES: {
  name: string;
  description: string;
  permissions: PermissionKey[];
}[] = [
  {
    name: 'Super Admin',
    description: 'Unrestricted access to every module and setting.',
    permissions: ALL_PERMISSIONS,
  },
  {
    name: 'Admin',
    description: 'Day-to-day store operations: products, orders and customers.',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCTS_VIEW,
      PERMISSIONS.PRODUCTS_MANAGE,
      PERMISSIONS.ORDERS_VIEW,
      PERMISSIONS.ORDERS_MANAGE,
      PERMISSIONS.CUSTOMERS_VIEW,
      PERMISSIONS.CUSTOMERS_MANAGE,
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.INVENTORY_MANAGE,
      PERMISSIONS.SHIPPING_VIEW,
      PERMISSIONS.SHIPPING_MANAGE,
      PERMISSIONS.REQUESTS_VIEW,
      PERMISSIONS.REQUESTS_MANAGE,
      PERMISSIONS.ANALYTICS_VIEW,
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.REPORTS_EXPORT,
      PERMISSIONS.MARKETING_VIEW,
    ],
  },
  {
    name: 'Manager',
    description: 'Catalogue and stock ownership with reporting access.',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCTS_VIEW,
      PERMISSIONS.PRODUCTS_MANAGE,
      PERMISSIONS.INVENTORY_VIEW,
      PERMISSIONS.INVENTORY_MANAGE,
      PERMISSIONS.ORDERS_VIEW,
      PERMISSIONS.ANALYTICS_VIEW,
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.REPORTS_EXPORT,
    ],
  },
  {
    name: 'Customer Support',
    description: 'Handles orders, tracking and post-purchase requests.',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.ORDERS_VIEW,
      PERMISSIONS.ORDERS_MANAGE,
      PERMISSIONS.CUSTOMERS_VIEW,
      PERMISSIONS.SHIPPING_VIEW,
      PERMISSIONS.REQUESTS_VIEW,
      PERMISSIONS.REQUESTS_MANAGE,
      PERMISSIONS.PRODUCTS_VIEW,
    ],
  },
  {
    name: 'Marketing',
    description: 'Coupons, campaigns and performance reporting.',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PRODUCTS_VIEW,
      PERMISSIONS.MARKETING_VIEW,
      PERMISSIONS.MARKETING_MANAGE,
      PERMISSIONS.ANALYTICS_VIEW,
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.REPORTS_EXPORT,
    ],
  },
];

export function hasPermission(granted: string[], required: PermissionKey): boolean {
  return granted.includes(required);
}

export function hasAnyPermission(granted: string[], required: PermissionKey[]): boolean {
  return required.some((key) => granted.includes(key));
}
