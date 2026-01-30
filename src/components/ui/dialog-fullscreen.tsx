"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"

const DialogFullscreen = DialogPrimitive.Root
const DialogFullscreenTrigger = DialogPrimitive.Trigger

const DialogFullscreenContent = React.forwardRef<
    React.ElementRef<typeof DialogPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, style, ...props }, ref) => (
    <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <DialogPrimitive.Content
            ref={ref}
            className="fixed inset-0 z-50 flex flex-col"
            style={{
                position: 'fixed',
                inset: 0,
                width: '100vw',
                height: '100vh',
                maxWidth: 'none',
                transform: 'none',
                translate: 'none',
                ...style
            }}
            {...props}
        >
            {children}
        </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
))
DialogFullscreenContent.displayName = "DialogFullscreenContent"

export { DialogFullscreen, DialogFullscreenTrigger, DialogFullscreenContent }
