'use client';

import { useStudioStore } from '@/stores/studio-store';

/**
 * V3 Shell Wrapper
 * ----------------
 * Wraps non-consumer pages (Extensions, Creator Studio, etc.) with the
 * V3 header so they don't lose the PlayLiquid brand identity.
 *
 * Renders a minimal header (logo + back button) without the full sidebar,
 * since these pages have their own internal navigation.
 */

interface V3ShellWrapperProps {
  title: string;
  children: React.ReactNode;
}

export function V3ShellWrapper({ title, children }: V3ShellWrapperProps) {
  const { setView } = useStudioStore();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* V3 Header (simplified — logo + back) */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border px-4 py-2.5 flex items-center gap-3">
        <button
          onClick={() => setView('home-v3')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center text-white text-[10px] font-bold">
            PL
          </div>
          <span className="text-sm font-bold hidden sm:inline">PlayLiquid</span>
        </button>
        <div className="h-5 w-px bg-border mx-1" />
        <h1 className="text-sm font-medium text-muted-foreground">{title}</h1>
        <div className="ml-auto">
          <button
            onClick={() => setView('home-v3')}
            className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-full hover:bg-muted transition-colors"
          >
            ← Back to Home
          </button>
        </div>
      </header>

      {/* Page content */}
      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}
