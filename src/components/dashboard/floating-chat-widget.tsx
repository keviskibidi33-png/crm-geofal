"use client"

import React, { useState, useRef, useEffect } from "react"
import {
  MessageSquare,
  X,
  Minus,
  Maximize2,
  Send,
  Paperclip,
  Image as ImageIcon,
  Smile,
  Hash,
  User as UserIcon,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { type User } from "@/hooks/use-auth"
import { toast } from "sonner"

interface FloatingChatWidgetProps {
  user: User
  onOpenFullModule?: () => void
}

interface FloatingMessage {
  id: string
  senderName: string
  senderAvatar?: string
  content: string
  isMe: boolean
  timestamp: string
  attachmentUrl?: string
}

export function FloatingChatWidget({ user, onOpenFullModule }: FloatingChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [unreadCount, setUnreadCount] = useState(1)

  const [activeChatName, setActiveChatName] = useState("Ana López (Laboratorio)")
  const [messages, setMessages] = useState<FloatingMessage[]>([
    {
      id: "fm-1",
      senderName: "Ana López",
      content: "Hola! ¿Ya tienes el reporte de la muestra de Proctor lista?",
      isMe: false,
      timestamp: "18:42",
    },
    {
      id: "fm-2",
      senderName: user.name || "Tú",
      content: "Sí, acabamos de terminar los cálculos en la planilla.",
      isMe: true,
      timestamp: "18:43",
    },
  ])

  const [inputText, setInputText] = useState("")
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (isOpen && !isMinimized) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isOpen, isMinimized])

  const handleSend = () => {
    if (!inputText.trim()) return

    const newMsg: FloatingMessage = {
      id: `fm-${Date.now()}`,
      senderName: user.name || "Usuario CRM",
      senderAvatar: user.avatar,
      content: inputText.trim(),
      isMe: true,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }

    setMessages((prev) => [...prev, newMsg])
    setInputText("")
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const file = files[0]
    const objectUrl = URL.createObjectURL(file)

    const newMsg: FloatingMessage = {
      id: `fm-${Date.now()}`,
      senderName: user.name || "Usuario CRM",
      content: `📷 Imagen enviada: ${file.name}`,
      isMe: true,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      attachmentUrl: objectUrl,
    }

    setMessages((prev) => [...prev, newMsg])
    toast.success("Foto enviada en el chat", { description: file.name })
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end pointer-events-none">
      {/* ── BURBUJA FLOTANTE CUANDO ESTÁ CERRADO O MINIMIZADO ── */}
      {(!isOpen || isMinimized) && (
        <button
          onClick={() => {
            setIsOpen(true)
            setIsMinimized(false)
            setUnreadCount(0)
          }}
          className="pointer-events-auto flex items-center justify-center h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border-2 border-background relative group"
          title="Abrir Chat de Comunicación"
        >
          <MessageSquare className="h-6 w-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground ring-2 ring-background animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>
      )}

      {/* ── VENTANA POP-UP ESTILO FACEBOOK MESSENGER ── */}
      {isOpen && !isMinimized && (
        <div className="pointer-events-auto w-80 sm:w-96 h-112 bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-200">
          {/* Encabezado del Pop-up */}
          <div className="p-3 bg-card border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <Avatar className="h-8 w-8 border border-primary/30">
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">AL</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate leading-tight">{activeChatName}</p>
                <p className="text-[10px] text-emerald-500 font-medium flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  En línea
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {onOpenFullModule && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={onOpenFullModule}
                  title="Abrir en pantalla completa (Discord mode)"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setIsMinimized(true)}
                title="Minimizar"
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => setIsOpen(false)}
                title="Cerrar"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Feed de Mensajes */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-background/50 text-xs">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col ${msg.isMe ? "items-end" : "items-start"}`}>
                <div
                  className={`p-2.5 rounded-2xl max-w-[85%] leading-relaxed ${
                    msg.isMe
                      ? "bg-primary text-primary-foreground rounded-tr-none shadow-xs"
                      : "bg-card border border-border text-card-foreground rounded-tl-none shadow-xs"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.attachmentUrl && (
                    <img
                      src={msg.attachmentUrl}
                      alt="Adjunto"
                      className="mt-2 rounded-lg max-h-40 object-cover border border-border"
                    />
                  )}
                </div>
                <span className="text-[9px] text-muted-foreground mt-0.5 px-1">{msg.timestamp}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input de Texto */}
          <div className="p-2 border-t border-border bg-card">
            <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-2 py-1">
              <label className="cursor-pointer p-1 hover:bg-accent rounded-md text-muted-foreground transition-colors">
                <ImageIcon className="h-4 w-4" />
                <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              </label>

              <Input
                placeholder="Escribe un mensaje..."
                className="flex-1 border-none shadow-none focus-visible:ring-0 text-xs h-7 bg-transparent px-1"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleSend()
                  }
                }}
              />

              <Button
                size="icon"
                className="h-7 w-7 rounded-lg shrink-0"
                onClick={handleSend}
                disabled={!inputText.trim()}
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
