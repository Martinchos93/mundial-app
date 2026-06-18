"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import dynamic from "next/dynamic";
import { getToken } from "@/lib/utils";

const ChangePasswordModal = dynamic(() => import("@/components/account/ChangePasswordModal"), { ssr: false });

/** Account/password access for the page headers — opens "change password".
 *  Shown only when logged in. */
export default function AccountButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  if (!getToken()) return null;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Cambiar contraseña"
        title="Cambiar contraseña"
        className={className ?? "rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"}
      >
        <KeyRound className="h-5 w-5" />
      </button>
      {open && <ChangePasswordModal onClose={() => setOpen(false)} />}
    </>
  );
}
