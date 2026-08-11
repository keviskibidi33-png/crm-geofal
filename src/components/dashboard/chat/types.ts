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
}

export interface ChatChannel {
  id: string
  name: string
  description?: string
  isPrivate: boolean
  category: "general" | "area" | "proyecto" | "dm"
  unreadCount?: number
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
  { id: "alertas", name: "alertas-gerencia", description: "Notificaciones y clientes prioritarios", isPrivate: true, category: "area" },
]
