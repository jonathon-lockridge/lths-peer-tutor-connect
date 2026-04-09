import { Sidebar } from "./Sidebar";
import { BottomBar } from "./BottomBar";

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:shrink-0">
        <Sidebar />
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="mx-auto max-w-4xl px-4 py-6">{children}</div>
      </main>

      {/* Mobile bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden">
        <BottomBar />
      </div>
    </div>
  );
}
