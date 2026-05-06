const PROFILE_AVATAR_DRAFT_EVENT = "crm-profile-avatar-draft-change"
const draftAvatarByUserId = new Map<string, string>()

type AvatarDraftListener = (payload: { userId: string; avatarUrl: string | null }) => void

function isBrowser() {
  return typeof window !== "undefined"
}

export function getProfileAvatarDraft(userId?: string | null) {
  const normalizedUserId = String(userId || "").trim()
  if (!normalizedUserId) return null
  return draftAvatarByUserId.get(normalizedUserId) || null
}

export function setProfileAvatarDraft(userId: string, avatarUrl: string | null) {
  const normalizedUserId = String(userId || "").trim()
  if (!normalizedUserId) return

  if (avatarUrl) {
    draftAvatarByUserId.set(normalizedUserId, avatarUrl)
  } else {
    draftAvatarByUserId.delete(normalizedUserId)
  }

  if (isBrowser()) {
    window.dispatchEvent(
      new CustomEvent(PROFILE_AVATAR_DRAFT_EVENT, {
        detail: {
          userId: normalizedUserId,
          avatarUrl: avatarUrl || null,
        },
      }),
    )
  }
}

export function clearProfileAvatarDraft(userId: string) {
  setProfileAvatarDraft(userId, null)
}

export function subscribeProfileAvatarDraft(listener: AvatarDraftListener) {
  if (!isBrowser()) {
    return () => undefined
  }

  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<{ userId?: string; avatarUrl?: string | null }>
    listener({
      userId: String(customEvent.detail?.userId || ""),
      avatarUrl: customEvent.detail?.avatarUrl || null,
    })
  }

  window.addEventListener(PROFILE_AVATAR_DRAFT_EVENT, handler as EventListener)
  return () => window.removeEventListener(PROFILE_AVATAR_DRAFT_EVENT, handler as EventListener)
}
