import { redirect } from 'next/navigation';
import { PageHeader, Panel } from '@/components/admin/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { StoreSettingsForm } from '@/components/admin/StoreSettingsForm';
import {
  PasswordChangeForm,
  SecurityChecklist,
  SessionList,
  TwoFactorPanel,
} from '@/components/admin/SecurityPanels';
import { requireAdmin } from '@/lib/auth/guards';
import { PERMISSIONS, hasPermission } from '@/lib/permissions';
import { getAdminSecurityContext } from '@/server/actions/admin-settings';
import { getStoreSettings } from '@/server/settings';
import { isDelhiveryConfigured, isRazorpayConfigured } from '@/lib/env';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const session = await requireAdmin(PERMISSIONS.SETTINGS_VIEW);
  const [settings, context] = await Promise.all([getStoreSettings(), getAdminSecurityContext()]);
  if (!context) redirect('/admin/login');

  const canManage = hasPermission(session.permissions, PERMISSIONS.SETTINGS_MANAGE);
  const canSeeAudit = hasPermission(session.permissions, PERMISSIONS.AUDIT_VIEW);

  const checklist = [
    { label: 'Admin and customer sessions are separate', ok: true },
    { label: 'Session cookies are httpOnly and signed', ok: true },
    { label: 'Payments are verified server-side before an order is marked paid', ok: true },
    {
      label: isRazorpayConfigured()
        ? 'Razorpay credentials are configured'
        : 'Razorpay credentials are not set — online payment is disabled',
      ok: isRazorpayConfigured(),
    },
    {
      label: isDelhiveryConfigured()
        ? 'Delhivery credentials are configured'
        : 'Delhivery is running on the built-in mock courier',
      ok: isDelhiveryConfigured(),
    },
    {
      label: session.user.twoFactorEnabled
        ? 'Two-factor authentication is on for your account'
        : 'Two-factor authentication is off for your account',
      ok: session.user.twoFactorEnabled,
    },
  ];

  return (
    <>
      <PageHeader
        title="Settings & Security"
        description="Store configuration, your account security and the activity log."
      />

      <div className="grid items-start gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Panel title="Store settings" description="These values drive shipping, tax and returns everywhere.">
            <StoreSettingsForm settings={settings} canManage={canManage} />
          </Panel>

          {canSeeAudit ? (
            <Panel title="Activity log" description="The 25 most recent admin actions">
              <ul className="space-y-3">
                {context.activity.map((entry) => (
                  <li key={entry.id} className="flex gap-3 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-taupe-300" />
                    <div className="min-w-0">
                      <p className="text-charcoal-700">{entry.summary ?? entry.action}</p>
                      <p className="text-xs text-charcoal-300">
                        {formatDateTime(entry.createdAt)} · {entry.actorName ?? 'System'} ·{' '}
                        {entry.action}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-5">
          <Panel title="Two-factor authentication">
            <TwoFactorPanel enabled={session.user.twoFactorEnabled} />
          </Panel>

          <Panel title="Change password">
            <PasswordChangeForm />
          </Panel>

          <Panel title="Active sessions" description="Devices currently signed in as you">
            <SessionList
              currentSessionId={context.session.sessionId}
              sessions={context.sessions.map((row) => ({
                id: row.id,
                ip: row.ip,
                userAgent: row.userAgent,
                lastSeenAt: row.lastSeenAt,
                createdAt: row.createdAt,
              }))}
            />
          </Panel>

          <Panel title="Login history">
            <ul className="space-y-2 text-[13px]">
              {context.logins.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-2">
                  <span className="text-charcoal-500">{formatDateTime(entry.createdAt)}</span>
                  <Badge tone={entry.success ? 'success' : 'danger'}>
                    {entry.success ? 'Success' : 'Failed'}
                  </Badge>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Security checklist">
            <SecurityChecklist items={checklist} />
          </Panel>
        </div>
      </div>
    </>
  );
}
