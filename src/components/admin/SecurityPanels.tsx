'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { KeyRound, LogOut, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Switch } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import {
  changeAdminPasswordAction,
  revokeSessionAction,
  toggleTwoFactorAction,
} from '@/server/actions/admin-settings';
import { adminLogoutEverywhereAction } from '@/server/actions/admin-auth';
import type { ActionState } from '@/server/actions/admin-products';
import { formatDateTime } from '@/lib/utils';

const initial: ActionState = { ok: false };

export function PasswordChangeForm() {
  const { toast } = useToast();
  const [state, formAction, pending] = useActionState(changeAdminPasswordAction, initial);

  useEffect(() => {
    if (state.ok) toast({ title: 'Password updated', description: state.message, tone: 'success' });
    else if (state.error) toast({ title: 'Could not update password', description: state.error, tone: 'error' });
  }, [state, toast]);

  return (
    <form action={formAction} className="space-y-3">
      <Input label="Current password" name="current" type="password" autoComplete="current-password" required />
      <Input
        label="New password"
        name="next"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 10 characters, with letters and numbers."
      />
      <Input label="Confirm new password" name="confirm" type="password" autoComplete="new-password" required />
      <Button type="submit" loading={pending} fullWidth>
        <KeyRound className="h-4 w-4" />
        Update password
      </Button>
      <p className="text-xs text-charcoal-400">
        Changing your password signs you out everywhere else automatically.
      </p>
    </form>
  );
}

export function TwoFactorPanel({ enabled }: { enabled: boolean }) {
  const { toast } = useToast();
  const [on, setOn] = useState(enabled);
  const [codes, setCodes] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <Switch
        checked={on}
        onChange={(next) => {
          setOn(next);
          startTransition(async () => {
            const result = await toggleTwoFactorAction(next);
            if (!result.ok) {
              setOn(!next);
              toast({ title: 'Could not change 2FA', description: result.error, tone: 'error' });
              return;
            }
            toast({ title: 'Two-factor updated', description: result.message, tone: 'success' });
            if (result.backupCodes?.length) setCodes(result.backupCodes);
          });
        }}
        disabled={pending}
        label="Two-Factor Authentication"
        description="Adds a second step to your admin sign-in."
      />

      <Modal
        open={codes.length > 0}
        onClose={() => setCodes([])}
        title="Save your backup codes"
        description="Each code works once. Store them somewhere safe — they are shown only now."
      >
        <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
          {codes.map((code) => (
            <li key={code} className="rounded-lg bg-ivory-50 px-3 py-2 text-charcoal-700">
              {code}
            </li>
          ))}
        </ul>
        <Button
          className="mt-4"
          fullWidth
          onClick={() => {
            void navigator.clipboard?.writeText(codes.join('\n'));
            toast({ title: 'Backup codes copied', tone: 'success' });
          }}
        >
          Copy all codes
        </Button>
      </Modal>
    </>
  );
}

export function SessionList({
  sessions,
  currentSessionId,
}: {
  sessions: { id: string; ip: string | null; userAgent: string | null; lastSeenAt: Date; createdAt: Date }[];
  currentSessionId: string;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {sessions.map((session) => (
          <li
            key={session.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-taupe-100 px-3.5 py-2.5 text-[13px]"
          >
            <div className="min-w-0">
              <p className="truncate text-charcoal-700">
                {session.userAgent?.slice(0, 60) ?? 'Unknown device'}
                {session.id === currentSessionId ? (
                  <span className="ml-2 rounded-full bg-success-50 px-2 py-0.5 text-[10px] text-success-600">
                    This device
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-charcoal-400">
                {session.ip ?? 'unknown ip'} · last seen {formatDateTime(session.lastSeenAt)}
              </p>
            </div>
            {session.id !== currentSessionId ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await revokeSessionAction(session.id);
                    toast({
                      title: result.ok ? 'Session ended' : 'Could not end session',
                      description: result.message ?? result.error,
                      tone: result.ok ? 'success' : 'error',
                    });
                  })
                }
                className="text-xs font-medium text-danger-600 hover:underline disabled:opacity-50"
              >
                Sign out
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <form action={adminLogoutEverywhereAction}>
        <Button type="submit" variant="outline" fullWidth>
          <LogOut className="h-4 w-4" />
          Log out all devices
        </Button>
      </form>
    </div>
  );
}

export function SecurityChecklist({ items }: { items: { label: string; ok: boolean }[] }) {
  return (
    <ul className="space-y-2 text-[13px]">
      {items.map((item) => (
        <li key={item.label} className="flex items-start gap-2">
          <ShieldCheck
            className={`mt-0.5 h-4 w-4 shrink-0 ${item.ok ? 'text-success-500' : 'text-warning-500'}`}
          />
          <span className={item.ok ? 'text-charcoal-600' : 'text-warning-600'}>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
