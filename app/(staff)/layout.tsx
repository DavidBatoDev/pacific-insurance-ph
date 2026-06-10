import type { ReactNode } from "react";

/** Layout for staff-facing routes — header + main content area. */
export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b px-6 py-4">
        <span className="font-semibold">Pacific Insurance PH</span>
        <span className="text-muted-foreground ml-2 text-sm">Staff</span>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
