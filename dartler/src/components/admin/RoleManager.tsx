'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Textarea } from '@/components/ui/Field';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import {
  deleteRoleAction,
  saveRoleAction,
  assignAdminRoleAction,
} from '@/server/actions/admin-settings';
import type { ActionState } from '@/server/actions/admin-products';
import { PERMISSION_GROUPS, PERMISSION_LABELS, type PermissionKey } from '@/lib/permissions';

const initial: ActionState = { ok: false };

export interface RoleView {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  users: { id: string; fullName: string; email: string }[];
}

export function RoleManager({
  roles,
  adminUsers,
  canManage,
}: {
  roles: RoleView[];
  adminUsers: { id: string; fullName: string; email: string; roleId: string; roleName: string }[];
  canManage: boolean;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState<RoleView | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<RoleView | null>(null);
  const [state, formAction, pending] = useActionState(saveRoleAction, initial);
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    if (state.ok) {
      toast({ title: 'Role saved', description: state.message, tone: 'success' });
      setEditing(null);
    } else if (state.error) {
      toast({ title: 'Could not save role', description: state.error, tone: 'error' });
    }
  }, [state, toast]);

  const draft = editing === 'new' ? null : editing;

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-taupe-100 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-taupe-100 px-5 py-3.5">
          <div>
            <h2 className="font-serif text-base text-charcoal-700">Role management</h2>
            <p className="text-xs text-charcoal-400">
              Permissions are enforced on the server for every action, not just hidden in the menu.
            </p>
          </div>
          {canManage ? (
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus className="h-3.5 w-3.5" />
              Add Role
            </Button>
          ) : null}
        </header>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-taupe-100 bg-ivory-50 text-[11px] uppercase tracking-wide text-charcoal-400">
                <th scope="col" className="px-5 py-2.5 text-left font-semibold">Role name</th>
                <th scope="col" className="px-5 py-2.5 text-right font-semibold">Users</th>
                <th scope="col" className="px-5 py-2.5 text-left font-semibold">Permissions</th>
                {canManage ? (
                  <th scope="col" className="px-5 py-2.5 text-right font-semibold">Actions</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.id} className="border-b border-taupe-50 last:border-0 align-top">
                  <td className="px-5 py-3">
                    <p className="flex items-center gap-2 font-medium text-charcoal-700">
                      {role.name}
                      {role.isSystem ? <Badge tone="neutral">Built-in</Badge> : null}
                    </p>
                    {role.description ? (
                      <p className="text-xs text-charcoal-400">{role.description}</p>
                    ) : null}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-charcoal-700">
                    {role.users.length}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1">
                      {role.permissions.length === 23 ? (
                        <Badge tone="wine">All permissions</Badge>
                      ) : (
                        role.permissions.slice(0, 5).map((key) => (
                          <span
                            key={key}
                            className="rounded-full bg-taupe-50 px-2 py-0.5 text-[10px] text-charcoal-500"
                          >
                            {PERMISSION_LABELS[key as PermissionKey] ?? key}
                          </span>
                        ))
                      )}
                      {role.permissions.length > 5 && role.permissions.length !== 23 ? (
                        <span className="text-[10px] text-charcoal-300">
                          +{role.permissions.length - 5} more
                        </span>
                      ) : null}
                    </div>
                  </td>
                  {canManage ? (
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditing(role)}
                          aria-label={`Edit ${role.name}`}
                          className="rounded-lg p-2 text-charcoal-400 hover:bg-ivory-50 hover:text-wine-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {!role.isSystem ? (
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(role)}
                            aria-label={`Delete ${role.name}`}
                            className="rounded-lg p-2 text-charcoal-400 hover:bg-danger-50 hover:text-danger-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-taupe-100 bg-white">
        <header className="border-b border-taupe-100 px-5 py-3.5">
          <h2 className="font-serif text-base text-charcoal-700">Admin users</h2>
          <p className="text-xs text-charcoal-400">Admin accounts are separate from customer accounts.</p>
        </header>
        <ul className="divide-y divide-taupe-50">
          {adminUsers.map((user) => (
            <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="text-sm font-medium text-charcoal-700">{user.fullName}</p>
                <p className="text-xs text-charcoal-400">{user.email}</p>
              </div>
              {canManage ? (
                <select
                  value={user.roleId}
                  aria-label={`Role for ${user.fullName}`}
                  disabled={busy}
                  onChange={(event) => {
                    const roleId = event.target.value;
                    startTransition(async () => {
                      const result = await assignAdminRoleAction(user.id, roleId);
                      toast({
                        title: result.ok ? 'Role updated' : 'Could not change role',
                        description: result.message ?? result.error,
                        tone: result.ok ? 'success' : 'error',
                      });
                    });
                  }}
                  className="h-9 rounded-xl border border-taupe-200 bg-white px-3 pr-8 text-[13px]"
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              ) : (
                <Badge tone="neutral">{user.roleName}</Badge>
              )}
            </li>
          ))}
        </ul>
      </div>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={draft ? `Edit “${draft.name}”` : 'Add a role'}
        size="lg"
      >
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="roleId" value={draft?.id ?? ''} />

          <Input label="Role name" name="name" defaultValue={draft?.name ?? ''} required maxLength={50} />
          <Textarea
            label="Description"
            name="description"
            defaultValue={draft?.description ?? ''}
            maxLength={160}
            className="min-h-[64px]"
          />

          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-charcoal-600">Permissions</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {PERMISSION_GROUPS.map((group) => (
                <div key={group.label} className="rounded-xl border border-taupe-100 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-charcoal-400">
                    {group.label}
                  </p>
                  <ul className="space-y-1.5">
                    {group.keys.map((key) => (
                      <li key={key}>
                        <label className="flex items-start gap-2 text-[13px] text-charcoal-600">
                          <input
                            type="checkbox"
                            name="permissions"
                            value={key}
                            defaultChecked={draft ? draft.permissions.includes(key) : false}
                            className="mt-0.5 h-4 w-4 accent-wine-600"
                          />
                          {PERMISSION_LABELS[key]}
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </fieldset>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              Save role
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        destructive
        title="Delete this role?"
        message={`“${confirmDelete?.name ?? ''}” will be removed. Roles with users assigned cannot be deleted.`}
        confirmLabel="Delete role"
        onConfirm={() => {
          const role = confirmDelete;
          if (!role) return;
          startTransition(async () => {
            const result = await deleteRoleAction(role.id);
            setConfirmDelete(null);
            toast({
              title: result.ok ? 'Role deleted' : 'Could not delete role',
              description: result.message ?? result.error,
              tone: result.ok ? 'success' : 'error',
            });
          });
        }}
      />
    </>
  );
}
