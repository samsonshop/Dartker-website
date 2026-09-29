'use client';

import { LogOut } from 'lucide-react';
import { logoutAction } from '@/server/actions/auth';

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] text-charcoal-500 transition-colors hover:bg-danger-50 hover:text-danger-600"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </form>
  );
}
