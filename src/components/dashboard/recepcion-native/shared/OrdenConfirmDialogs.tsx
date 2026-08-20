"use client";

import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface OrdenConfirmDialogsProps {
  isDeleteModalOpen: boolean;
  setIsDeleteModalOpen: (open: boolean) => void;
  handleConfirmDelete: () => void;
  sampleDeleteIndex: number | null;
  setSampleDeleteIndex: (index: number | null) => void;
  handleConfirmSampleDelete: () => void;
}

export function OrdenConfirmDialogs({
  isDeleteModalOpen,
  setIsDeleteModalOpen,
  handleConfirmDelete,
  sampleDeleteIndex,
  setSampleDeleteIndex,
  handleConfirmSampleDelete,
}: OrdenConfirmDialogsProps) {
  return (
    <>
      {/* Delete Draft Confirmation */}
      <AlertDialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar borrador?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción borrará todos los datos temporales no guardados. No se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Sample Confirmation */}
      <AlertDialog
        open={sampleDeleteIndex !== null}
        onOpenChange={(open) => {
          if (!open) setSampleDeleteIndex(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar muestra?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción quitará la muestra de la recepción actual. Deberá guardar la
              recepción para persistir el cambio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSampleDelete}>
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
