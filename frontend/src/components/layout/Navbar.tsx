"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Trophy, Users, BarChart2, Settings, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
}

const TABS: Tab[] = [
  { href: "/fixture", label: "Fixture", icon: Calendar },
  { href: "/prode", label: "Prode", icon: Trophy },
  { href: "/grupos", label: "Grupos", icon: Users },
  { href: "/teams", label: "WC", icon: BarChart2 },
  { href: "/admin", label: "Admin", icon: Settings },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white">
      <div className="mx-auto grid max-w-lg grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
                active ? "text-blue-600" : "text-gray-400 hover:text-gray-600",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
