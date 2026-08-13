import { type User } from "@/hooks/use-auth"

export interface ChatMessage {
  id: string
  channelId: string
  senderId: string
  senderName: string
  senderAvatar?: string
  content: string
  attachments?: Array<{ url: string; type: "image" | "file"; name: string; size?: string }>
  createdAt: string
  parent_id?: string
  read?: boolean
  isPinned?: boolean
  reactions?: Record<string, string[]>
  replyTo?: { id: string; senderName: string; content: string }
}

export interface ChatChannel {
  id: string
  name: string
  description?: string
  isPrivate: boolean
  category: "general" | "area" | "proyecto" | "dm"
  unreadCount?: number
  allowedRoles?: string[]
  allowedEmails?: string[]
  createdBy?: string
}

export interface TeamUser {
  id: string
  name: string
  email: string
  role: string
  avatar?: string
  status: "online" | "offline"
  last_seen_at?: string | null
}

export interface ComunicacionesModuleProps {
  user: User
  initialChannelId?: string
}

export const DEFAULT_CHANNELS: ChatChannel[] = [
  { id: "general", name: "general", description: "Comunicados e información de empresa", isPrivate: false, category: "general" },
  { id: "ventas", name: "comercial-ventas", description: "Coordinación de cotizaciones y clientes", isPrivate: false, category: "area" },
  { id: "laboratorio", name: "laboratorio-ensayos", description: "Ensayos de campo, muestras y probetas", isPrivate: false, category: "area" },
  { id: "informes", name: "informes-revision", description: "Revisión y emisión de informes LEM", isPrivate: false, category: "area" },
]

export function getCanonicalDmId(user1: { id?: string; email?: string }, user2: { id?: string; email?: string }): string {
  const e1 = (user1.email || user1.id || "").trim().toLowerCase()
  const e2 = (user2.email || user2.id || "").trim().toLowerCase()
  const sorted = [e1, e2].sort()
  return `dm_${sorted[0]}_${sorted[1]}`
}

export function areChannelIdsEqual(id1: string, id2: string): boolean {
  if (!id1 || !id2) return false
  if (id1 === id2) return true

  const isDm1 = id1.startsWith("dm_") || id1.startsWith("dm-")
  const isDm2 = id2.startsWith("dm_") || id2.startsWith("dm-")

  if (isDm1 && isDm2) {
    const parts1 = id1.replace(/^dm[_|-]/, "").split(/[_|-]/).map((p) => p.toLowerCase()).sort()
    const parts2 = id2.replace(/^dm[_|-]/, "").split(/[_|-]/).map((p) => p.toLowerCase()).sort()
    return parts1.join("_") === parts2.join("_")
  }

  return false
}

export function getAvatarUrl(avatarPath?: string | null): string | undefined {
  if (!avatarPath) return undefined
  if (avatarPath.startsWith("http://") || avatarPath.startsWith("https://") || avatarPath.startsWith("data:")) {
    return avatarPath
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://uivlyclywvxvhjvgssky.supabase.co"
  const cleanPath = avatarPath.replace(/^\/+/, "")
  return `${supabaseUrl}/storage/v1/object/public/avatars/${cleanPath}`
}

let sharedAudioCtx: AudioContext | null = null

function getUnlockedAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return null
    if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
      sharedAudioCtx = new AudioContextClass()
    }
    if (sharedAudioCtx.state === "suspended") {
      sharedAudioCtx.resume().catch(() => {})
    }
    return sharedAudioCtx
  } catch {
    return null
  }
}

if (typeof window !== "undefined") {
  const unlock = () => {
    getUnlockedAudioContext()
    window.removeEventListener("pointerdown", unlock)
    window.removeEventListener("keydown", unlock)
    window.removeEventListener("click", unlock)
  }
  window.addEventListener("pointerdown", unlock, { once: true })
  window.addEventListener("keydown", unlock, { once: true })
  window.addEventListener("click", unlock, { once: true })
}

export function isSoundNotificationsEnabled(): boolean {
  if (typeof window === "undefined") return true
  try {
    const mainSetting = localStorage.getItem("crm_sound_enabled")
    const chatSetting = localStorage.getItem("crm_chat_sound_enabled")
    return mainSetting !== "false" && chatSetting !== "false"
  } catch {
    return true
  }
}

export function setSoundNotificationsEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem("crm_sound_enabled", String(enabled))
    localStorage.setItem("crm_chat_sound_enabled", String(enabled))
    window.dispatchEvent(
      new CustomEvent("crm_sound_setting_changed", { detail: { enabled } })
    )
  } catch {
    // Ignore storage errors
  }
}

export function playChatChimeSound(): void {
  if (typeof window === "undefined") return
  try {
    if (!isSoundNotificationsEnabled()) return

    const ctx = getUnlockedAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = "sine"
    osc.frequency.setValueAtTime(587.33, now)
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.12)

    gain.gain.setValueAtTime(0.18, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.35)
  } catch (err) {
    console.warn("[playChatChimeSound] Could not play chime sound:", err)
  }
}
