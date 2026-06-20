"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import dynamic from "next/dynamic";

const ContactModal = dynamic(() => import("@/components/account/ContactModal"), { ssr: false });

/** "?" button for the page headers — opens a contact form to message the admin.
 *  Always visible (contact is public). */
export default function ContactButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Enviar un mensaje al admin"
        title="Enviar un mensaje al admin"
        className={className ?? "rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"}
      >
        <HelpCircle className="h-5 w-5" />
      </button>
      {open && <ContactModal onClose={() => setOpen(false)} />}
    </>
  );
}
