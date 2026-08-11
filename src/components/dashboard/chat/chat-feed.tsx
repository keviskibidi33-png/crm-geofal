/* eslint-disable @next/next/no-img-element */
"use client"

import React, { RefObject } from "react"
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
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { type User } from "@/hooks/use-auth"
import { type ChatChannel, type ChatMessage, type TeamUser, getAvatarUrl } from "./types"
import { UserProfilePopover } from "./dialogs/user-profile-popover"

interface ChatFeedProps {
  user: User
  activeChannel: ChatChannel
  activeMessages: ChatMessage[]
  isLoadingMessages: boolean
  inputMessage: string
  setInputMessage: (val: string) => void
  handleSendMessage: () => void
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleTyping: () => void
  typingUsers: Record<string, { name: string; timestamp: number }>
  setIsMembersOpen: (open: boolean) => void
  setIsInfoOpen: (open: boolean) => void
  setSelectedImage: (url: string | null) => void
  messagesEndRef: RefObject<HTMLDivElement | null>
  handleOpenDM?: (targetUser: TeamUser) => void
  teamUsers?: TeamUser[]
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
  setIsMembersOpen,
  setIsInfoOpen,
  setSelectedImage,
  messagesEndRef,
  handleOpenDM,
  teamUsers = [],
}: ChatFeedProps) {
  const isDM = activeChannel.category === "dm" || activeChannel.id.startsWith("dm-") || activeChannel.id.startsWith("dm_")
  const channelPrefix = isDM ? "@" : "#"

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
  const headerDisplayName = dmTargetUser
    ? dmTargetUser.name
    : activeChannel.name

  return (
    <div className="flex-1 flex flex-col bg-background/40 min-w-0 h-full overflow-hidden">
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
              onClick={() => setIsMembersOpen(true)}
              title="Ver Miembros del Grupo"
            >
              <Users className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-accent"
            onClick={() => setIsInfoOpen(true)}
            title="Información del Canal"
          >
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </div>

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

              return (
                <div key={msg.id} className={`flex gap-3 text-sm group ${isMe ? "flex-row-reverse" : ""}`}>
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

                  <div className={`flex flex-col max-w-[75%] ${isMe ? "items-end" : "items-start"}`}>
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
                    </div>

                    <div
                      className={`p-3 rounded-2xl text-xs leading-relaxed ${
                        isMe
                          ? "bg-primary text-primary-foreground rounded-tr-none shadow-xs"
                          : "bg-card border border-border text-card-foreground rounded-tl-none shadow-xs"
                      }`}
                    >
                      {/* Evitar duplicar el texto "Imagen adjunta:" si hay un adjunto de tipo imagen */}
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
                handleSendMessage()
              }
            }}
          />

          <Button
            size="icon"
            className="h-8 w-8 rounded-lg shrink-0"
            onClick={handleSendMessage}
            disabled={!inputMessage.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
