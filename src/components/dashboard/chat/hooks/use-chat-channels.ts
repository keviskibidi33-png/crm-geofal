"use client"

import { useState, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { type User } from "@/hooks/use-auth"
import { authFetch } from "@/lib/api-auth"
import {
  type ChatChannel,
  type TeamUser,
  DEFAULT_CHANNELS,
  getCanonicalDmId,
  getAvatarUrl,
} from "../types"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.geofal.com.pe"

export function useChatChannels(user: User, initialChannelId?: string) {
  const [channels, setChannels] = useState<ChatChannel[]>(DEFAULT_CHANNELS)
  const [activeChannelId, setActiveChannelId] = useState<string>(initialChannelId || "general")
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([])

  const [searchQuery, setSearchQuery] = useState("")
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false)
  const [isMembersOpen, setIsMembersOpen] = useState(false)
  const [isInfoOpen, setIsInfoOpen] = useState(false)
  const [isNewDMOpen, setIsNewDMOpen] = useState(false)
  const [dmSearchQuery, setDmSearchQuery] = useState("")
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

  // 1. Cargar canales desde el servidor
  useEffect(() => {
    async function fetchChannels() {
      try {
        const res = await authFetch(`${API_URL}/api/chat/channels`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.channels) && data.channels.length > 0) {
            const mapped: ChatChannel[] = data.channels.map((c: any) => ({
              id: c.id,
              name: c.name,
              description: c.description || "",
              isPrivate: Boolean(c.is_private),
              createdBy: c.created_by,
              category: c.category || "general",
              allowedRoles: c.allowed_roles || [],
              allowedEmails: c.allowed_emails || [],
            }))
            setChannels(mapped)
          }
        }
      } catch (err) {
        console.warn("Error fetching channels:", err)
      }
    }
    fetchChannels()
  }, [])

  // 2. Cargar usuarios del equipo
  useEffect(() => {
    async function fetchTeamUsers() {
      try {
        const res = await authFetch(`${API_URL}/api/chat/team-users`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.users)) {
            const mapped: TeamUser[] = data.users.map((u: any) => ({
              id: u.id,
              name: u.full_name || u.nombre || u.email,
              email: u.email,
              role: u.rol || u.role || "Usuario",
              avatar: getAvatarUrl(u.avatar_url),
              status: isOnline(u.last_seen) ? "online" : "offline",
              lastSeen: u.last_seen,
            }))
            setTeamUsers(mapped)
          }
        }
      } catch (err) {
        console.warn("Error fetching team users:", err)
      }
    }
    fetchTeamUsers()
  }, [])

  // 3. Cargar conversaciones privadas (DMs) existentes
  useEffect(() => {
    async function fetchMyDms() {
      if (!user.email && !user.id) return
      try {
        const res = await authFetch(`${API_URL}/api/chat/my-dms`)
        if (res.ok) {
          const data = await res.json()
          if (Array.isArray(data.dms)) {
            const fetchedUsers = teamUsers.length > 0 ? teamUsers : []
            const matchedUserIds: string[] = []
            data.dms.forEach((dm: any) => {
              const matched = fetchedUsers.find(
                (u) =>
                  u.email.toLowerCase() === String(dm.other_user_email || "").toLowerCase() ||
                  String(u.id) === String(dm.other_user_id)
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
        console.warn("Error fetching my DMs:", err)
      }
    }
    fetchMyDms()
  }, [user.email, user.id, teamUsers])

  // 4. Cargar miembros del canal activo desde backend
  useEffect(() => {
    async function fetchChannelMembers() {
      if (!activeChannelId || activeChannelId.startsWith("dm_") || activeChannelId.startsWith("dm-")) return
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
        console.warn("Error fetching channel members:", err)
      }
    }
    fetchChannelMembers()
  }, [activeChannelId])

  // Sincronizar estado de edición de canal
  useEffect(() => {
    if (activeChannel) {
      setEditChannelName(activeChannel.name)
      setEditChannelDesc(activeChannel.description || "")
      setEditChannelIsPrivate(activeChannel.isPrivate || false)
      setEditChannelCategory(activeChannel.category || "area")
    }
  }, [activeChannel])

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) return
    const id = `ch-${newChannelName.toLowerCase().replace(/\s+/g, "-")}`
    const newChan: ChatChannel = {
      id,
      name: newChannelName.trim(),
      description: newChannelDesc.trim(),
      isPrivate: newChannelIsPrivate,
      category: "area",
      allowedEmails: selectedUserEmails,
    }

    try {
      const res = await authFetch(`${API_URL}/api/chat/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: newChannelName.trim(),
          description: newChannelDesc.trim(),
          is_private: newChannelIsPrivate,
          category: "area",
          allowed_emails: selectedUserEmails,
        }),
      })

      if (res.ok) {
        setChannels((prev) => [...prev, newChan])
        setActiveChannelId(id)
        setNewChannelName("")
        setNewChannelDesc("")
        setNewChannelIsPrivate(false)
        setSelectedUserEmails([])
        setIsCreateChannelOpen(false)
        toast.success(`Canal #${newChan.name} creado con éxito`)
      } else {
        const errData = await res.json()
        toast.error(errData.detail || "Error al crear el canal")
      }
    } catch (err) {
      console.warn("Error creating channel:", err)
      toast.error("Error al conectar con el servidor para crear el canal")
    }
  }

  const handleAddMemberToChannel = async (userEmailOrId?: string) => {
    const targetEmail = userEmailOrId || selectedUserToAdd
    if (!targetEmail || !activeChannelId) return

    try {
      const res = await authFetch(`${API_URL}/api/chat/channels/${activeChannelId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_email_or_id: targetEmail }),
      })

      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.members)) {
          setChannelMembersMap((prev) => ({
            ...prev,
            [activeChannelId]: data.members,
          }))
        }
        setSelectedUserToAdd("")
        toast.success("Miembro agregado al canal correctamente")
      } else {
        const errData = await res.json()
        toast.error(errData.detail || "Error al agregar miembro")
      }
    } catch (err) {
      console.warn("Error adding member:", err)
      toast.error("Error al agregar integrante al canal")
    }
  }

  const handleRemoveMemberFromChannel = async (member: TeamUser) => {
    if (!activeChannelId) return
    const target = member.email || member.id
    try {
      const res = await authFetch(`${API_URL}/api/chat/channels/${activeChannelId}/members/${encodeURIComponent(target)}`, {
        method: "DELETE",
      })

      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.members)) {
          setChannelMembersMap((prev) => ({
            ...prev,
            [activeChannelId]: data.members,
          }))
        }
        toast.success(`Miembro ${member.name} removido del canal`)
      } else {
        const errData = await res.json()
        toast.error(errData.detail || "Error al remover miembro")
      }
    } catch (err) {
      console.warn("Error removing member:", err)
      toast.error("Error al remover integrante")
    }
  }

  const handleUpdateChannelInfo = async () => {
    if (!activeChannelId || activeChannelId === "general") return
    try {
      const res = await authFetch(`${API_URL}/api/chat/channels/${activeChannelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editChannelName.trim(),
          description: editChannelDesc.trim(),
          is_private: editChannelIsPrivate,
          category: editChannelCategory,
        }),
      })

      if (res.ok) {
        setChannels((prev) =>
          prev.map((c) =>
            c.id === activeChannelId
              ? {
                  ...c,
                  name: editChannelName.trim(),
                  description: editChannelDesc.trim(),
                  isPrivate: editChannelIsPrivate,
                  category: editChannelCategory,
                }
              : c
          )
        )
        toast.success("Información del canal actualizada")
      } else {
        const errData = await res.json()
        toast.error(errData.detail || "Error al actualizar información del canal")
      }
    } catch (err) {
      console.warn("Error updating channel info:", err)
      toast.error("Error al actualizar canal")
    }
  }

  const handleToggleChannelPrivacy = async (isPrivate: boolean) => {
    if (!activeChannelId || activeChannelId === "general") return
    try {
      const res = await authFetch(`${API_URL}/api/chat/channels/${activeChannelId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_private: isPrivate }),
      })

      if (res.ok) {
        setChannels((prev) =>
          prev.map((c) => (c.id === activeChannelId ? { ...c, isPrivate } : c))
        )
        setEditChannelIsPrivate(isPrivate)
        toast.success(isPrivate ? "Canal marcado como privado" : "Canal marcado como público")
      } else {
        const errData = await res.json()
        toast.error(errData.detail || "Error al cambiar privacidad del canal")
      }
    } catch (err) {
      console.warn("Error toggling channel privacy:", err)
    }
  }

  const handleDeleteChannel = async (setIsInfoOpen?: (open: boolean) => void) => {
    if (!activeChannelId || activeChannelId === "general") return
    try {
      const res = await authFetch(`${API_URL}/api/chat/channels/${activeChannelId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        setChannels((prev) => prev.filter((c) => c.id !== activeChannelId))
        setActiveChannelId("general")
        if (setIsInfoOpen) setIsInfoOpen(false)
        toast.success("Canal eliminado")
      } else {
        const errData = await res.json()
        toast.error(errData.detail || "Error al eliminar canal")
      }
    } catch (err) {
      console.warn("Error deleting channel:", err)
      toast.error("Error al eliminar canal")
    }
  }

  const handleOpenDM = (targetUser: TeamUser) => {
    const dmId = getCanonicalDmId(
      { id: String(user.id || ""), email: user.email || "" },
      { id: String(targetUser.id || ""), email: targetUser.email || "" }
    )
    if (!startedDmUserIds.includes(targetUser.id)) {
      setStartedDmUserIds((prev) => [...prev, targetUser.id])
    }
    setActiveChannelId(dmId)
  }

  return {
    channels,
    setChannels,
    activeChannelId,
    setActiveChannelId,
    teamUsers,
    setTeamUsers,
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
    startedDmUserIds,
    setStartedDmUserIds,
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
    channelMembersMap,
    isAdminUser,
    canCreateChannel,
    activeChannel,
    currentMembers,
    availableUsersToAdd,
    handleCreateChannel,
    handleAddMemberToChannel,
    handleRemoveMemberFromChannel,
    handleUpdateChannelInfo,
    handleToggleChannelPrivacy,
    handleDeleteChannel,
    handleOpenDM,
  }
}
