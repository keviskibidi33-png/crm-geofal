/**
 * Service to manage local draft backups in Geofal CRM.
 * Collects form drafts from localStorage and handles JSON import/export.
 */

export interface BackupPayload {
    version: number;
    exportedAt: string;
    system: string;
    drafts: Record<string, string>;
}

/**
 * Scans localStorage for draft keys and builds a backup payload.
 */
export function exportAllLocalDrafts(): BackupPayload {
    const drafts: Record<string, string> = {};
    
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
            const lowerKey = key.toLowerCase();
            // Match any key that contains "draft", "_state", or "persist" (ignoring auth tokens/session states)
            if (
                (lowerKey.includes("draft") || lowerKey.includes("_state") || lowerKey.includes("persist")) &&
                !lowerKey.includes("supabase.auth") &&
                !lowerKey.includes("sb-")
            ) {
                const val = localStorage.getItem(key);
                if (val) {
                    drafts[key] = val;
                }
            }
        }
    }

    return {
        version: 1,
        exportedAt: new Date().toISOString(),
        system: "Geofal CRM",
        drafts
    };
}

/**
 * Packages and downloads the backup JSON file.
 */
export function downloadBackupFile(): void {
    const payload = exportAllLocalDrafts();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split("T")[0];
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `geofal_crm_backup_${dateStr}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
}

/**
 * Validates and restores a backup payload into localStorage.
 */
export function importBackupFile(jsonString: string): { success: boolean; count: number; error?: string } {
    try {
        const payload = JSON.parse(jsonString) as BackupPayload;
        
        if (!payload || payload.system !== "Geofal CRM" || !payload.drafts) {
            return { success: false, count: 0, error: "El archivo no es una copia de seguridad válida de Geofal CRM." };
        }

        const keys = Object.keys(payload.drafts);
        let restoredCount = 0;

        keys.forEach(key => {
            const value = payload.drafts[key];
            if (value) {
                localStorage.setItem(key, value);
                restoredCount++;
            }
        });

        return { success: true, count: restoredCount };
    } catch (e: any) {
        return { success: false, count: 0, error: e?.message || "Error al parsear el archivo JSON." };
    }
}
