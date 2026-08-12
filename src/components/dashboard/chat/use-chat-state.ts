"use client"

import { type User } from "@/hooks/use-auth"
import { useChatChannels } from "./hooks/use-chat-channels"
import { useChatMessages } from "./hooks/use-chat-messages"

export function useChatState(user: User, initialChannelId?: string) {
  const channelsState = useChatChannels(user, initialChannelId)

  const messagesState = useChatMessages({
    user,
    activeChannelId: channelsState.activeChannelId,
    activeChannel: channelsState.activeChannel,
    teamUsers: channelsState.teamUsers,
    channels: channelsState.channels,
    setStartedDmUserIds: channelsState.setStartedDmUserIds,
  })

  return {
    ...channelsState,
    ...messagesState,
  }
}
