import { PageHeader } from '@/components/admin/PageHeader';
import { RoleManager } from '@/components/admin/RoleManager';
import { requireAdmin } from '@/lib/auth/guards';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
import { listAdminUsers, listRolesWithCounts } from '@/server/actions/admin-settings';

export const dynamic = 'force-dynamic';

export default async function AdminRolesPage() {
  const session = await requireAdmin(PERMISSIONS.ROLES_VIEW);
  const [roles, users] = await Promise.all([listRolesWithCounts(), listAdminUsers()]);

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        description="Who can do what inside the console."
      />
      <RoleManager
        canManage={hasPermission(session.permissions, PERMISSIONS.ROLES_MANAGE)}
        roles={roles.map((role) => ({
          id: role.id,
          name: role.name,
          description: role.description,
          isSystem: role.isSystem,
          permissions: role.permissions.map((permission) => permission.key),
          users: role.users,
        }))}
        adminUsers={users.map((user) => ({
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          roleId: user.roleId,
          roleName: user.role.name,
        }))}
      />
    </>
  );
}
