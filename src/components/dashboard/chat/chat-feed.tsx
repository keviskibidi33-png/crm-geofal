/* eslint-disable @next/next/no-img-element */
"use client"

import React, { useState, useEffect, useMemo, RefObject } from "react"
import {
  Hash,
  Lock,
  Users,
  Info,
  Loader2,
  MessageSquareDashed,
  Paperclip,
  Image as ImageIcon,
  Send,
  FileText,
  Download,
  CheckCheck,
  Pin,
  Reply,
  Smile,
  X,
  CornerDownRight,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { type User } from "@/hooks/use-auth"
import { type ChatChannel, type ChatMessage, type TeamUser, getAvatarUrl } from "./types"
import { UserProfilePopover } from "./dialogs/user-profile-popover"
import { ChatDetailsSidebar } from "./chat-details-sidebar"
import { toast } from "sonner"

interface ChatFeedProps {
  user: User
  activeChannel: ChatChannel
  activeMessages: ChatMessage[]
  isLoadingMessages: boolean
  inputMessage: string
  setInputMessage: (val: string) => void
  handleSendMessage: (attachmentsParam?: any, parentIdParam?: string) => void
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleTyping: () => void
  typingUsers: Record<string, { name: string; timestamp: number }>
  setIsMembersOpen?: (open: boolean) => void
  isInfoOpen?: boolean
  setIsInfoOpen: (open: boolean) => void
  setSelectedImage: (url: string | null) => void
  messagesEndRef: RefObject<HTMLDivElement | null>
  handleOpenDM?: (targetUser: TeamUser) => void
  teamUsers?: TeamUser[]
  currentMembers?: TeamUser[]
  availableUsersToAdd?: TeamUser[]
  onAddMember?: (userEmailOrId: string) => void
  onRemoveMember?: (member: TeamUser) => void
  onTogglePrivacy?: (isPrivate: boolean) => void
  isAdminUser?: boolean
  toggleReaction?: (msgId: string, emoji: string) => void
  togglePinMessage?: (msgId: string) => void
}

export function ChatFeed({
  user,
  activeChannel,
  activeMessages,
  isLoadingMessages,
  inputMessage,
  setInputMessage,
  handleSendMessage,
  handleFileUpload,
  handleTyping,
  typingUsers,
  isInfoOpen = false,
  setIsInfoOpen,
  setSelectedImage,
  messagesEndRef,
  handleOpenDM,
  teamUsers = [],
  currentMembers = [],
  availableUsersToAdd = [],
  onAddMember,
  onRemoveMember,
  onTogglePrivacy,
  isAdminUser = false,
  toggleReaction,
  togglePinMessage,
}: ChatFeedProps) {
  const isDM = activeChannel.category === "dm" || activeChannel.id.startsWith("dm-") || activeChannel.id.startsWith("dm_")
  const channelPrefix = isDM ? "@" : "#"

  const [sidebarView, setSidebarView] = useState<"main" | "members" | "pinned-messages">("main")
  const [replyingToMessage, setReplyingToMessage] = useState<ChatMessage | null>(null)

  // Sync Pinned Messages map
  const [pinnedIdsMap, setPinnedIdsMap] = useState<Record<string, string[]>>(() => {
    if (typeof window === "undefined") return {}
    try {
      return JSON.parse(localStorage.getItem("crm_pinned_messages_map") || "{}")
    } catch {
      return {}
    }
  })

  useEffect(() => {
    const handleStorageUpdate = () => {
      try {
        setPinnedIdsMap(JSON.parse(localStorage.getItem("crm_pinned_messages_map") || "{}"))
      } catch {}
    }
    window.addEventListener("crm_pinned_messages_updated", handleStorageUpdate)
    return () => window.removeEventListener("crm_pinned_messages_updated", handleStorageUpdate)
  }, [])

  // Auto-scroll al último mensaje al cambiar de canal o terminar de cargar
  useEffect(() => {
    if (activeMessages.length > 0 && messagesEndRef.current) {
      const doScroll = () => {
        if (messagesEndRef.current) {
          const viewport =
            messagesEndRef.current.closest('[data-slot="scroll-area-viewport"]') ||
            messagesEndRef.current.closest('.overflow-y-auto') ||
            messagesEndRef.current.parentElement
          if (viewport) {
            viewport.scrollTop = viewport.scrollHeight
          }
        }
      }
      doScroll()
      const t1 = setTimeout(doScroll, 60)
      const t2 = setTimeout(doScroll, 180)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }
  }, [activeChannel.id, activeMessages.length, isLoadingMessages])

  const pinnedMessages = useMemo(() => {
    const channelPinnedIds = pinnedIdsMap[activeChannel.id] || []
    return activeMessages.filter((m) => m.isPinned || channelPinnedIds.includes(m.id))
  }, [activeMessages, pinnedIdsMap, activeChannel.id])

  const channelPinnedIds = pinnedIdsMap[activeChannel.id] || []

  const handleTogglePin = (msgId: string) => {
    if (togglePinMessage) {
      togglePinMessage(msgId)
    } else {
      try {
        const map = JSON.parse(localStorage.getItem("crm_pinned_messages_map") || "{}")
        const currentList: string[] = map[activeChannel.id] || []
        const exists = currentList.includes(msgId)
        const nextList = exists ? currentList.filter((id) => id !== msgId) : [...currentList, msgId]
        map[activeChannel.id] = nextList
        localStorage.setItem("crm_pinned_messages_map", JSON.stringify(map))
        setPinnedIdsMap(map)
        window.dispatchEvent(new CustomEvent("crm_pinned_messages_updated"))
        toast(exists ? "Mensaje desfijado del canal" : "📌 Mensaje fijado al canal")
      } catch {
        toast.error("Error al actualizar mensaje fijado")
      }
    }
  }

  const handleToggleReaction = (msgId: string, emoji: string) => {
    if (toggleReaction) {
      toggleReaction(msgId, emoji)
    }
  }

  const dmTargetUser = isDM
    ? teamUsers.find(
        (u) =>
          (u.email && u.email.toLowerCase() === activeChannel.name.toLowerCase()) ||
          (u.name && u.name.toLowerCase() === activeChannel.name.toLowerCase()) ||
          String(u.id) === activeChannel.name
      ) || {
        name: activeChannel.name,
        email: activeChannel.name.includes("@") ? activeChannel.name : undefined,
        avatar: undefined,
      }
    : null

  const headerAvatarUrl = dmTargetUser ? getAvatarUrl(dmTargetUser.avatar) : undefined
  const headerDisplayName = dmTargetUser ? dmTargetUser.name : activeChannel.name

  const onSendSubmit = () => {
    if (!inputMessage.trim()) return
    const parentId = replyingToMessage?.id
    handleSendMessage(undefined, parentId)
    setReplyingToMessage(null)
  }

  return (
    <div className="flex-1 flex flex-row bg-background/40 min-w-0 h-full overflow-hidden relative">
      {/* Feed Principal del Chat */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden border-r border-border/40">
        {/* Encabezado del Canal Activo */}
        <div className="h-14 px-4 border-b border-border flex items-center justify-between bg-card/40 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {isDM && dmTargetUser ? (
              <UserProfilePopover
                targetUser={dmTargetUser}
                currentUser={user}
                handleOpenDM={handleOpenDM}
                side="bottom"
                align="start"
              >
                <Avatar className="h-8 w-8 border border-border shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all">
                  {headerAvatarUrl && <AvatarImage src={headerAvatarUrl} alt={headerDisplayName} />}
                  <AvatarFallback className="bg-sky-100 text-sky-700 dark:bg-slate-800 dark:text-sky-300 text-xs font-bold border border-sky-200 dark:border-slate-700">
                    {headerDisplayName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </UserProfilePopover>
            ) : activeChannel.isPrivate ? (
              <Lock className="h-4 w-4 text-amber-500 shrink-0" />
            ) : (
              <Hash className="h-4 w-4 text-primary shrink-0" />
            )}
            <div className="min-w-0">
              {isDM && dmTargetUser ? (
                <UserProfilePopover
                  targetUser={dmTargetUser}
                  currentUser={user}
                  handleOpenDM={handleOpenDM}
                  side="bottom"
                  align="start"
                >
                  <h3 className="font-semibold text-sm truncate flex items-center gap-2 cursor-pointer hover:underline hover:text-primary transition-colors">
                    {channelPrefix} {headerDisplayName}
                  </h3>
                </UserProfilePopover>
              ) : (
                <h3 className="font-semibold text-sm truncate flex items-center gap-2">
                  {channelPrefix} {activeChannel.name}
                </h3>
              )}
              {activeChannel.description && (
                <p className="text-[11px] text-muted-foreground truncate">{activeChannel.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isDM && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-accent"
                onClick={() => {
                  setSidebarView("members")
                  setIsInfoOpen(true)
                }}
                title="Ver Miembros del Grupo"
              >
                <Users className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-accent"
              onClick={() => {
                setSidebarView("main")
                setIsInfoOpen(!isInfoOpen)
              }}
              title="Información del Canal"
            >
              <Info className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* WhatsApp-Style Pinned Banner (Top of Chat) */}
        {pinnedMessages.length > 0 && (
          <div className="bg-amber-500/10 dark:bg-amber-950/30 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between gap-2 text-xs shrink-0 select-none shadow-2xs">
            <div
              className="flex items-center gap-2 min-w-0 cursor-pointer hover:opacity-80 transition-opacity flex-1"
              onClick={() => {
                const latestPinned = pinnedMessages[pinnedMessages.length - 1]
                if (latestPinned) {
                  const el = document.getElementById(`msg_${latestPinned.id}`)
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" })
                }
              }}
            >
              <Pin className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 rotate-45 fill-amber-500/20" />
              <div className="min-w-0 flex-1 flex items-center gap-2">
                <span className="font-semibold text-amber-700 dark:text-amber-300 text-[11px] shrink-0">
                  📌 Mensaje Fijado ({pinnedMessages.length}):
                </span>
                <span className="text-foreground/90 text-xs truncate">
                  <strong className="text-foreground">{pinnedMessages[pinnedMessages.length - 1].senderName}:</strong>{" "}
                  {pinnedMessages[pinnedMessages.length - 1].content || "Archivo adjunto"}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 font-medium shrink-0"
              onClick={() => {
                setSidebarView("pinned-messages")
                setIsInfoOpen(true)
              }}
            >
              Ver todos ({pinnedMessages.length})
            </Button>
          </div>
        )}

        {/* Feed de Mensajes */}
        <ScrollArea className="flex-1 min-h-0 p-4 space-y-4 [&>[data-slot=scroll-area-viewport]>div]:min-h-full [&>[data-slot=scroll-area-viewport]>div]:flex [&>[data-slot=scroll-area-viewport]>div]:flex-col">
          {isLoadingMessages ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-75 text-xs text-muted-foreground gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span>Cargando conversación...</span>
            </div>
          ) : activeMessages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-3.5 my-auto">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                {isDM ? (
                  <MessageSquareDashed className="h-8 w-8 text-emerald-500" />
                ) : activeChannel.isPrivate ? (
                  <Lock className="h-8 w-8 text-amber-500" />
                ) : (
                  <Hash className="h-8 w-8 text-primary" />
                )}
              </div>
              <div className="max-w-sm space-y-1.5">
                <h4 className="text-base font-bold tracking-tight text-foreground">
                  {isDM
                    ? `Inicio de conversación con ${activeChannel.name}`
                    : `¡Bienvenido al canal #${activeChannel.name}!`}
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isDM
                    ? `Este es el comienzo de tu historial de mensajes directos con ${activeChannel.name}. Envía un mensaje a continuación para iniciar el chat en tiempo real.`
                    : activeChannel.description || "Este canal de trabajo está creado y listo para enviar comunicados y coordinaciones del equipo."}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {activeMessages.map((msg) => {
                const isMe =
                  msg.senderId === user.id ||
                  msg.senderId === user.email ||
                  Boolean(
                    msg.senderName && (
                      msg.senderName === user.name ||
                      msg.senderName === user.email ||
                      msg.senderName.toLowerCase() === (user.email || "").toLowerCase()
                    )
                  )
                const matchedUser = teamUsers.find(
                  (u: TeamUser) =>
                    (u.email && u.email.toLowerCase() === (msg.senderId || "").toLowerCase()) ||
                    (u.name && u.name.toLowerCase() === (msg.senderName || "").toLowerCase()) ||
                    String(u.id) === String(msg.senderId)
                )

                const popoverUser = matchedUser || {
                  name: msg.senderName,
                  email: msg.senderId.includes("@") ? msg.senderId : undefined,
                  avatar: msg.senderAvatar,
                }

                const displaySenderName = matchedUser
                  ? matchedUser.name
                  : msg.senderName.includes("@")
                  ? msg.senderName.split("@")[0].replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                  : msg.senderName

                const displaySenderAvatar = getAvatarUrl(msg.senderAvatar || matchedUser?.avatar)
                const isPinned = msg.isPinned || channelPinnedIds.includes(msg.id)

                // Citar mensaje padre si existe respuesta
                const parentMsg = msg.parent_id ? activeMessages.find((m) => m.id === msg.parent_id) : null
                const msgReactions = msg.reactions || {}

                return (
                  <div key={msg.id} id={`msg_${msg.id}`} className={`flex gap-3 text-sm relative ${isMe ? "flex-row-reverse" : ""}`}>
                    <UserProfilePopover
                      targetUser={popoverUser}
                      currentUser={user}
                      handleOpenDM={handleOpenDM}
                      side="right"
                      align="start"
                    >
                      <Avatar className="h-8 w-8 border border-border shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/40 transition-all">
                        {displaySenderAvatar && <AvatarImage src={displaySenderAvatar} alt={displaySenderName} />}
                        <AvatarFallback className="bg-sky-100 text-sky-700 dark:bg-slate-800 dark:text-sky-300 text-xs font-bold border border-sky-200 dark:border-slate-700">
                          {displaySenderName.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </UserProfilePopover>

                    <div className={`flex flex-col max-w-[75%] relative group/bubble ${isMe ? "items-end" : "items-start"}`}>
                      {/* Barra de Acciones Flotante al Pasar el Cursor */}
                      <div
                        className={`absolute -top-3 ${
                          isMe ? "right-2" : "left-2"
                        } opacity-0 group-hover/bubble:opacity-100 transition-opacity bg-card border border-border shadow-md rounded-full px-2 py-0.5 flex items-center gap-1 z-20`}
                      >
                        {/* Reaccionar Emoji */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="p-1 hover:bg-accent rounded-full text-muted-foreground hover:text-foreground transition-colors" title="Reaccionar con emoji">
                              <Smile className="h-3.5 w-3.5" />
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-1.5 flex gap-1 shadow-lg border border-border bg-card rounded-full" side="top">
                            {["👍", "❤️", "😂", "😮", "😢", "🙏", "🚀", "🔥"].map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => handleToggleReaction(msg.id, emoji)}
                                className="p-1 hover:bg-accent rounded-full text-base hover:scale-125 transition-transform"
                              >
                                {emoji}
                              </button>
                            ))}
                          </PopoverContent>
                        </Popover>

                        {/* Responder */}
                        <button
                          onClick={() => setReplyingToMessage(msg)}
                          className="p-1 hover:bg-accent rounded-full text-muted-foreground hover:text-foreground transition-colors"
                          title="Responder mensaje"
                        >
                          <Reply className="h-3.5 w-3.5" />
                        </button>

                        {/* Fijar */}
                        <button
                          onClick={() => handleTogglePin(msg.id)}
                          className={`p-1 hover:bg-accent rounded-full transition-colors ${
                            isPinned ? "text-amber-500 font-bold" : "text-muted-foreground hover:text-foreground"
                          }`}
                          title={isPinned ? "Desfijar mensaje" : "Fijar mensaje al canal"}
                        >
                          <Pin className={`h-3.5 w-3.5 ${isPinned ? "fill-amber-500/20 rotate-45" : ""}`} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <UserProfilePopover
                          targetUser={popoverUser}
                          currentUser={user}
                          handleOpenDM={handleOpenDM}
                          side="bottom"
                          align="start"
                        >
                          <span className="font-semibold text-xs text-foreground cursor-pointer hover:underline hover:text-primary transition-colors">
                            {displaySenderName}
                          </span>
                        </UserProfilePopover>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {isPinned && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded font-medium">
                            <Pin className="h-2.5 w-2.5 rotate-45 fill-amber-500/20" /> Fijado
                          </span>
                        )}
                      </div>

                      <div
                        className={`p-3 rounded-2xl text-xs leading-relaxed ${
                          isMe
                            ? "bg-primary text-primary-foreground rounded-tr-none shadow-xs"
                            : "bg-card border border-border text-card-foreground rounded-tl-none shadow-xs"
                        }`}
                      >
                        {/* Tarjeta de Respuesta Citada Estilo WhatsApp */}
                        {parentMsg && (
                          <div
                            className={`mb-2 p-2 rounded-lg text-[11px] border-l-4 cursor-pointer hover:opacity-90 transition-opacity ${
                              isMe
                                ? "bg-black/15 border-white/80 text-white"
                                : "bg-primary/10 border-primary text-foreground"
                            }`}
                            onClick={() => {
                              const el = document.getElementById(`msg_${parentMsg.id}`)
                              if (el) el.scrollIntoView({ behavior: "smooth", block: "center" })
                            }}
                          >
                            <div className="flex items-center gap-1 font-semibold text-[10px] opacity-90 mb-0.5">
                              <CornerDownRight className="h-3 w-3" />
                              <span>@{parentMsg.senderName}</span>
                            </div>
                            <p className="truncate opacity-80 max-w-xs">{parentMsg.content || "Archivo/Imagen adjunta"}</p>
                          </div>
                        )}

                        {/* Contenido del Mensaje */}
                        {msg.content && !msg.content.startsWith("Imagen adjunta:") && (
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                        )}

                        {/* Indicador de Hora y Visto (Leído/No Leído estilo WhatsApp / Facebook) */}
                        {isMe && (
                          <div className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-90 select-none">
                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                            {msg.read ? (
                              <span title="Visto y leído por el destinatario">
                                <CheckCheck className="h-3.5 w-3.5 text-sky-300 fill-sky-300/40 shrink-0 font-bold" />
                              </span>
                            ) : (
                              <span title="Entregado (No leído aún)">
                                <CheckCheck className="h-3.5 w-3.5 text-white/60 shrink-0" />
                              </span>
                            )}
                          </div>
                        )}

                        {/* Adjuntos (Imágenes o Archivos) */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {msg.attachments.map((att, idx) => (
                              <div key={idx}>
                                {att.type === "image" ? (
                                  <img
                                    src={att.url}
                                    alt={att.name}
                                    className="max-w-xs max-h-60 rounded-lg border border-border object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => setSelectedImage(att.url)}
                                  />
                                ) : (
                                  <a
                                    href={att.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 p-2 rounded-lg bg-background/50 border border-border text-foreground hover:bg-accent transition-colors"
                                  >
                                    <FileText className="h-4 w-4 text-primary" />
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-xs truncate">{att.name}</p>
                                      {att.size && <p className="text-[10px] text-muted-foreground">{att.size}</p>}
                                    </div>
                                    <Download className="h-4 w-4 text-muted-foreground" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Reacciones de Emojis debajo de la burbuja */}
                      {Object.keys(msgReactions).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {Object.entries(msgReactions).map(([emoji, usersArr]) => {
                            const myEmail = (user.email || "").toLowerCase()
                            const myName = (user.name || "").toLowerCase()
                            const myId = String(user.id || "")
                            const arr = Array.isArray(usersArr) ? usersArr : []
                            const hasReacted = arr.some((u) => {
                              const val = String(u).toLowerCase()
                              return val === myEmail || val === myName || val === myId || (matchedUser && val === matchedUser.name.toLowerCase())
                            })
                            return (
                              <button
                                key={emoji}
                                onClick={() => handleToggleReaction(msg.id, emoji)}
                                className={`px-2 py-0.5 rounded-full text-[11px] flex items-center gap-1 border transition-all ${
                                  hasReacted
                                    ? "bg-primary/20 border-primary/40 text-primary font-bold shadow-2xs scale-105"
                                    : "bg-card border-border hover:bg-accent text-foreground"
                                }`}
                                title={`Reaccionado por: ${usersArr.join(", ")}`}
                              >
                                <span>{emoji}</span>
                                <span className="text-[10px]">{usersArr.length}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Indicador de "está escribiendo..." (Estilo WhatsApp) */}
        {Object.values(typingUsers).length > 0 && (
          <div className="px-4 py-1.5 text-xs text-primary font-medium bg-primary/5 border-t border-border flex items-center gap-2 animate-pulse">
            <span className="flex gap-1 items-center">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
            <span>
              {Object.values(typingUsers).map((u) => u.name).join(", ")}{" "}
              {Object.values(typingUsers).length === 1 ? "está escribiendo..." : "están escribiendo..."}
            </span>
          </div>
        )}

        {/* Previsualización de Mensaje en Cita / Respuesta (Estilo WhatsApp) */}
        {replyingToMessage && (
          <div className="px-3 pt-2 pb-1 bg-card/90 border-t border-border flex items-center justify-between gap-2 text-xs shrink-0">
            <div className="flex items-center gap-2 min-w-0 border-l-4 border-primary pl-2 py-0.5 flex-1">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-primary text-[11px] flex items-center gap-1">
                  <Reply className="h-3 w-3" /> Respondiendo a @{replyingToMessage.senderName}
                </p>
                <p className="text-muted-foreground text-xs truncate">
                  {replyingToMessage.content || (replyingToMessage.attachments?.length ? "Archivo/Imagen adjunta" : "")}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-full hover:bg-muted shrink-0 text-muted-foreground"
              onClick={() => setReplyingToMessage(null)}
              title="Cancelar respuesta"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        {/* Input de Mensaje de Abajo */}
        <div className="p-3 border-t border-border bg-card/60 shrink-0">
          <div className="flex items-center gap-2 bg-background border border-border rounded-xl p-2 focus-within:ring-2 focus-within:ring-primary/40 transition-all">
            <label className="cursor-pointer p-1.5 hover:bg-accent rounded-lg text-muted-foreground transition-colors">
              <Paperclip className="h-4 w-4" />
              <input type="file" className="hidden" onChange={handleFileUpload} />
            </label>

            <label className="cursor-pointer p-1.5 hover:bg-accent rounded-lg text-muted-foreground transition-colors">
              <ImageIcon className="h-4 w-4" />
              <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </label>

            <Input
              placeholder={`Enviar mensaje a ${channelPrefix} ${activeChannel.name}...`}
              className="flex-1 border-none shadow-none focus-visible:ring-0 text-xs bg-transparent h-8"
              value={inputMessage}
              onChange={(e) => {
                setInputMessage(e.target.value)
                handleTyping()
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  onSendSubmit()
                }
              }}
            />

            <Button
              size="icon"
              className="h-8 w-8 rounded-lg shrink-0"
              onClick={onSendSubmit}
              disabled={!inputMessage.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Panel Lateral de Detalles del Chat (Sidebar Derecho) */}
      {isInfoOpen && (
        <ChatDetailsSidebar
          activeChannel={activeChannel}
          dmTargetUser={dmTargetUser}
          user={user}
          activeMessages={activeMessages}
          onClose={() => setIsInfoOpen(false)}
          handleOpenDM={handleOpenDM}
          teamUsers={teamUsers}
          currentMembers={currentMembers}
          availableUsersToAdd={availableUsersToAdd}
          initialView={sidebarView}
          onAddMember={onAddMember}
          onRemoveMember={onRemoveMember}
          onTogglePrivacy={onTogglePrivacy}
          isAdminUser={isAdminUser}
          onSelectImage={setSelectedImage}
          onScrollToMessage={(msgId) => {
            const el = document.getElementById(`msg_${msgId}`)
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "center" })
            }
          }}
        />
      )}
    </div>
  )
}

