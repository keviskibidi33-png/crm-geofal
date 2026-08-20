"use client";

import React from "react";
import { User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  EMAIL_PROFILES_CATALOG,
  type EmailProfileOption,
} from "./email-profiles";

interface EmailProfileSelectorProps {
  selectedProfileId: string;
  onProfileChange: (profileId: string) => void;
  activeProfile: EmailProfileOption;
}

export function EmailProfileSelector({
  selectedProfileId,
  onProfileChange,
  activeProfile,
}: EmailProfileSelectorProps) {
  return (
    <div className="p-3 rounded-lg border bg-gradient-to-r from-blue-500/5 via-orange-500/5 to-transparent border-blue-200 dark:border-blue-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shadow-2xs">
      <div className="flex items-center gap-2 min-w-0">
        <div className="p-1.5 rounded-md bg-blue-600/10 text-blue-600 font-bold shrink-0">
          <User className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
            Perfil de Remitente
            <Badge
              variant="outline"
              className="text-[10px] bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200"
            >
              {activeProfile.nombre}
            </Badge>
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            Cuenta de salida:{" "}
            <strong className="text-foreground font-mono">
              {activeProfile.from_email}
            </strong>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
        <select
          value={selectedProfileId}
          onChange={(e) => onProfileChange(e.target.value)}
          className="w-full sm:w-auto h-8 text-xs font-semibold px-2.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-background text-foreground shadow-2xs focus:ring-1 focus:ring-blue-500 cursor-pointer"
        >
          {EMAIL_PROFILES_CATALOG.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} ({p.from_email})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
