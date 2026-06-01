"use client";

import { SWRConfig } from "swr";
import type { ReactNode } from "react";

export default function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ revalidateOnFocus: false, dedupingInterval: 10000 }}>
      {children}
    </SWRConfig>
  );
}
