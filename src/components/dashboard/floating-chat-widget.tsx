"use client"

import React, { useState, useRef, useEffect } from "react"
import {
  MessageSquare,
  X,
  Minus,
  Maximize2,
  Send,
  Image as ImageIcon,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

import { authFetch } from "@/lib/api-auth"

export function FloatingChatWidget({ user, onOpenFullModule }: FloatingChatWidgetProps) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  const [activeChannelId, setActiveChannelId] = useState("laboratorio")
  const [messages, setMessages] = useState<FloatingMessage[]>([])
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([
    { id: "laboratorio", name: "# laboratorio-ensayos" },
    { id: "general", name: "# general" },
    { id: "ventas", name: "# comercial-ventas" },
    { id: "informes", name: "# informes-revision" },
    { id: "alertas", name: "# alertas-gerencia" },
  ])

  useEffect(() => {
    async function loadChannels() {
      try {
        const res = await authFetch(`${API_URL}/api/chat/channels`)
        if (res.ok) {
          const data = await res.json()
          if (data.channels && data.channels.length > 0) {
            const list = data.channels
              .filter((c: any) => c.category !== "dm" && !c.id.startsWith("dm-"))
              .map((c: any) => ({
                id: c.id,
                name: `# ${c.name}`,
              }))
            if (list.length > 0) setChannels(list)
          }
        }
      } catch (err) {
        console.warn("Could not fetch channels for floating widget:", err)
      }
    }
    loadChannels()
  }, [API_URL])

  const [inputText, setInputText] = useState("")
  const chatEndRef = useRef<HTMLDivElement | null>(null)

  // 1. Cargar mensajes reales de API para el widget flotante
  useEffect(() => {
    async function loadWidgetMessages() {
      try {
        const res = await authFetch(`${API_URL}/api/chat/messages/${activeChannelId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.messages) {
            const apiMsgs: FloatingMessage[] = data.messages.map((m: any) => ({
              id: m.id,
              senderName: m.sender_name || "Usuario",
              senderAvatar: m.sender_avatar,
              content: m.content,
              isMe: Boolean(
                m.sender_id === user.id ||
                m.sender_id === user.email ||
                (m.sender_name && (
                  m.sender_name === user.name ||
                  m.sender_name === user.email ||
                  m.sender_name.toLowerCase() === user.email.toLowerCase()
                ))
              ),
              timestamp: new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              attachmentUrl: m.attachments?.[0]?.url,
            }))
            setMessages(apiMsgs)
          }
        }
      } catch (err) {
        console.warn("Could not fetch floating chat messages:", err)
      }
    }
    loadWidgetMessages()
  }, [activeChannelId, API_URL, user.email, user.id, user.name])

  // 2. Escuchar eventos globales de chat para actualizar el widget flotante
  useEffect(() => {
    const handleGlobalMessage = (e: Event) => {
      const customEvent = e as CustomEvent
      const newMsg = customEvent.detail
      if (!newMsg || !newMsg.id) return

      const msgChannelId = String(newMsg.channel_id || newMsg.channelId || "")
      if (msgChannelId !== activeChannelId) return

      const senderId = String(newMsg.sender_id || newMsg.senderId || "").toLowerCase()
      const senderName = newMsg.sender_name || newMsg.senderName || "Usuario CRM"
      const myEmail = (user.email || "").toLowerCase()
      const myId = String(user.id || "")

      const isMe = Boolean(
        senderId === myId ||
        senderId === myEmail ||
        senderName.toLowerCase() === myEmail ||
        (user.name && senderName === user.name)
      )

      const incomingFloatMsg: FloatingMessage = {
        id: newMsg.id,
        senderName,
        senderAvatar: newMsg.sender_avatar || newMsg.senderAvatar,
        content: newMsg.content || "",
        isMe,
        timestamp: new Date(newMsg.created_at || newMsg.createdAt || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        attachmentUrl: newMsg.attachments?.[0]?.url,
      }

      setMessages((prev) => {
        if (prev.some((m) => m.id === incomingFloatMsg.id)) return prev

        const tempIndex = prev.findIndex(
          (m) =>
            m.id.startsWith("fm-") &&
            m.content.trim() === incomingFloatMsg.content.trim() &&
            m.isMe === incomingFloatMsg.isMe
        )

        if (tempIndex !== -1) {
          const updated = [...prev]
          updated[tempIndex] = incomingFloatMsg
          return updated
        }

        return [...prev, incomingFloatMsg]
      })

      if (!isMe && (!isOpen || isMinimized)) {
        setUnreadCount((c) => c + 1)
      }
    }

    window.addEventListener("crm_chat_global_message", handleGlobalMessage)
    return () => {
      window.removeEventListener("crm_chat_global_message", handleGlobalMessage)
    }
  }, [isOpen, isMinimized, user.id, user.email, user.name, activeChannelId])

  useEffect(() => {
    if (isOpen && !isMinimized) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isOpen, isMinimized])

  // 3. Enviar mensaje real
  const handleSend = async () => {
    if (!inputText.trim()) return

    const textToSend = inputText.trim()
    setInputText("")

    const tempMsg: FloatingMessage = {
      id: `fm-${Date.now()}`,
      senderName: user.name || "Usuario CRM",
      senderAvatar: user.avatar,
      content: textToSend,
      isMe: true,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    }

    setMessages((prev) => [...prev, tempMsg])

    try {
      await authFetch(`${API_URL}/api/chat/messages`, {
        method: "POST",
        body: JSON.stringify({
          channel_id: activeChannelId,
          content: textToSend,
        }),
      })
    } catch (err) {
      console.warn("Failed to send floating widget message:", err)
    }
  }

  // 4. Enviar imagen real
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const file = files[0]
    const objectUrl = URL.createObjectURL(file)

    const attachmentObj = {
      url: objectUrl,
      type: "image",
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
    }

    const contentText = `📷 Imagen enviada: ${file.name}`

    const tempMsg: FloatingMessage = {
      id: `fm-${Date.now()}`,
      senderName: user.name || "Usuario CRM",
      content: contentText,
      isMe: true,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      attachmentUrl: objectUrl,
    }

    setMessages((prev) => [...prev, tempMsg])

    try {
      await authFetch(`${API_URL}/api/chat/messages`, {
        method: "POST",
        body: JSON.stringify({
          channel_id: activeChannelId,
          content: contentText,
          attachments: [attachmentObj],
        }),
      })
      toast.success("Foto enviada en el chat", { description: file.name })
    } catch (err) {
      console.warn("Error uploading file in floating widget:", err)
    }
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
              <div className="min-w-0 flex flex-col justify-center">
                <select
                  value={activeChannelId}
                  onChange={(e) => {
                    const selId = e.target.value
                    setActiveChannelId(selId)
                  }}
                  className="bg-transparent text-xs font-bold text-foreground cursor-pointer focus:outline-none border-b border-border/40 hover:border-primary transition-colors py-0.5"
                >
                  {channels.map((c) => (
                    <option key={c.id} value={c.id} className="bg-background text-foreground text-xs font-medium">
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-emerald-500 font-medium flex items-center gap-1 mt-0.5">
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
                    // eslint-disable-next-line @next/next/no-img-element
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
