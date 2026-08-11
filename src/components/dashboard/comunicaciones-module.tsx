"use client"

import React, { useState, useEffect, useRef, useMemo } from "react"
import { toast } from "sonner"
import { type User } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabaseClient"
import { authFetch } from "@/lib/api-auth"
import {
  type ChatChannel,
  type ChatMessage,
  type TeamUser,
  type ComunicacionesModuleProps,
  DEFAULT_CHANNELS,
  getCanonicalDmId,
} from "./chat/types"
import { ChatSidebar } from "./chat/chat-sidebar"
import { ChatFeed } from "./chat/chat-feed"
import { CreateChannelDialog } from "./chat/dialogs/create-channel-dialog"
import { ChannelMembersDialog } from "./chat/dialogs/channel-members-dialog"
import { ChannelInfoDialog } from "./chat/dialogs/channel-info-dialog"
import { NewDmDialog } from "./chat/dialogs/new-dm-dialog"
import { ImageLightbox } from "./chat/dialogs/image-lightbox"

export function ComunicacionesModule({ user, initialChannelId }: ComunicacionesModuleProps) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

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
  const [editChannelName, setEditChannelName] = useState("")
  const [editChannelDesc, setEditChannelDesc] = useState("")
  const [editChannelIsPrivate, setEditChannelIsPrivate] = useState(false)
  const [editChannelCategory, setEditChannelCategory] = useState<"general" | "area" | "proyecto" | "dm">("area")
  const [newChannelDesc, setNewChannelDesc] = useState("")
  const [newChannelIsPrivate, setNewChannelIsPrivate] = useState(false)
  const [selectedUserEmails, setSelectedUserEmails] = useState<string[]>([])
  const [startedDmUserIds, setStartedDmUserIds] = useState<string[]>([])
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

  // Memorizaciones iniciales ordenadas
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
    if (channelMembersMap[activeChannelId]) {
      return channelMembersMap[activeChannelId]
    }
    return teamUsers.map((u) => u.email)
  }, [channelMembersMap, activeChannelId, teamUsers])

  const currentMembers = useMemo(() => {
    return teamUsers.filter((u) => currentMemberEmails.includes(u.email) || currentMemberEmails.includes(u.id))
  }, [teamUsers, currentMemberEmails])

  const availableUsersToAdd = useMemo(() => {
    return teamUsers.filter((u) => !currentMemberEmails.includes(u.email) && !currentMemberEmails.includes(u.id))
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

  // 3. Cargar canales y usuarios de la API
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [channelsRes, usersRes] = await Promise.all([
          authFetch(`${API_URL}/api/chat/channels`),
          authFetch(`${API_URL}/api/chat/users`),
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
          }
        }

        if (usersRes.ok) {
          const data = await usersRes.json()
          if (data.users && data.users.length > 0) {
            const apiUsers: TeamUser[] = data.users.map((u: any) => ({
              id: String(u.id),
              name: u.nombre || u.full_name || u.email || "Usuario CRM",
              email: u.email || "",
              role: u.rol || u.role || "usuario",
              avatar: u.avatar_url,
              last_seen_at: u.last_seen_at,
              status: isOnline(u.last_seen_at) ? "online" : "offline",
            }))
            setTeamUsers(apiUsers)
          }
        }
      } catch (err) {
        console.warn("Could not fetch chat data from API:", err)
      }
    }
    loadInitialData()
  }, [])

  // 4. Cargar mensajes del canal activo
  useEffect(() => {
    async function fetchChannelMessages() {
      setIsLoadingMessages(true)
      try {
        const res = await authFetch(`${API_URL}/api/chat/messages/${activeChannelId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.messages) {
            const loadedMessages: ChatMessage[] = data.messages.map((m: any) => ({
              id: m.id,
              channelId: m.channel_id,
              senderId: m.sender_id,
              senderName: m.sender_name || "Usuario",
              senderAvatar: m.sender_avatar,
              content: m.content,
              attachments: m.attachments || [],
              createdAt: m.created_at,
            }))
            setMessages(loadedMessages)
          }
        }
      } catch (err) {
        console.warn("Error fetching channel messages:", err)
      } finally {
        setIsLoadingMessages(false)
      }
    }

    fetchChannelMessages()
  }, [activeChannelId])

  // Clear unread counts for active channel
  useEffect(() => {
    setUnreadCounts((prev) => {
      if (!prev[activeChannelId]) return prev
      const next = { ...prev }
      delete next[activeChannelId]
      return next
    })
  }, [activeChannelId])

  // 5. Suscripción GLOBAL a mensajes en tiempo real vía Supabase para notificaciones y DMs automáticos
  useEffect(() => {
    console.log("[ChatRealtime Audit] Initializing global chat stream listener for user:", user.email || user.id)

    const globalChatChannel = supabase
      .channel("chat_global_realtime_stream")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          const newMsg = payload.new as any
          if (!newMsg) return

          const msgChannelId = String(newMsg.channel_id || "")
          console.log(`[ChatRealtime Audit] Received message INSERT:`, {
            id: newMsg.id,
            channel_id: msgChannelId,
            sender_id: newMsg.sender_id,
            sender_name: newMsg.sender_name,
            content: newMsg.content,
          })

          const myEmail = (user.email || "").toLowerCase()
          const myId = String(user.id || "")

          // Si es un mensaje DM (dm_ o dm-)
          if (msgChannelId.startsWith("dm_") || msgChannelId.startsWith("dm-")) {
            const delimiter = msgChannelId.startsWith("dm_") ? "_" : "-"
            const prefix = msgChannelId.startsWith("dm_") ? "dm_" : "dm-"
            const parts = msgChannelId.replace(prefix, "").split(delimiter).map((p) => p.toLowerCase())
            const isUserInDm = parts.includes(myEmail) || parts.includes(myId)

            console.log(`[ChatRealtime Audit] DM match evaluation:`, {
              msgChannelId,
              parts,
              myEmail,
              myId,
              isUserInDm,
            })

            if (isUserInDm) {
              const otherUser = teamUsers.find(
                (u) =>
                  parts.includes(u.email.toLowerCase()) &&
                  u.email.toLowerCase() !== myEmail &&
                  String(u.id) !== myId
              )
              const senderUser = teamUsers.find(
                (u) =>
                  u.email.toLowerCase() === String(newMsg.sender_id || "").toLowerCase() ||
                  u.email.toLowerCase() === String(newMsg.sender_name || "").toLowerCase() ||
                  String(u.id) === String(newMsg.sender_id)
              )

              const targetUserId = otherUser?.id || senderUser?.id
              if (targetUserId) {
                console.log(`[ChatRealtime Audit] Adding targetUserId to startedDmUserIds:`, targetUserId)
                setStartedDmUserIds((prev) => (prev.includes(targetUserId) ? prev : [...prev, targetUserId]))
              }
            }
          }

          // Si el mensaje pertenece al canal que se está viendo activamente, agregarlo al feed
          if (msgChannelId === activeChannelId) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) return prev
              return [
                ...prev,
                {
                  id: newMsg.id,
                  channelId: newMsg.channel_id,
                  senderId: newMsg.sender_id,
                  senderName: newMsg.sender_name || "Usuario CRM",
                  senderAvatar: newMsg.sender_avatar,
                  content: newMsg.content,
                  attachments: newMsg.attachments || [],
                  createdAt: newMsg.created_at,
                },
              ]
            })
            setTimeout(scrollToBottom, 60)
          } else {
            // Incrementar contador de no leídos para el canal o DM
            setUnreadCounts((prev) => ({
              ...prev,
              [msgChannelId]: (prev[msgChannelId] || 0) + 1,
            }))
          }

          // Notificación sonora y campanita si el mensaje proviene de otro usuario
          const isFromOther =
            newMsg.sender_id !== user.id &&
            newMsg.sender_id !== user.email &&
            newMsg.sender_name !== user.name &&
            newMsg.sender_name !== user.email

          if (isFromOther) {
            console.log(`[ChatRealtime Audit] Dispatching crm_chat_notification event for sender:`, newMsg.sender_name)
            window.dispatchEvent(
              new CustomEvent("crm_chat_notification", {
                detail: {
                  senderName: newMsg.sender_name || "Usuario CRM",
                  content: newMsg.content,
                  channelName: (msgChannelId.startsWith("dm_") || msgChannelId.startsWith("dm-")) ? "Chat Privado" : msgChannelId,
                  senderAvatar: newMsg.sender_avatar,
                },
              })
            )
          }
        }
      )
      .subscribe((status) => {
        console.log(`[ChatRealtime Audit] Supabase Subscription Status for global stream:`, status)
      })

    return () => {
      supabase.removeChannel(globalChatChannel)
    }
  }, [activeChannelId, teamUsers, user.id, user.email, user.name])

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

  useEffect(() => {
    scrollToBottom()
  }, [messages, activeChannelId])

  // Sincronizar formulario de edición cuando cambia el canal activo
  useEffect(() => {
    if (activeChannel) {
      setEditChannelName(activeChannel.name)
      setEditChannelDesc(activeChannel.description || "")
      setEditChannelIsPrivate(activeChannel.isPrivate)
      setEditChannelCategory(activeChannel.category || "area")
    }
  }, [activeChannelId, activeChannel])

  // Handlers de envio, adjuntos, canales y miembros
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return

    const textToSend = inputMessage.trim()
    setInputMessage("")

    const tempMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      channelId: activeChannelId,
      senderId: user.id,
      senderName: user.name || "Usuario CRM",
      senderAvatar: user.avatar,
      content: textToSend,
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, tempMessage])

    try {
      await authFetch(`${API_URL}/api/chat/messages`, {
        method: "POST",
        body: JSON.stringify({
          channel_id: activeChannelId,
          content: textToSend,
        }),
      })
    } catch (err) {
      console.warn("Failed to send message to API:", err)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isImage = file.type.startsWith("image/")
    const attachmentObj = {
      url: URL.createObjectURL(file),
      type: isImage ? ("image" as const) : ("file" as const),
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
    }

    const contentText = isImage ? `📷 Imagen adjunta: ${file.name}` : `📎 Archivo adjunto: ${file.name}`

    const tempMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      channelId: activeChannelId,
      senderId: user.id,
      senderName: user.name || "Usuario CRM",
      senderAvatar: user.avatar,
      content: contentText,
      attachments: [attachmentObj],
      createdAt: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, tempMessage])

    try {
      await authFetch(`${API_URL}/api/chat/messages`, {
        method: "POST",
        body: JSON.stringify({
          channel_id: activeChannelId,
          content: contentText,
          attachments: [attachmentObj],
        }),
      })
      toast.success("Archivo enviado en el chat", { description: file.name })
    } catch (err) {
      console.warn("Error uploading chat file attachment:", err)
    }
  }

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) {
      toast.error("Ingresa un nombre para el canal")
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
        toast.error("Error al crear el canal", { description: errData.detail || "Permisos insuficientes" })
      }
    } catch (err) {
      console.warn("Failed to create chat channel:", err)
    }
  }

  const handleAddMemberToChannel = async () => {
    if (!selectedUserToAdd) {
      toast.error("Selecciona un integrante para añadir")
      return
    }
    const selectedUser = teamUsers.find((u) => u.email === selectedUserToAdd || u.id === selectedUserToAdd)
    const targetEmail = selectedUser?.email || selectedUserToAdd

    setChannelMembersMap((prev) => {
      const currentList = prev[activeChannelId] || teamUsers.map((u) => u.email)
      return { ...prev, [activeChannelId]: Array.from(new Set([...currentList, targetEmail])) }
    })
    setSelectedUserToAdd("")
    toast.success(`Integrante ${selectedUser?.name || targetEmail} añadido al grupo #${activeChannel.name}`)

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

  const activeMessages = messages.filter((m) => m.channelId === activeChannelId)

  return (
    <div className="flex h-full w-full overflow-hidden bg-background text-foreground">
      {/* ── COLUMNA IZQUIERDA: Barra Lateral ── */}
      <ChatSidebar
        user={user}
        channels={channels}
        activeChannelId={activeChannelId}
        setActiveChannelId={setActiveChannelId}
        teamUsers={teamUsers}
        startedDmUserIds={startedDmUserIds}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        canCreateChannel={canCreateChannel}
        isAdminUser={isAdminUser}
        setIsCreateChannelOpen={setIsCreateChannelOpen}
        setIsNewDMOpen={setIsNewDMOpen}
        handleOpenDM={handleOpenDM}
        unreadCounts={unreadCounts}
      />

      {/* ── COLUMNA CENTRAL: Feed de Mensajes ── */}
      <ChatFeed
        user={user}
        activeChannel={activeChannel}
        activeMessages={activeMessages}
        isLoadingMessages={isLoadingMessages}
        inputMessage={inputMessage}
        setInputMessage={setInputMessage}
        handleSendMessage={handleSendMessage}
        handleFileUpload={handleFileUpload}
        handleTyping={handleTyping}
        typingUsers={typingUsers}
        setIsMembersOpen={setIsMembersOpen}
        setIsInfoOpen={setIsInfoOpen}
        setSelectedImage={setSelectedImage}
        messagesEndRef={messagesEndRef}
      />

      {/* ── MODALES Y DIÁLOGOS ── */}
      <CreateChannelDialog
        isOpen={isCreateChannelOpen}
        onOpenChange={setIsCreateChannelOpen}
        newChannelName={newChannelName}
        setNewChannelName={setNewChannelName}
        newChannelDesc={newChannelDesc}
        setNewChannelDesc={setNewChannelDesc}
        newChannelIsPrivate={newChannelIsPrivate}
        setNewChannelIsPrivate={setNewChannelIsPrivate}
        selectedUserEmails={selectedUserEmails}
        setSelectedUserEmails={setSelectedUserEmails}
        teamUsers={teamUsers}
        handleCreateChannel={handleCreateChannel}
      />

      <ChannelMembersDialog
        isOpen={isMembersOpen}
        onOpenChange={setIsMembersOpen}
        activeChannel={activeChannel}
        canCreateChannel={canCreateChannel}
        selectedUserToAdd={selectedUserToAdd}
        setSelectedUserToAdd={setSelectedUserToAdd}
        availableUsersToAdd={availableUsersToAdd}
        currentMembers={currentMembers}
        handleAddMemberToChannel={handleAddMemberToChannel}
        handleRemoveMemberFromChannel={handleRemoveMemberFromChannel}
      />

      <ChannelInfoDialog
        isOpen={isInfoOpen}
        onOpenChange={setIsInfoOpen}
        activeChannel={activeChannel}
        activeChannelId={activeChannelId}
        canCreateChannel={canCreateChannel}
        editChannelName={editChannelName}
        setEditChannelName={setEditChannelName}
        editChannelDesc={editChannelDesc}
        setEditChannelDesc={setEditChannelDesc}
        editChannelCategory={editChannelCategory}
        setEditChannelCategory={setEditChannelCategory}
        editChannelIsPrivate={editChannelIsPrivate}
        setEditChannelIsPrivate={setEditChannelIsPrivate}
        handleUpdateChannelInfo={handleUpdateChannelInfo}
        handleDeleteChannel={handleDeleteChannel}
      />

      <NewDmDialog
        isOpen={isNewDMOpen}
        onOpenChange={setIsNewDMOpen}
        user={user}
        teamUsers={teamUsers}
        dmSearchQuery={dmSearchQuery}
        setDmSearchQuery={setDmSearchQuery}
        isAdminUser={isAdminUser}
        handleOpenDM={handleOpenDM}
      />

      <ImageLightbox
        selectedImage={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  )
}
