"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { type User } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabaseClient"
import { authFetch } from "@/lib/api-auth"
import { playChatChimeSound } from "./types"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

interface GlobalChatNotifierProps {
  user: User
  activeModule: string
  onOpenChat: () => void
}

export function GlobalChatNotifier({ user, activeModule, onOpenChat }: GlobalChatNotifierProps) {
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const processedMsgIdsRef = useRef<Set<string>>(new Set())

  // 1. Cargar resumen inicial de mensajes no leídos desde el servidor
  useEffect(() => {
    if (!user?.id) return

    async function loadUnreadSummary() {
      try {
        const res = await authFetch(`${API_URL}/api/chat/unread-summary`)
        if (res.ok) {
          const data = await res.json()
          if (data && data.unread_counts) {
            setUnreadCounts(data.unread_counts)
          }
        }
      } catch (err) {
        console.warn("[GlobalChatNotifier] Error fetching unread summary:", err)
      }
    }

    void loadUnreadSummary()
  }, [user?.id])

  // 2. Emitir el conteo total acumulado al Sidebar
  useEffect(() => {
    const totalUnread = Object.values(unreadCounts).reduce((acc, count) => acc + count, 0)
    window.dispatchEvent(
      new CustomEvent("crm_chat_unread_count", {
        detail: { count: totalUnread },
      })
    )
  }, [unreadCounts])

  // 3. Listener Realtime GLOBAL permanente
  useEffect(() => {
    if (!user?.id && !user?.email) return

    const myEmail = (user.email || "").toLowerCase()
    const myId = String(user.id || "")

    const processMessage = (newMsg: any) => {
      if (!newMsg || !newMsg.id) return

      // Evitar procesar duplicados idénticos en la misma sesión
      const msgKey = `${newMsg.id}_${newMsg.created_at || newMsg.createdAt || ""}`
      if (processedMsgIdsRef.current.has(msgKey)) return
      processedMsgIdsRef.current.add(msgKey)

      // Limpiar el set si crece demasiado
      if (processedMsgIdsRef.current.size > 200) {
        const arr = Array.from(processedMsgIdsRef.current)
        processedMsgIdsRef.current = new Set(arr.slice(100))
      }

      const senderId = String(newMsg.sender_id || newMsg.senderId || "").toLowerCase()
      const senderName = newMsg.sender_name || newMsg.senderName || "Usuario CRM"
      const content = newMsg.content || ""
      const channelId = String(newMsg.channel_id || newMsg.channelId || "general")

      const isFromMe =
        senderId === myId ||
        senderId === myEmail ||
        senderName.toLowerCase() === myEmail ||
        (user.name && senderName === user.name)

      // Transmitir evento a las ventanas activas (Chat o Widget Flotante)
      window.dispatchEvent(
        new CustomEvent("crm_chat_global_message", {
          detail: newMsg,
        })
      )

      // Si el mensaje viene de otro usuario, ejecutar sonido y notificaciones
      if (!isFromMe) {
        playChatChimeSound()

        // Si el usuario no está en la pestaña de Comunicaciones, mostrar Toast de notificación
        if (activeModule !== "comunicaciones") {
          const displaySender = senderName.split(" ")[0] || "Usuario"
          toast(`💬 Mensaje de @${displaySender}`, {
            description: content.length > 70 ? `${content.slice(0, 70)}...` : content || "Nuevo mensaje recibido",
            action: {
              label: "Ver chat",
              onClick: () => onOpenChat(),
            },
            duration: 5000,
          })
        }

        // Incrementar contador de no leídos para este canal
        setUnreadCounts((prev) => ({
          ...prev,
          [channelId]: (prev[channelId] || 0) + 1,
        }))
      }
    }

    const channel = supabase
      .channel("chat_global_realtime_stream")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => processMessage(payload.new)
      )
      .on("broadcast", { event: "chat_message_broadcast" }, (payload) => {
        processMessage(payload.payload)
      })
      .on("broadcast", { event: "chat_read_receipt" }, (payload) => {
        const data = payload.payload
        if (data && data.channel_id) {
          setUnreadCounts((prev) => {
            if (!prev[data.channel_id]) return prev
            const next = { ...prev }
            delete next[data.channel_id]
            return next
          })
        }
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[GlobalChatNotifier] Connected to global chat realtime stream.")
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user.id, user.email, user.name, activeModule, onOpenChat])

  return null
}
