import { ReactNode } from "react";

interface AppShellProps {
  leftRail: ReactNode;
  threadList: ReactNode;
  main: ReactNode;
}

export function AppShell({ leftRail, threadList, main }: AppShellProps) {
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-16 border-r border-border bg-surface/80 md:block">{leftRail}</aside>
      <aside className="hidden w-[320px] border-r border-border bg-surface lg:block">{threadList}</aside>
      <main className="flex min-h-screen flex-1">{main}</main>
    </div>
  );
}
