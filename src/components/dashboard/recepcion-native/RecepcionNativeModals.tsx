"use client";

import React, { useState, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { OrdenForm } from "./OrdenForm";
import { OrdenDetail } from "./OrdenDetail";

type NativeView = "form" | "detail" | null;

interface RecepcionNativeModalsProps {
  initialMode: "create" | "edit" | "detail";
  editId?: number | null;
  detailId?: number | null;
  importedData?: Record<string, unknown> | null;
  onClose: (reason?: "created" | "updated") => void;
}

export function RecepcionNativeModals({
  initialMode,
  editId,
  detailId,
  importedData,
  onClose,
}: RecepcionNativeModalsProps) {
  const [open, setOpen] = useState(true);
  const [currentView, setCurrentView] = useState<NativeView>(
    initialMode === "detail" ? "detail" : "form"
  );
  const [currentEditId, setCurrentEditId] = useState<number | null>(
    initialMode === "edit" && editId ? editId : null
  );
  const [currentDetailId, setCurrentDetailId] = useState<number | null>(
    initialMode === "detail" && detailId ? detailId : null
  );

  // Reset state when props change
  useEffect(() => {
    setOpen(true);
    if (initialMode === "detail" && detailId) {
      setCurrentView("detail");
      setCurrentDetailId(detailId);
    } else {
      setCurrentView("form");
      setCurrentEditId(initialMode === "edit" && editId ? editId : null);
    }
  }, [initialMode, editId, detailId]);

  const handleFormClose = useCallback(
    (reason?: "created" | "updated") => {
      if (reason === "created" || reason === "updated") {
        onClose(reason);
      } else {
        setOpen(false);
        onClose();
      }
    },
    [onClose]
  );

  const handleClose = useCallback(() => {
    setOpen(false);
    onClose();
  }, [onClose]);

  const handleEditFromDetail = useCallback(() => {
    if (currentDetailId) {
      setCurrentEditId(currentDetailId);
      setCurrentView("form");
    }
  }, [currentDetailId]);

  if (!open) return null;

  return (
    <>
      {/* Form Modal */}
      <Dialog
        open={currentView === "form"}
        onOpenChange={(isOpen) => {
          if (!isOpen) handleFormClose();
        }}
      >
        <DialogContent className="max-w-5xl h-[90vh] p-0 [&>button]:hidden">
          <DialogTitle className="sr-only">
            {currentEditId ? "Editar Recepción Probetas" : "Nueva Recepción Probetas"}
          </DialogTitle>
          {currentView === "form" && (
            <OrdenForm
              mode={currentEditId ? "edit" : "create"}
              editId={currentEditId ?? undefined}
              importedData={importedData}
              onClose={handleFormClose}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog
        open={currentView === "detail"}
        onOpenChange={(isOpen) => {
          if (!isOpen) handleClose();
        }}
      >
        <DialogContent className="max-w-5xl h-[90vh] p-0 [&>button]:hidden">
          <DialogTitle className="sr-only">Detalle de Recepción</DialogTitle>
          {currentView === "detail" && currentDetailId && (
            <OrdenDetail
              recepcionId={currentDetailId}
              onEdit={handleEditFromDetail}
              onClose={handleClose}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
