"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { toast } from "sonner"
import { type User } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabaseClient"
import { authFetch } from "@/lib/api-auth"
import {
  type ChatChannel,
  type ChatMessage,
  type TeamUser,
  areChannelIdsEqual,
  getAvatarUrl,
  playChatChimeSound,
} from "../types"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

interface UseChatMessagesProps {
  user: User
  activeChannelId: string
  activeChannel: ChatChannel
  teamUsers: TeamUser[]
  channels: ChatChannel[]
  setStartedDmUserIds: React.Dispatch<React.SetStateAction<string[]>>
}

export function useChatMessages({
  user,
  activeChannelId,
  activeChannel,
  teamUsers,
  channels,
  setStartedDmUserIds,
}: UseChatMessagesProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; timestamp: number }>>({})

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // 1. Cargar mensajes del canal activo
  useEffect(() => {
    async function fetchChannelMessages() {
      if (!activeChannelId) return
      setIsLoadingMessages(true)
      try {
        const res = await authFetch(`${API_URL}/api/chat/messages/${activeChannelId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.messages) {
            const loadedMessages: ChatMessage[] = data.messages.map((m: any) => {
              const userMatch = teamUsers.find(
                (u) =>
                  u.email.toLowerCase() === String(m.sender_id || "").toLowerCase() ||
                  u.email.toLowerCase() === String(m.sender_name || "").toLowerCase() ||
                  String(u.id) === String(m.sender_id)
              )
              const rawAtt = m.attachments
              const safeAtt = typeof rawAtt === "string" ? (function() { try { return JSON.parse(rawAtt) } catch { return [] } })() : (Array.isArray(rawAtt) ? rawAtt : [])
              const rawReactions = m.reactions
              const safeReactions = typeof rawReactions === "string" ? (function() { try { return JSON.parse(rawReactions) } catch { return {} } })() : (rawReactions && typeof rawReactions === "object" ? rawReactions : {})

              return {
                id: m.id,
                channelId: m.channel_id,
                senderId: m.sender_id,
                senderName: userMatch?.name || m.sender_name || "Usuario CRM",
                senderAvatar: getAvatarUrl(m.sender_avatar) || userMatch?.avatar,
                content: m.content,
                attachments: safeAtt,
                createdAt: m.created_at,
                parent_id: m.parent_id || m.parentId,
                read: Boolean(m.is_read || m.read),
                reactions: safeReactions,
              }
            })

            const sorted = [...loadedMessages].sort((a, b) => {
              const tA = new Date(a.createdAt).getTime()
              const tB = new Date(b.createdAt).getTime()
              if (tA !== tB) return tA - tB
              return (a.id || "").localeCompare(b.id || "")
            })

            setMessages(sorted)
          }
        }
      } catch (err) {
        console.warn("Error fetching channel messages:", err)
      } finally {
        setIsLoadingMessages(false)
      }
    }

    setMessages([])
    fetchChannelMessages()

    const handleFocusOrVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchChannelMessages()
      }
    }

    window.addEventListener("focus", handleFocusOrVisibility)
    document.addEventListener("visibilitychange", handleFocusOrVisibility)

    return () => {
      window.removeEventListener("focus", handleFocusOrVisibility)
      document.removeEventListener("visibilitychange", handleFocusOrVisibility)
    }
  }, [activeChannelId, teamUsers])

  // Clear unread counts for active channel (clears "chisme visual" badge)
  useEffect(() => {
    if (!activeChannelId) return

    setUnreadCounts((prev) => {
      const keysToClear = Object.keys(prev).filter((k) => k === activeChannelId || areChannelIdsEqual(k, activeChannelId))
      if (keysToClear.length === 0) return prev
      const next = { ...prev }
      for (const k of keysToClear) {
        delete next[k]
      }
      return next
    })

    window.dispatchEvent(
      new CustomEvent("crm_chat_channel_read", {
        detail: { channelId: activeChannelId },
      })
    )

    // Persistir lectura en el servidor para que el backend no devuelva no leídos en /unread-summary
    authFetch(`${API_URL}/api/chat/messages/mark-read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel_id: activeChannelId }),
    }).catch(() => {})
  }, [activeChannelId, messages.length])

  // Broadcast total unread count to global UI (Sidebar badge)
  useEffect(() => {
    const total = Object.values(unreadCounts).reduce((acc, count) => acc + count, 0)
    window.dispatchEvent(
      new CustomEvent("crm_chat_unread_count", {
        detail: { count: total },
      })
    )
  }, [unreadCounts])

  // 2. Suscripción GLOBAL Dual-Stream (Postgres Changes + Broadcast instantáneo)
  useEffect(() => {
    const processIncomingMessage = (newMsg: any) => {
      if (!newMsg) return

      const msgChannelId = String(newMsg.channel_id || newMsg.channelId || "")
      const myEmail = (user.email || "").toLowerCase()
      const myId = String(user.id || "")

      const isDm = msgChannelId.startsWith("dm_") || msgChannelId.startsWith("dm-")
      if (isDm) {
        const delimiter = msgChannelId.startsWith("dm_") ? "_" : "-"
        const prefix = msgChannelId.startsWith("dm_") ? "dm_" : "dm-"
        const parts = msgChannelId.replace(prefix, "").split(delimiter).map((p) => p.toLowerCase())
        const isUserInDm = parts.includes(myEmail) || parts.includes(myId)
        if (!isUserInDm) return

        const otherUser = teamUsers.find(
          (u) =>
            parts.includes(u.email.toLowerCase()) &&
            u.email.toLowerCase() !== myEmail &&
            String(u.id) !== myId
        )
        const senderUser = teamUsers.find(
          (u) =>
            u.email.toLowerCase() === String(newMsg.sender_id || newMsg.senderId || "").toLowerCase() ||
            u.email.toLowerCase() === String(newMsg.sender_name || newMsg.senderName || "").toLowerCase() ||
            String(u.id) === String(newMsg.sender_id || newMsg.senderId)
        )

        const targetUserId = otherUser?.id || senderUser?.id
        if (targetUserId) {
          setStartedDmUserIds((prev) => (prev.includes(targetUserId) ? [targetUserId, ...prev.filter((id) => id !== targetUserId)] : [targetUserId, ...prev]))
        }
      } else {
        const isAccessibleChannel = channels.some((c) => c.id === msgChannelId)
        if (!isAccessibleChannel) return
      }

      const isCurrentActiveChannel = areChannelIdsEqual(msgChannelId, activeChannelId)

      if (isCurrentActiveChannel) {
        const senderUser = teamUsers.find(
          (u) =>
            u.email.toLowerCase() === String(newMsg.sender_id || newMsg.senderId || "").toLowerCase() ||
            u.email.toLowerCase() === String(newMsg.sender_name || newMsg.senderName || "").toLowerCase() ||
            String(u.id) === String(newMsg.sender_id || newMsg.senderId)
        )
        const rawAtt = newMsg.attachments
        const safeAtt = typeof rawAtt === "string" ? (function() { try { return JSON.parse(rawAtt) } catch { return [] } })() : (Array.isArray(rawAtt) ? rawAtt : [])
        const rawReactions = newMsg.reactions
        const safeReactions = typeof rawReactions === "string" ? (function() { try { return JSON.parse(rawReactions) } catch { return {} } })() : (rawReactions && typeof rawReactions === "object" ? rawReactions : {})

        const incomingMsg: ChatMessage = {
          id: newMsg.id,
          channelId: msgChannelId,
          senderId: newMsg.sender_id || newMsg.senderId,
          senderName: senderUser?.name || newMsg.sender_name || newMsg.senderName || "Usuario CRM",
          senderAvatar: getAvatarUrl(newMsg.sender_avatar || newMsg.senderAvatar) || senderUser?.avatar,
          content: newMsg.content || "",
          attachments: safeAtt,
          createdAt: newMsg.created_at || newMsg.createdAt || new Date().toISOString(),
          parent_id: newMsg.parent_id || newMsg.parentId,
          read: isCurrentActiveChannel || Boolean(newMsg.is_read || newMsg.read),
          reactions: safeReactions,
        }

        setMessages((prev) => {
          let updatedList: ChatMessage[] = []
          if (prev.some((m) => m.id === incomingMsg.id)) {
            updatedList = prev.map((m) => (m.id === incomingMsg.id ? incomingMsg : m))
          } else {
            const tempIndex = prev.findIndex(
              (m) =>
                (m.id.startsWith("msg-") || m.id.startsWith("fm-")) &&
                m.content.trim() === incomingMsg.content.trim() &&
                (m.senderId === incomingMsg.senderId || m.senderName === incomingMsg.senderName)
            )
            if (tempIndex !== -1) {
              updatedList = [...prev]
              updatedList[tempIndex] = incomingMsg
            } else {
              updatedList = [...prev, incomingMsg]
            }
          }

          return [...updatedList].sort((a, b) => {
            const tA = new Date(a.createdAt).getTime()
            const tB = new Date(b.createdAt).getTime()
            if (tA !== tB) return tA - tB
            return (a.id || "").localeCompare(b.id || "")
          })
        })
        setTimeout(scrollToBottom, 50)
      } else {
        setUnreadCounts((prev) => ({
          ...prev,
          [msgChannelId]: (prev[msgChannelId] || 0) + 1,
        }))
      }

      const senderVal = newMsg.sender_id || newMsg.senderId
      const senderNameVal = newMsg.sender_name || newMsg.senderName
      const isFromOther =
        senderVal !== user.id &&
        senderVal !== user.email &&
        senderNameVal !== user.name &&
        senderNameVal !== user.email

      if (isFromOther) {
        playChatChimeSound()
      }
    }

    const handleGlobalMessage = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail) {
        processIncomingMessage(customEvent.detail)
      }
    }

    const handleGlobalReaction = (e: Event) => {
      const customEvent = e as CustomEvent
      const data = customEvent.detail
      if (data && data.msgId) {
        setMessages((prev) =>
          prev.map((m) => (m.id === data.msgId ? { ...m, reactions: data.reactions || {} } : m))
        )
      }
    }

    window.addEventListener("crm_chat_global_message", handleGlobalMessage)
    window.addEventListener("crm_chat_reaction_update", handleGlobalReaction)

    const globalChatChannel = supabase
      .channel(`chat_active_view_${activeChannelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => processIncomingMessage(payload.new)
      )
      .on("broadcast", { event: "chat_message_broadcast" }, (payload) => {
        processIncomingMessage(payload.payload)
      })
      .on("broadcast", { event: "chat_reaction_update" }, (payload) => {
        const data = payload.payload
        if (data && data.msgId) {
          setMessages((prev) =>
            prev.map((m) => (m.id === data.msgId ? { ...m, reactions: data.reactions || {} } : m))
          )
        }
      })
      .on("broadcast", { event: "chat_read_receipt" }, (payload) => {
        const data = payload.payload
        if (data && areChannelIdsEqual(data.channel_id, activeChannelId)) {
          setMessages((prev) => prev.map((m) => ({ ...m, read: true })))
        }
      })
      .subscribe()

    return () => {
      window.removeEventListener("crm_chat_global_message", handleGlobalMessage)
      window.removeEventListener("crm_chat_reaction_update", handleGlobalReaction)
      supabase.removeChannel(globalChatChannel)
    }
  }, [activeChannelId, teamUsers, user.id, user.email, user.name, channels, setStartedDmUserIds])

  const handleSendMessage = async (attachmentsParam?: any, parentIdParam?: string) => {
    if ((!inputMessage.trim() && (!attachmentsParam || attachmentsParam.length === 0)) || !activeChannelId) return

    const tempId = `msg-${Date.now()}`
    const textToSend = inputMessage.trim()
    setInputMessage("")

    const userMatch = teamUsers.find(
      (u) =>
        u.email.toLowerCase() === String(user.email || "").toLowerCase() ||
        String(u.id) === String(user.id)
    )

    const newMsg: ChatMessage = {
      id: tempId,
      channelId: activeChannelId,
      senderId: user.id || user.email || "user-crm",
      senderName: userMatch?.name || user.name || user.email || "Usuario CRM",
      senderAvatar: user.avatar || userMatch?.avatar,
      content: textToSend,
      attachments: attachmentsParam || [],
      createdAt: new Date().toISOString(),
      parent_id: parentIdParam,
      read: true,
      reactions: {},
    }

    setMessages((prev) => [...prev, newMsg])
    setTimeout(scrollToBottom, 50)

    try {
      const res = await authFetch(`${API_URL}/api/chat/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: tempId,
          channel_id: activeChannelId,
          content: textToSend,
          attachments: attachmentsParam || [],
          parent_id: parentIdParam,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data && data.message) {
          const rawAtt = data.message.attachments
          const safeAtt = typeof rawAtt === "string" ? (function() { try { return JSON.parse(rawAtt) } catch { return [] } })() : (Array.isArray(rawAtt) ? rawAtt : [])

          const confirmedMsg: ChatMessage = {
            id: data.message.id,
            channelId: data.message.channel_id,
            senderId: data.message.sender_id,
            senderName: userMatch?.name || data.message.sender_name || user.name || "Usuario CRM",
            senderAvatar: getAvatarUrl(data.message.sender_avatar) || user.avatar || userMatch?.avatar,
            content: data.message.content,
            attachments: safeAtt,
            createdAt: data.message.created_at,
            parent_id: data.message.parent_id,
            read: true,
            reactions: {},
          }

          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? confirmedMsg : m))
          )

          const broadcastChannel = supabase.channel("chat_global_realtime_stream")
          broadcastChannel.send({
            type: "broadcast",
            event: "chat_message_broadcast",
            payload: data.message,
          })
        }
      }
    } catch (err) {
      console.warn("Error sending message via API:", err)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    const file = files[0]
    const formData = new FormData()
    formData.append("file", file)
    formData.append("channel_id", activeChannelId)

    try {
      const res = await authFetch(`${API_URL}/api/chat/upload`, {
        method: "POST",
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        if (data && data.attachment) {
          handleSendMessage([data.attachment])
          toast.success("Archivo subido correctamente")
        }
      } else {
        toast.error("Error al subir el archivo")
      }
    } catch (err) {
      console.warn("Error uploading file:", err)
      toast.error("Error al conectar con el servidor para subir archivo")
    }
  }

  const handleTyping = () => {
    const myName = user.name || user.email || "Usuario"
    const channel = supabase.channel(`typing_${activeChannelId}`)
    channel.send({
      type: "broadcast",
      event: "typing",
      payload: { user: myName },
    })

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      setTypingUsers({})
    }, 3000)
  }

  const toggleReaction = useCallback(
    async (msgId: string, emoji: string) => {
      const userMatch = teamUsers.find(
        (u) =>
          u.email.toLowerCase() === String(user.email || "").toLowerCase() ||
          String(u.id) === String(user.id)
      )
      const myName = userMatch?.name || user.name || user.email || "Usuario CRM"

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== msgId) return msg
          const currentReactions = { ...(msg.reactions || {}) }
          const userArr = [...(currentReactions[emoji] || [])]
          const idx = userArr.indexOf(myName)
          if (idx !== -1) {
            userArr.splice(idx, 1)
          } else {
            userArr.push(myName)
          }
          if (userArr.length > 0) {
            currentReactions[emoji] = userArr
          } else {
            delete currentReactions[emoji]
          }
          return { ...msg, reactions: currentReactions }
        })
      )

      try {
        const res = await authFetch(`${API_URL}/api/chat/messages/${msgId}/reactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        })

        let updatedReactions: Record<string, string[]> | null = null
        if (res.ok) {
          const data = await res.json()
          if (data.reactions) {
            updatedReactions = data.reactions
            setMessages((prev) =>
              prev.map((m) => (m.id === msgId ? { ...m, reactions: data.reactions } : m))
            )
          }
        }

        const payload = { msgId, reactions: updatedReactions || {} }
        supabase.channel(`chat_active_view_${activeChannelId}`).send({
          type: "broadcast",
          event: "chat_reaction_update",
          payload,
        })
        supabase.channel("chat_global_realtime_stream").send({
          type: "broadcast",
          event: "chat_reaction_update",
          payload,
        })
      } catch (err) {
        console.warn("Error toggling reaction:", err)
      }
    },
    [activeChannelId, teamUsers, user.email, user.id, user.name]
  )

  const activeMessages = messages.filter((m) => areChannelIdsEqual(m.channelId, activeChannelId))

  return {
    messages,
    setMessages,
    activeMessages,
    inputMessage,
    setInputMessage,
    isLoadingMessages,
    unreadCounts,
    setUnreadCounts,
    selectedImage,
    setSelectedImage,
    typingUsers,
    messagesEndRef,
    handleSendMessage,
    handleFileUpload,
    handleTyping,
    toggleReaction,
  }
}
