import { AdminShell } from '@/components/admin/AdminShell';
import { requireAdmin } from '@/lib/auth/guards';
import { getPendingCounts } from '@/server/analytics';

export default async function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const counts = await getPendingCounts();

  return (
    <AdminShell
      user={{
        fullName: session.user.fullName,
        email: session.user.email,
        roleName: session.role.name,
      }}
      permissions={session.permissions}
      pendingRequests={counts.openRequests}
      awaitingShipment={counts.awaitingShipment}
    >
      {children}
    </AdminShell>
  );
}
