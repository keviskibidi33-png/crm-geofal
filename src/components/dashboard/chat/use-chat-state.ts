"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { toast } from "sonner"
import { type User } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabaseClient"
import { authFetch } from "@/lib/api-auth"
import {
  type ChatChannel,
  type ChatMessage,
  type TeamUser,
  DEFAULT_CHANNELS,
  getCanonicalDmId,
  areChannelIdsEqual,
  getAvatarUrl,
  playChatChimeSound,
} from "./types"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

export function useChatState(user: User, initialChannelId?: string) {
  const [channels, setChannels] = useState<ChatChannel[]>(DEFAULT_CHANNELS)
  const [activeChannelId, setActiveChannelId] = useState<string>(initialChannelId || "general")
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const [inputMessage, setInputMessage] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false)
  const [isMembersOpen, setIsMembersOpen] = useState(false)
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const [isNewDMOpen, setIsNewDMOpen] = useState(false)
  const [dmSearchQuery, setDmSearchQuery] = useState("")
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [startedDmUserIds, setStartedDmUserIds] = useState<string[]>([])

  const [newChannelName, setNewChannelName] = useState("")
  const [newChannelDesc, setNewChannelDesc] = useState("")
  const [newChannelIsPrivate, setNewChannelIsPrivate] = useState(false)
  const [selectedUserEmails, setSelectedUserEmails] = useState<string[]>([])

  const [editChannelName, setEditChannelName] = useState("")
  const [editChannelDesc, setEditChannelDesc] = useState("")
  const [editChannelIsPrivate, setEditChannelIsPrivate] = useState(false)
  const [editChannelCategory, setEditChannelCategory] = useState<"general" | "area" | "proyecto" | "dm">("area")
  const [selectedUserToAdd, setSelectedUserToAdd] = useState<string>("")

  const [channelMembersMap, setChannelMembersMap] = useState<Record<string, string[]>>({})
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})

  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; timestamp: number }>>({})

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const isOnline = (lastSeen?: string | null) => {
    if (!lastSeen) return false
    const diff = new Date().getTime() - new Date(lastSeen).getTime()
    return diff < 5 * 60 * 1000
  }

  const isAdminUser = useMemo(() => {
    return (
      user.role === "admin" ||
      user.role === "admin_general" ||
      user.role === "gerencia" ||
      user.role === "super_admin" ||
      user.email === "gerencia@geofal.com.pe"
    )
  }, [user.role, user.email])

  const canCreateChannel = useMemo(() => {
    return isAdminUser || user.role === "jefe_laboratorio"
  }, [isAdminUser, user.role])

  const activeChannel: ChatChannel = useMemo(() => {
    const found = channels.find((c) => c.id === activeChannelId)
    if (found) return found

    if (activeChannelId.startsWith("dm_") || activeChannelId.startsWith("dm-")) {
      const delimiter = activeChannelId.startsWith("dm_") ? "_" : "-"
      const prefix = activeChannelId.startsWith("dm_") ? "dm_" : "dm-"
      const parts = activeChannelId.replace(prefix, "").split(delimiter)
      const myEmail = (user.email || "").toLowerCase()
      const myId = String(user.id || "")

      const targetUser = teamUsers.find(
        (u) =>
          (parts.includes(u.email.toLowerCase()) || parts.includes(String(u.id))) &&
          u.email.toLowerCase() !== myEmail &&
          String(u.id) !== myId
      )
      const targetName = targetUser
        ? targetUser.name
        : parts.find((p) => p.toLowerCase() !== myEmail && p !== myId) || "Chat Privado"

      return {
        id: activeChannelId,
        name: targetName,
        description: `Chat privado con ${targetName}`,
        isPrivate: true,
        category: "dm",
      }
    }

    return DEFAULT_CHANNELS[0]
  }, [channels, activeChannelId, teamUsers, user.id, user.email])

  const currentMemberEmails = useMemo(() => {
    const fetchedMembers = channelMembersMap[activeChannelId]
    if (fetchedMembers && fetchedMembers.length > 0) {
      return fetchedMembers.map((e) => String(e).toLowerCase())
    }

    if (activeChannelId === "general" || !activeChannel.isPrivate) {
      return teamUsers.map((u) => (u.email || u.id || "").toLowerCase()).filter(Boolean)
    }

    const defaultRolesMap: Record<string, string[]> = {
      ventas: ["admin", "admin_general", "gerencia", "super_admin", "comercial", "auxiliar_comercial"],
      laboratorio: ["admin", "admin_general", "gerencia", "super_admin", "laboratorio", "jefe_laboratorio", "jefe_de_laboratorio", "tecnico", "tecnico_suelos"],
      informes: ["admin", "admin_general", "gerencia", "super_admin", "comercial", "auxiliar_comercial", "laboratorio", "jefe_laboratorio"],
      alertas: ["admin", "admin_general", "gerencia", "super_admin"],
    }

    const allowedRoles = defaultRolesMap[activeChannelId] || ["admin", "admin_general", "gerencia", "super_admin"]

    return teamUsers
      .filter((u) => allowedRoles.includes((u.role || "").toLowerCase()))
      .map((u) => (u.email || u.id || "").toLowerCase())
      .filter(Boolean)
  }, [channelMembersMap, activeChannelId, activeChannel, teamUsers])

  const currentMembers = useMemo(() => {
    const ids = currentMemberEmails.map((e) => String(e).toLowerCase())
    return teamUsers.filter(
      (u) => ids.includes((u.email || "").toLowerCase()) || ids.includes(String(u.id || "").toLowerCase())
    )
  }, [teamUsers, currentMemberEmails])

  const availableUsersToAdd = useMemo(() => {
    const ids = currentMemberEmails.map((e) => String(e).toLowerCase())
    return teamUsers.filter(
      (u) => !ids.includes((u.email || "").toLowerCase()) && !ids.includes(String(u.id || "").toLowerCase())
    )
  }, [teamUsers, currentMemberEmails])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // 1. Escuchar eventos de tipeo en tiempo real
  useEffect(() => {
    const typingChannel = supabase
      .channel(`typing_${activeChannelId}`)
      .on("broadcast", { event: "typing" }, (payload) => {
        const { userId, userName } = payload.payload || {}
        if (userId && userId !== user.id && userId !== user.email) {
          setTypingUsers((prev) => ({
            ...prev,
            [userId]: { name: userName || "Usuario", timestamp: Date.now() },
          }))
        }
      })
      .subscribe()

    const interval = setInterval(() => {
      const now = Date.now()
      setTypingUsers((prev) => {
        const next = { ...prev }
        let changed = false
        for (const [id, data] of Object.entries(next)) {
          if (now - data.timestamp > 3000) {
            delete next[id]
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, 1000)

    return () => {
      supabase.removeChannel(typingChannel)
      clearInterval(interval)
    }
  }, [activeChannelId, user.id, user.email])

  const handleTyping = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    supabase.channel(`typing_${activeChannelId}`).send({
      type: "broadcast",
      event: "typing",
      payload: { userId: user.id || user.email, userName: user.name },
    })

    typingTimeoutRef.current = setTimeout(() => {}, 2500)
  }

  // 2. Escuchar cambios de integrantes en tiempo real
  useEffect(() => {
    const memberChannel = supabase
      .channel(`channel_members_${activeChannelId}`)
      .on("broadcast", { event: "member_change" }, (payload) => {
        const { action, userEmail, channelId } = payload.payload || {}
        if (channelId === activeChannelId) {
          setChannelMembersMap((prev) => {
            const currentList = prev[channelId] || teamUsers.map((u) => u.email)
            if (action === "add") {
              return { ...prev, [channelId]: Array.from(new Set([...currentList, userEmail])) }
            } else if (action === "remove") {
              return { ...prev, [channelId]: currentList.filter((e) => e !== userEmail) }
            }
            return prev
          })
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(memberChannel)
    }
  }, [activeChannelId, teamUsers])

  // Cargar DMs persistidos en localStorage al iniciar
  useEffect(() => {
    if (typeof window === "undefined" || !user.email) return
    try {
      const storageKey = `crm_chat_dms_${user.email.toLowerCase()}`
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setStartedDmUserIds(parsed)
        }
      }
    } catch (err) {
      console.warn("Could not parse saved DMs from localStorage:", err)
    }
  }, [user.email])

  // Persistir DMs en localStorage al modificar la lista
  useEffect(() => {
    if (typeof window === "undefined" || !user.email || startedDmUserIds.length === 0) return
    try {
      const storageKey = `crm_chat_dms_${user.email.toLowerCase()}`
      localStorage.setItem(storageKey, JSON.stringify(startedDmUserIds))
    } catch (err) {
      console.warn("Could not save DMs to localStorage:", err)
    }
  }, [startedDmUserIds, user.email])

  // 3. Cargar canales, usuarios y historial de DMs de la API
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [channelsRes, usersRes, myDmsRes] = await Promise.all([
          authFetch(`${API_URL}/api/chat/channels`),
          authFetch(`${API_URL}/api/chat/users`),
          authFetch(`${API_URL}/api/chat/my-dms`),
        ])

        if (channelsRes.ok) {
          const data = await channelsRes.json()
          if (data.channels && data.channels.length > 0) {
            const apiChannels: ChatChannel[] = data.channels.map((c: any) => ({
              id: c.id,
              name: c.name,
              description: c.description || "",
              isPrivate: Boolean(c.is_private),
              category: c.category || "general",
            }))
            setChannels(apiChannels)
            setActiveChannelId((currentId) => {
              if (currentId.startsWith("dm_") || currentId.startsWith("dm-")) return currentId
              const exists = apiChannels.some((c) => c.id === currentId)
              return exists ? currentId : (apiChannels[0]?.id || "general")
            })
          }
        }

        let fetchedUsers: TeamUser[] = []
        if (usersRes.ok) {
          const data = await usersRes.json()
          if (data.users && data.users.length > 0) {
            fetchedUsers = data.users.map((u: any) => ({
              id: String(u.id),
              name: u.nombre || u.full_name || u.email || "Usuario CRM",
              email: u.email || "",
              role: u.rol || u.role || "usuario",
              avatar: getAvatarUrl(u.avatar_url || u.avatar),
              last_seen_at: u.last_seen_at,
              status: isOnline(u.last_seen_at) ? "online" : "offline",
            }))
            setTeamUsers(fetchedUsers)
          }
        }

        if (myDmsRes.ok) {
          const data = await myDmsRes.json()
          if (Array.isArray(data.dm_user_ids) && data.dm_user_ids.length > 0) {
            const matchedUserIds: string[] = []
            data.dm_user_ids.forEach((identifier: string) => {
              const matched = fetchedUsers.find(
                (u) => u.email.toLowerCase() === identifier.toLowerCase() || String(u.id) === identifier
              )
              if (matched) {
                matchedUserIds.push(matched.id)
              }
            })
            if (matchedUserIds.length > 0) {
              setStartedDmUserIds((prev) => Array.from(new Set([...matchedUserIds, ...prev])))
            }
          }
        }
      } catch (err) {
        console.warn("Could not fetch chat data from API:", err)
      }
    }
    loadInitialData()
  }, [])

  // Send periodic heartbeat every 25 seconds to update last_seen_at for real-time presence
  useEffect(() => {
    const sendHeartbeat = () => {
      try {
        authFetch(`${API_URL}/api/chat/heartbeat`, { method: "POST" })
      } catch {
        // Ignore heartbeat warning
      }
    }
    sendHeartbeat()
    const interval = setInterval(sendHeartbeat, 25000)
    return () => clearInterval(interval)
  }, [])

  // 4. Cargar mensajes del canal activo
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
  }, [activeChannelId, teamUsers])

  // Clear unread counts for active channel (clears "chisme visual" badge)
  useEffect(() => {
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

  // 5. Suscripción GLOBAL Dual-Stream (Postgres Changes + Broadcast instantáneo)
  useEffect(() => {
    console.log("[ChatRealtime Audit] Initializing global dual-stream chat listener for user:", user.email || user.id)

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

      // Si el mensaje pertenece al canal que se está viendo activamente, agregarlo al feed
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
        // Incrementar contador de no leídos para el canal o DM
        setUnreadCounts((prev) => ({
          ...prev,
          [msgChannelId]: (prev[msgChannelId] || 0) + 1,
        }))
      }

      // Notificación sonora si el mensaje proviene de otro usuario
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

    // Escuchar eventos globales de chat emitidos por GlobalChatNotifier
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
  }, [activeChannelId, teamUsers, user.id, user.email, user.name, channels])

  // 6. Cargar integrantes reales del canal desde la base de datos
  useEffect(() => {
    async function fetchMembers() {
      try {
        const res = await authFetch(`${API_URL}/api/chat/channels/${activeChannelId}/members`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.members)) {
            setChannelMembersMap((prev) => ({
              ...prev,
              [activeChannelId]: data.members,
            }))
          }
        }
      } catch (err) {
        console.warn("Could not fetch channel members:", err)
      }
    }
    fetchMembers()
  }, [activeChannelId])

  // Emitir señal de lectura (Double Blue Checks) al entrar al canal y actualizar en DB
  useEffect(() => {
    if (!activeChannelId) return
    try {
      authFetch(`${API_URL}/api/chat/messages/mark-read`, {
        method: "POST",
        body: JSON.stringify({ channel_id: activeChannelId }),
      })
      supabase.channel("chat_global_realtime_stream").send({
        type: "broadcast",
        event: "chat_read_receipt",
        payload: {
          channel_id: activeChannelId,
          reader_id: user.id || user.email,
        },
      })
    } catch (bErr) {
      console.warn("Read receipt broadcast warning:", bErr)
    }
  }, [activeChannelId, user.id, user.email])

  useEffect(() => {
    scrollToBottom()
  }, [messages, activeChannelId])

  useEffect(() => {
    if (isInfoOpen) {
      setEditChannelName(activeChannel.name || "")
      setEditChannelDesc(activeChannel.description || "")
      setEditChannelIsPrivate(Boolean(activeChannel.isPrivate))
      setEditChannelCategory(activeChannel.category || "area")
    }
  }, [isInfoOpen, activeChannel])

  const handleSendMessage = async (attachmentsParam?: any, parentIdParam?: string) => {
    const attachments = Array.isArray(attachmentsParam) ? attachmentsParam : []
    if (!inputMessage.trim() && attachments.length === 0) return

    const tempMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      channelId: activeChannelId,
      senderId: user.id || user.email,
      senderName: user.name,
      senderAvatar: user.avatar,
      content: inputMessage.trim(),
      attachments,
      parent_id: parentIdParam,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, tempMessage])
    const currentText = inputMessage.trim()
    setInputMessage("")
    setTimeout(scrollToBottom, 50)

    // Broadcast instantáneo por WebSocket a todos los clientes conectados (<10ms)
    try {
      supabase.channel("chat_global_realtime_stream").send({
        type: "broadcast",
        event: "chat_message_broadcast",
        payload: {
          id: tempMessage.id,
          channel_id: activeChannelId,
          sender_id: tempMessage.senderId,
          sender_name: tempMessage.senderName,
          sender_avatar: tempMessage.senderAvatar,
          content: tempMessage.content,
          attachments,
          parent_id: parentIdParam,
          created_at: tempMessage.createdAt,
        },
      })
    } catch (bErr) {
      console.warn("Broadcast send warning:", bErr)
    }

    try {
      await authFetch(`${API_URL}/api/chat/messages`, {
        method: "POST",
        body: JSON.stringify({
          id: tempMessage.id,
          channel_id: activeChannelId,
          content: currentText,
          attachments,
          parent_id: parentIdParam,
        }),
      })
    } catch (err) {
      console.warn("Error sending chat message:", err)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isImage = file.type.startsWith("image/")
    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      const attachment = {
        name: file.name,
        url: dataUrl,
        type: isImage ? "image" : "document",
      }
      handleSendMessage([attachment])
      toast.success(`Archivo "${file.name}" adjuntado al chat`)
    }
    reader.readAsDataURL(file)
  }

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) {
      toast.error("Ingresa un nombre válido para el canal")
      return
    }

    const formattedName = newChannelName.toLowerCase().replace(/\s+/g, "-")

    try {
      const res = await authFetch(`${API_URL}/api/chat/channels`, {
        method: "POST",
        body: JSON.stringify({
          name: formattedName,
          description: newChannelDesc,
          is_private: newChannelIsPrivate,
          allowed_roles: [],
          allowed_emails: selectedUserEmails,
          category: "area",
        }),
      })

      if (res.ok) {
        const data = await res.json()
        const created = data.channel || {
          id: `ch-${Date.now()}`,
          name: formattedName,
          description: newChannelDesc,
          is_private: newChannelIsPrivate,
          category: "area",
        }

        const newChannel: ChatChannel = {
          id: created.id,
          name: created.name,
          description: created.description,
          isPrivate: Boolean(created.is_private),
          category: created.category || "area",
        }

        setChannels((prev) => [...prev, newChannel])
        setActiveChannelId(newChannel.id)
        setIsCreateChannelOpen(false)
        setNewChannelName("")
        setNewChannelDesc("")
        setNewChannelIsPrivate(false)
        setSelectedUserEmails([])
        toast.success("Canal creado con éxito", { description: `#${formattedName}` })
      } else {
        const errData = await res.json().catch(() => ({}))
        toast.error(errData.detail || "Error al crear canal")
      }
    } catch (err) {
      console.warn("Failed to create channel via API:", err)
      toast.error("Error al conectar con el servidor para crear canal")
    }
  }

  const handleAddMemberToChannel = async () => {
    if (!selectedUserToAdd) return

    const selectedUser = teamUsers.find((u) => u.id === selectedUserToAdd || u.email === selectedUserToAdd)
    const targetEmail = selectedUser ? selectedUser.email : selectedUserToAdd

    setChannelMembersMap((prev) => {
      const currentList = prev[activeChannelId] || teamUsers.map((u) => u.email)
      return { ...prev, [activeChannelId]: Array.from(new Set([...currentList, targetEmail])) }
    })
    setSelectedUserToAdd("")
    toast.success(`Se añadió a ${selectedUser ? selectedUser.name : targetEmail} al grupo #${activeChannel.name}`)

    supabase.channel(`channel_members_${activeChannelId}`).send({
      type: "broadcast",
      event: "member_change",
      payload: { action: "add", userEmail: targetEmail, channelId: activeChannelId },
    })

    try {
      await authFetch(`${API_URL}/api/chat/channels/${activeChannelId}/members`, {
        method: "POST",
        body: JSON.stringify({
          user_id: selectedUser?.id || selectedUserToAdd,
          user_email: targetEmail,
        }),
      })
    } catch (err) {
      console.warn("Failed to add member:", err)
    }
  }

  const handleRemoveMemberFromChannel = async (member: TeamUser) => {
    setChannelMembersMap((prev) => {
      const currentList = prev[activeChannelId] || teamUsers.map((u) => u.email)
      return { ...prev, [activeChannelId]: currentList.filter((e) => e !== member.email && e !== member.id) }
    })
    toast.success(`Se retiró a ${member.name} del grupo #${activeChannel.name}`)

    supabase.channel(`channel_members_${activeChannelId}`).send({
      type: "broadcast",
      event: "member_change",
      payload: { action: "remove", userEmail: member.email, channelId: activeChannelId },
    })

    try {
      await authFetch(`${API_URL}/api/chat/channels/${activeChannelId}/members/${encodeURIComponent(member.email)}`, {
        method: "DELETE",
      })
    } catch (err) {
      console.warn("Failed to remove member:", err)
    }
  }

  const handleUpdateChannelInfo = async () => {
    if (!editChannelName.trim()) {
      toast.error("Ingresa un nombre válido para el canal")
      return
    }

    const formattedName = editChannelName.toLowerCase().replace(/\s+/g, "-")

    try {
      await authFetch(`${API_URL}/api/chat/channels/${activeChannelId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: formattedName,
          description: editChannelDesc,
          is_private: editChannelIsPrivate,
          category: editChannelCategory,
        }),
      })
    } catch (err) {
      console.warn("Update channel error:", err)
    }

    setChannels((prev) =>
      prev.map((c) =>
        c.id === activeChannelId
          ? {
              ...c,
              name: formattedName,
              description: editChannelDesc,
              isPrivate: editChannelIsPrivate,
              category: editChannelCategory,
            }
          : c
      )
    )

    toast.success("Información del canal actualizada con éxito")
    setIsInfoOpen(false)
  }

  const handleToggleChannelPrivacy = async (newIsPrivate: boolean) => {
    try {
      const res = await authFetch(`${API_URL}/api/chat/channels/${activeChannelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_private: newIsPrivate }),
      })
      if (res.ok) {
        toast.success(`Canal cambiado a ${newIsPrivate ? "Privado" : "Público"}`)
        setChannels((prev) =>
          prev.map((c) => (c.id === activeChannelId ? { ...c, isPrivate: newIsPrivate } : c))
        )
      } else {
        const errData = await res.json().catch(() => ({}))
        toast.error(errData.detail || "Error al cambiar la privacidad del canal")
      }
    } catch (err) {
      console.warn("Failed to update channel privacy:", err)
      toast.error("Error de conexión al cambiar la privacidad")
    }
  }

  const handleDeleteChannel = async () => {
    if (activeChannelId === "general" || activeChannelId === "laboratorio") {
      toast.error("Los canales principales no pueden ser eliminados")
      return
    }

    try {
      await authFetch(`${API_URL}/api/chat/channels/${activeChannelId}`, {
        method: "DELETE",
      })
    } catch (err) {
      console.warn("Delete channel error:", err)
    }

    setChannels((prev) => prev.filter((c) => c.id !== activeChannelId))
    setActiveChannelId("general")
    setIsInfoOpen(false)
    toast.success(`Canal #${activeChannel.name} eliminado con éxito`)
  }

  const handleOpenDM = (targetUser: TeamUser) => {
    const isComercialUser = user.role === "comercial" || user.role === "auxiliar_comercial"
    const isLabTarget = targetUser.role === "jefe_laboratorio" || targetUser.role === "tecnico" || targetUser.role === "laboratorio"
    const isBlocked = !isAdminUser && isComercialUser && isLabTarget

    if (isBlocked) {
      toast.warning("Restricción de Gobernanza CRM", {
        description: "Los mensajes directos entre Comercial y Laboratorio están restringidos. Coordinar en Canales de Proyecto.",
      })
      return
    }

    const dmId = getCanonicalDmId(user, targetUser)
    console.log(`[ChatDM Audit] Opening DM between ${user.email} and ${targetUser.email} -> canonical dmId: ${dmId}`)
    setStartedDmUserIds((prev) => (prev.includes(targetUser.id) ? [targetUser.id, ...prev.filter((id) => id !== targetUser.id)] : [targetUser.id, ...prev]))
    setUnreadCounts((prev) => {
      if (!prev[dmId]) return prev
      const next = { ...prev }
      delete next[dmId]
      return next
    })
    setActiveChannelId(dmId)
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
    channels,
    activeChannelId,
    setActiveChannelId,
    teamUsers,
    messages,
    activeMessages,
    inputMessage,
    setInputMessage,
    searchQuery,
    setSearchQuery,
    isCreateChannelOpen,
    setIsCreateChannelOpen,
    isMembersOpen,
    setIsMembersOpen,
    isInfoOpen,
    setIsInfoOpen,
    isNewDMOpen,
    setIsNewDMOpen,
    dmSearchQuery,
    setDmSearchQuery,
    isLoadingMessages,
    startedDmUserIds,
    newChannelName,
    setNewChannelName,
    newChannelDesc,
    setNewChannelDesc,
    newChannelIsPrivate,
    setNewChannelIsPrivate,
    selectedUserEmails,
    setSelectedUserEmails,
    editChannelName,
    setEditChannelName,
    editChannelDesc,
    setEditChannelDesc,
    editChannelIsPrivate,
    setEditChannelIsPrivate,
    editChannelCategory,
    setEditChannelCategory,
    selectedUserToAdd,
    setSelectedUserToAdd,
    unreadCounts,
    selectedImage,
    setSelectedImage,
    typingUsers,
    messagesEndRef,
    isAdminUser,
    canCreateChannel,
    activeChannel,
    currentMembers,
    availableUsersToAdd,
    handleSendMessage,
    handleFileUpload,
    handleTyping,
    handleCreateChannel,
    handleAddMemberToChannel,
    handleRemoveMemberFromChannel,
    handleUpdateChannelInfo,
    handleToggleChannelPrivacy,
    handleDeleteChannel,
    handleOpenDM,
    toggleReaction,
  }
}
