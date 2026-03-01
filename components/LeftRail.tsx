"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, FolderOpen, Home, Layers, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/", icon: Layers, label: "Threads" },
  { href: "/runs/demo", icon: Activity, label: "Runs" },
  { href: "/", icon: FolderOpen, label: "Vault" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function LeftRail() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen flex-col items-center justify-between py-4">
      <div className="space-y-5">
        <button className="size-10 rounded-full bg-accent/10 text-sm font-semibold text-accent">sf</button>
        <nav className="flex flex-col gap-2">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                title={item.label}
                className={cn(
                  "relative rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900",
                  active && "bg-slate-100 text-slate-900",
                )}
              >
                {active && <span className="absolute -left-2 top-2 h-5 w-0.5 rounded-full bg-slate-900" />}
                <Icon className="size-5" />
              </Link>
            );
          })}
        </nav>
      </div>
      <button className="size-9 rounded-full bg-slate-200 text-xs font-medium">JS</button>
    </div>
  );
}
