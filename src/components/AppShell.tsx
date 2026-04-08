import type { ReactNode } from "react";

interface AppShellProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  footer?: ReactNode;
}

export default function AppShell({ title, subtitle, left, right, footer }: AppShellProps) {
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col bg-white/20 backdrop-blur-md overflow-hidden">
        <header className="w-full px-8 py-6 shrink-0 border-b border-slate-200/60">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Console</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                {title || "MTGA"}
              </h1>
              <div className="mt-2 text-sm text-slate-500">
                {subtitle || "一站式 AI 代理服务器管理面板"}
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 flex min-h-0">
          <section className="flex-[7] flex flex-col min-w-0">{left}</section>
          <div className="w-px bg-slate-200/60 self-stretch shrink-0" />
          <section className="flex-[5] flex flex-col min-w-0">{right}</section>
        </main>

        <footer className="p-5 shrink-0 border-t border-slate-200/60">{footer}</footer>
      </div>
    </div>
  );
}
