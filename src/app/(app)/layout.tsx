import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { BackgroundSync } from "@/components/background-sync";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background mesh-gradient-bg">
      {/* Desktop sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Mobile nav */}
      <MobileNav />

      {/* Silent background sync — runs on every page load */}
      <BackgroundSync />

      {/* Main content */}
      <main className="relative z-10 md:ml-64">
        <div className="mx-auto max-w-7xl p-6">{children}</div>
      </main>
    </div>
  );
}
