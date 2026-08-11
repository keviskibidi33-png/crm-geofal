"use client"

import React from "react"
import { type ComunicacionesModuleProps } from "./chat/types"
import { useChatState } from "./chat/use-chat-state"
import { ChatSidebar } from "./chat/chat-sidebar"
import { ChatFeed } from "./chat/chat-feed"
import { CreateChannelDialog } from "./chat/dialogs/create-channel-dialog"
import { ChannelMembersDialog } from "./chat/dialogs/channel-members-dialog"
import { ChannelInfoDialog } from "./chat/dialogs/channel-info-dialog"
import { NewDmDialog } from "./chat/dialogs/new-dm-dialog"
import { ImageLightbox } from "./chat/dialogs/image-lightbox"

export function ComunicacionesModule({ user, initialChannelId }: ComunicacionesModuleProps) {
  const chat = useChatState(user, initialChannelId)

  return (
    <div className="flex h-full w-full overflow-hidden bg-background text-foreground">
      {/* ── COLUMNA IZQUIERDA: Barra Lateral ── */}
      <ChatSidebar
        user={user}
        channels={chat.channels}
        activeChannelId={chat.activeChannelId}
        setActiveChannelId={chat.setActiveChannelId}
        teamUsers={chat.teamUsers}
        startedDmUserIds={chat.startedDmUserIds}
        searchQuery={chat.searchQuery}
        setSearchQuery={chat.setSearchQuery}
        canCreateChannel={chat.canCreateChannel}
        isAdminUser={chat.isAdminUser}
        setIsCreateChannelOpen={chat.setIsCreateChannelOpen}
        setIsNewDMOpen={chat.setIsNewDMOpen}
        handleOpenDM={chat.handleOpenDM}
        unreadCounts={chat.unreadCounts}
      />

      {/* ── COLUMNA CENTRAL: Feed de Mensajes ── */}
      <ChatFeed
        user={user}
        activeChannel={chat.activeChannel}
        activeMessages={chat.activeMessages}
        isLoadingMessages={chat.isLoadingMessages}
        inputMessage={chat.inputMessage}
        setInputMessage={chat.setInputMessage}
        handleSendMessage={chat.handleSendMessage}
        handleFileUpload={chat.handleFileUpload}
        handleTyping={chat.handleTyping}
        typingUsers={chat.typingUsers}
        setIsMembersOpen={chat.setIsMembersOpen}
        isInfoOpen={chat.isInfoOpen}
        setIsInfoOpen={chat.setIsInfoOpen}
        setSelectedImage={chat.setSelectedImage}
        messagesEndRef={chat.messagesEndRef}
        handleOpenDM={chat.handleOpenDM}
        teamUsers={chat.teamUsers}
      />

      {/* ── MODALES Y DIÁLOGOS ── */}
      <CreateChannelDialog
        isOpen={chat.isCreateChannelOpen}
        onOpenChange={chat.setIsCreateChannelOpen}
        newChannelName={chat.newChannelName}
        setNewChannelName={chat.setNewChannelName}
        newChannelDesc={chat.newChannelDesc}
        setNewChannelDesc={chat.setNewChannelDesc}
        newChannelIsPrivate={chat.newChannelIsPrivate}
        setNewChannelIsPrivate={chat.setNewChannelIsPrivate}
        selectedUserEmails={chat.selectedUserEmails}
        setSelectedUserEmails={chat.setSelectedUserEmails}
        teamUsers={chat.teamUsers}
        handleCreateChannel={chat.handleCreateChannel}
      />

      <ChannelMembersDialog
        isOpen={chat.isMembersOpen}
        onOpenChange={chat.setIsMembersOpen}
        activeChannel={chat.activeChannel}
        canCreateChannel={chat.canCreateChannel}
        selectedUserToAdd={chat.selectedUserToAdd}
        setSelectedUserToAdd={chat.setSelectedUserToAdd}
        availableUsersToAdd={chat.availableUsersToAdd}
        currentMembers={chat.currentMembers}
        handleAddMemberToChannel={chat.handleAddMemberToChannel}
        handleRemoveMemberFromChannel={chat.handleRemoveMemberFromChannel}
      />

      <ChannelInfoDialog
        isOpen={chat.isInfoOpen}
        onOpenChange={chat.setIsInfoOpen}
        activeChannel={chat.activeChannel}
        activeChannelId={chat.activeChannelId}
        canCreateChannel={chat.canCreateChannel}
        editChannelName={chat.editChannelName}
        setEditChannelName={chat.setEditChannelName}
        editChannelDesc={chat.editChannelDesc}
        setEditChannelDesc={chat.setEditChannelDesc}
        editChannelCategory={chat.editChannelCategory}
        setEditChannelCategory={chat.setEditChannelCategory}
        editChannelIsPrivate={chat.editChannelIsPrivate}
        setEditChannelIsPrivate={chat.setEditChannelIsPrivate}
        handleUpdateChannelInfo={chat.handleUpdateChannelInfo}
        handleDeleteChannel={chat.handleDeleteChannel}
      />

      <NewDmDialog
        isOpen={chat.isNewDMOpen}
        onOpenChange={chat.setIsNewDMOpen}
        user={user}
        teamUsers={chat.teamUsers}
        dmSearchQuery={chat.dmSearchQuery}
        setDmSearchQuery={chat.setDmSearchQuery}
        isAdminUser={chat.isAdminUser}
        handleOpenDM={chat.handleOpenDM}
      />

      <ImageLightbox
        selectedImage={chat.selectedImage}
        onClose={() => chat.setSelectedImage(null)}
      />
    </div>
  )
}
