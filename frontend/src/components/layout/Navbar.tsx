"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn, isAdmin, getUserId } from "@/lib/utils";
import { useSettings } from "@/lib/api";

interface Tab {
  href: string;
  label: string;
  icon: string;
  adminOnly?: boolean;
  futgolfOnly?: boolean;
}

const TABS: Tab[] = [
  { href: "/news", label: "News", icon: "📰" },
  { href: "/fixture", label: "Fixture", icon: "📅" },
  { href: "/prode", label: "Prode", icon: "🏆" },
  { href: "/grupos", label: "Grupos", icon: "👥" },
  { href: "/teams", label: "WC", icon: "📊" },
  { href: "/futgolf", label: "FutGolf", icon: "⛳", futgolfOnly: true },
  { href: "/admin", label: "Admin", icon: "⚙️", adminOnly: true },
];

export default function Navbar() {
  const pathname = usePathname();
  const [admin, setAdmin] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { data: settings } = useSettings();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Read admin status after mount (localStorage is client-only); re-check on
  // navigation so it updates right after login/logout.
  useEffect(() => {
    setAdmin(isAdmin());
  }, [pathname]);

  const myId = Number(getUserId()) || 0;
  const futgolfOk = !!settings?.futgolf_enabled && (settings?.futgolf_all || admin || (settings?.futgolf_allowed ?? []).includes(myId));
  const tabs = TABS.filter((t) => (!t.adminOnly || admin) && (!t.futgolfOnly || futgolfOk));

  const nav = (
    // Portaled to <body> so it stays pinned to the viewport even on iOS Chrome,
    // where an ancestor's transform/filter would otherwise detach `fixed`.
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto flex max-w-lg">
        {tabs.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                active ? "text-blue-600" : "text-gray-500 hover:text-gray-700",
              )}
            >
              <span className="text-lg leading-none">{icon}</span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );

  if (!mounted) return null;
  return createPortal(nav, document.body);
}
