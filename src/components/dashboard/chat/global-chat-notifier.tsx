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
  const activeReadChannelRef = useRef<string | null>(null)
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
            const counts = { ...data.unread_counts }
            if (activeReadChannelRef.current) {
              const readId = activeReadChannelRef.current
              const keysToClear = Object.keys(counts).filter(
                (k) => k === readId || k.replace(/^ch-/, "") === readId.replace(/^ch-/, "")
              )
              for (const k of keysToClear) delete counts[k]
            }
            setUnreadCounts(counts)
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

  // 3. Polling de respaldo cada 15 segundos para sincronizar no leídos en segundo plano
  useEffect(() => {
    if (!user?.id) return

    const pollUnread = async () => {
      try {
        const res = await authFetch(`${API_URL}/api/chat/unread-summary`)
        if (res.ok) {
          const data = await res.json()
          if (data && data.unread_counts) {
            const counts = { ...data.unread_counts }
            if (activeReadChannelRef.current) {
              const readId = activeReadChannelRef.current
              const keysToClear = Object.keys(counts).filter(
                (k) => k === readId || k.replace(/^ch-/, "") === readId.replace(/^ch-/, "")
              )
              for (const k of keysToClear) delete counts[k]
            }
            setUnreadCounts(counts)
          }
        }
      } catch {
        // Ignore polling errors in background
      }
    }

    const interval = setInterval(pollUnread, 15000)
    return () => clearInterval(interval)
  }, [user?.id])

  // 4. Listener Realtime GLOBAL permanente
  useEffect(() => {
    if (!user?.id && !user?.email) return

    const myEmail = (user.email || "").toLowerCase()
    const myId = String(user.id || "")

    const processMessage = (rawMsg: any) => {
      if (!rawMsg || !rawMsg.id) return

      const msgKey = `${rawMsg.id}_${rawMsg.created_at || rawMsg.createdAt || ""}`
      if (processedMsgIdsRef.current.has(msgKey)) return
      processedMsgIdsRef.current.add(msgKey)

      if (processedMsgIdsRef.current.size > 200) {
        const arr = Array.from(processedMsgIdsRef.current)
        processedMsgIdsRef.current = new Set(arr.slice(100))
      }

      const normalizedMsg = {
        id: String(rawMsg.id),
        channelId: String(rawMsg.channel_id || rawMsg.channelId || "general"),
        channel_id: String(rawMsg.channel_id || rawMsg.channelId || "general"),
        senderId: String(rawMsg.sender_id || rawMsg.senderId || ""),
        sender_id: String(rawMsg.sender_id || rawMsg.senderId || ""),
        senderName: rawMsg.sender_name || rawMsg.senderName || "Usuario CRM",
        sender_name: rawMsg.sender_name || rawMsg.senderName || "Usuario CRM",
        content: rawMsg.content || "",
        attachments: rawMsg.attachments || [],
        createdAt: rawMsg.created_at || rawMsg.createdAt || new Date().toISOString(),
        created_at: rawMsg.created_at || rawMsg.createdAt || new Date().toISOString(),
      }

      const senderId = normalizedMsg.senderId.toLowerCase()
      const senderName = normalizedMsg.senderName
      const channelId = normalizedMsg.channelId

      const isDm = channelId.startsWith("dm_") || channelId.startsWith("dm-")
      const userRole = (user.role || (user as any).rol || "").toLowerCase()
      const isUserAdmin =
        ["admin", "admin_general", "gerencia", "super_admin"].includes(userRole) ||
        myEmail === "gerencia@geofal.com.pe" ||
        myEmail === "admin@geofal.com.pe"

      if (!isUserAdmin) {
        if (isDm) {
          const delimiter = channelId.startsWith("dm_") ? "_" : "-"
          const prefix = channelId.startsWith("dm_") ? "dm_" : "dm-"
          const parts = channelId.replace(prefix, "").split(delimiter).map((p) => p.toLowerCase())
          const isUserInDm = parts.includes(myEmail) || parts.includes(myId)
          if (!isUserInDm) return
        } else {
          const defaultRolesMap: Record<string, string[]> = {
            general: [],
            ventas: ["admin", "admin_general", "gerencia", "super_admin", "comercial", "auxiliar_comercial"],
            "comercial-ventas": ["admin", "admin_general", "gerencia", "super_admin", "comercial", "auxiliar_comercial"],
            laboratorio: ["admin", "admin_general", "gerencia", "super_admin", "laboratorio", "jefe_laboratorio", "jefe_de_laboratorio", "tecnico", "tecnico_suelos", "laboratorio_tipificador"],
            "laboratorio-ensayos": ["admin", "admin_general", "gerencia", "super_admin", "laboratorio", "jefe_laboratorio", "jefe_de_laboratorio", "tecnico", "tecnico_suelos", "laboratorio_tipificador"],
            informes: ["admin", "admin_general", "gerencia", "super_admin", "comercial", "auxiliar_comercial", "laboratorio", "jefe_laboratorio", "jefe_de_laboratorio"],
            "informes-revision": ["admin", "admin_general", "gerencia", "super_admin", "comercial", "auxiliar_comercial", "laboratorio", "jefe_laboratorio", "jefe_de_laboratorio"],
            alertas: ["admin", "admin_general", "gerencia", "super_admin"],
            "alertas-gerencia": ["admin", "admin_general", "gerencia", "super_admin"],
          }
          const cleanChanId = channelId.toLowerCase().replace(/^ch-/, "")
          const allowed = defaultRolesMap[cleanChanId] || defaultRolesMap[channelId.toLowerCase()]
          if (allowed && allowed.length > 0 && !allowed.includes(userRole)) {
            return
          }
        }
      }

      const isFromMe =
        senderId === myId ||
        senderId === myEmail ||
        senderName.toLowerCase() === myEmail ||
        (user.name && senderName === user.name)

      // Transmitir evento normalizado a las ventanas activas (Chat o Widget Flotante)
      window.dispatchEvent(
        new CustomEvent("crm_chat_global_message", {
          detail: normalizedMsg,
        })
      )

      // Si el mensaje viene de otro usuario, ejecutar sonido y notificaciones
      if (!isFromMe) {
        playChatChimeSound()

        if (activeModule !== "comunicaciones") {
          const displaySender = senderName.split(" ")[0] || "Usuario"
          toast(`💬 Mensaje de @${displaySender}`, {
            description: normalizedMsg.content.length > 70 ? `${normalizedMsg.content.slice(0, 70)}...` : normalizedMsg.content || "Nuevo mensaje recibido",
            action: {
              label: "Ver chat",
              onClick: () => onOpenChat(),
            },
            duration: 5000,
          })
        }

        setUnreadCounts((prev) => ({
          ...prev,
          [channelId]: (prev[channelId] || 0) + 1,
        }))
      }
    }

    const handleChannelRead = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail && customEvent.detail.channelId) {
        const targetId = String(customEvent.detail.channelId)
        activeReadChannelRef.current = targetId
        setUnreadCounts((prev) => {
          const keysToClear = Object.keys(prev).filter((k) => k === targetId || k.replace(/^ch-/, "") === targetId.replace(/^ch-/, ""))
          if (keysToClear.length === 0) return prev
          const next = { ...prev }
          for (const k of keysToClear) delete next[k]
          return next
        })
      }
    }

    window.addEventListener("crm_chat_channel_read", handleChannelRead)

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
      .on("broadcast", { event: "chat_reaction_update" }, (payload) => {
        if (payload.payload) {
          window.dispatchEvent(
            new CustomEvent("crm_chat_reaction_update", {
              detail: payload.payload,
            })
          )
        }
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
      window.removeEventListener("crm_chat_channel_read", handleChannelRead)
      supabase.removeChannel(channel)
    }
  }, [user, activeModule, onOpenChat])

  return null
}
