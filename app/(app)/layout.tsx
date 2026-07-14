import { requireProfile } from '@/lib/auth';
import { Nav } from '@/components/nav';
import { UserMenu } from '@/components/user-menu';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 flex-col border-r border-border bg-card p-4 sm:flex">
        <p className="mb-6 px-3 text-sm font-semibold leading-tight">
          Conciliação
          <br />
          Cartão Corporativo
        </p>
        <Nav role={profile.role} />
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-end border-b border-border bg-card px-4 sm:px-6">
          <UserMenu fullName={profile.fullName} role={profile.role} />
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
