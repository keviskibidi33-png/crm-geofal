"use client"

import { useState, useCallback } from "react"

export function useConfirmDialog(onActionConfirmed?: () => void | Promise<void>) {
  const [isOpen, setIsOpen] = useState(false)

  const openDialog = useCallback(() => {
    setIsOpen(true)
  }, [])

  const closeDialog = useCallback(() => {
    setIsOpen(false)
  }, [])

  const handleConfirm = useCallback(async () => {
    setIsOpen(false)
    if (onActionConfirmed) {
      await onActionConfirmed()
    }
  }, [onActionConfirmed])

  return {
    isOpen,
    openDialog,
    closeDialog,
    handleConfirm,
    setIsOpen,
  }
}
