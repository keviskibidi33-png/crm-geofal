"use client"

import React, { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Image as ImageIcon,
  FileText,
  Link as LinkIcon,
  Download,
  ExternalLink,
  Search,
  FileSpreadsheet,
  FolderArchive,
  FileCode,
  Calendar,
  User as UserIcon,
} from "lucide-react"
import { type ChatMessage } from "../types"

export interface ExtractedMediaItem {
  id: string
  url: string
  name: string
  type: "image" | "file" | "link"
  size?: string
  date: string
  senderName: string
  messageId: string
}

export function extractChannelMediaAndFiles(messages: ChatMessage[]): {
  images: ExtractedMediaItem[]
  documents: ExtractedMediaItem[]
  links: ExtractedMediaItem[]
  all: ExtractedMediaItem[]
} {
  const images: ExtractedMediaItem[] = []
  const documents: ExtractedMediaItem[] = []
  const links: ExtractedMediaItem[] = []

  messages.forEach((msg) => {
    if (msg.attachments && Array.isArray(msg.attachments)) {
      msg.attachments.forEach((att, idx) => {
        const item: ExtractedMediaItem = {
          id: `${msg.id}_att_${idx}`,
          url: att.url,
          name: att.name || (att.type === "image" ? "Imagen compartida" : "Archivo adjunto"),
          type: att.type === "image" ? "image" : "file",
          size: att.size,
          date: msg.createdAt,
          senderName: msg.senderName || "Usuario",
          messageId: msg.id,
        }
        if (att.type === "image" || att.url.match(/\.(png|jpg|jpeg|gif|webp|svg)/i)) {
          images.push(item)
        } else {
          documents.push(item)
        }
      })
    }

    if (msg.content) {
      const urlRegex = /(https?:\/\/[^\s]+)/g
      const matches = msg.content.match(urlRegex)
      if (matches) {
        matches.forEach((url, idx) => {
          if (url.match(/\.(png|jpg|jpeg|gif|webp|svg)(\?.*)?$/i)) {
            images.push({
              id: `${msg.id}_url_${idx}`,
              url,
              name: "Imagen compartida",
              type: "image",
              date: msg.createdAt,
              senderName: msg.senderName || "Usuario",
              messageId: msg.id,
            })
          } else {
            try {
              const domain = new URL(url).hostname.replace("www.", "")
              links.push({
                id: `${msg.id}_link_${idx}`,
                url,
                name: domain || url,
                type: "link",
                date: msg.createdAt,
                senderName: msg.senderName || "Usuario",
                messageId: msg.id,
              })
            } catch {
              links.push({
                id: `${msg.id}_link_${idx}`,
                url,
                name: url,
                type: "link",
                date: msg.createdAt,
                senderName: msg.senderName || "Usuario",
                messageId: msg.id,
              })
            }
          }
        })
      }
    }
  })

  return { images, documents, links, all: [...images, ...documents, ...links] }
}

interface MediaGalleryModalProps {
  isOpen: boolean
  onClose: () => void
  channelName: string
  activeMessages: ChatMessage[]
  onSelectImage?: (url: string) => void
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || ""
  if (["xlsx", "xls", "csv"].includes(ext)) {
    return <FileSpreadsheet className="h-6 w-6 text-emerald-500 shrink-0" />
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return <FolderArchive className="h-6 w-6 text-amber-500 shrink-0" />
  }
  if (["js", "ts", "json", "html", "css", "py"].includes(ext)) {
    return <FileCode className="h-6 w-6 text-indigo-500 shrink-0" />
  }
  return <FileText className="h-6 w-6 text-rose-500 shrink-0" />
}

export function MediaGalleryModal({
  isOpen,
  onClose,
  channelName,
  activeMessages,
  onSelectImage,
}: MediaGalleryModalProps) {
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<"photos" | "docs" | "links">("photos")

  const media = useMemo(() => extractChannelMediaAndFiles(activeMessages), [activeMessages])

  const filteredImages = useMemo(() => {
    if (!search.trim()) return media.images
    const q = search.toLowerCase()
    return media.images.filter(
      (item) => item.name.toLowerCase().includes(q) || item.senderName.toLowerCase().includes(q)
    )
  }, [media.images, search])

  const filteredDocs = useMemo(() => {
    if (!search.trim()) return media.documents
    const q = search.toLowerCase()
    return media.documents.filter(
      (item) => item.name.toLowerCase().includes(q) || item.senderName.toLowerCase().includes(q)
    )
  }, [media.documents, search])

  const filteredLinks = useMemo(() => {
    if (!search.trim()) return media.links
    const q = search.toLowerCase()
    return media.links.filter(
      (item) => item.name.toLowerCase().includes(q) || item.url.toLowerCase().includes(q) || item.senderName.toLowerCase().includes(q)
    )
  }, [media.links, search])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-card border-border">
        {/* Header Estilo WhatsApp */}
        <DialogHeader className="p-4 pb-3 border-b border-border bg-card/80 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <span>Archivos compartidos en #{channelName}</span>
                <Badge variant="secondary" className="text-xs px-2 py-0.5 font-semibold">
                  {media.all.length} Total
                </Badge>
              </DialogTitle>
              <p className="text-xs text-muted-foreground pt-0.5">
                Galería de imágenes, documentos y enlaces compartidos en el canal.
              </p>
            </div>
          </div>

          {/* Buscador Integrado */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar archivos por nombre o usuario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 text-xs pl-9 pr-4 rounded-full bg-background border-border/70 focus-visible:ring-1"
            />
          </div>
        </DialogHeader>

        {/* Pestañas de Categoría (Fotos / Documentos / Enlaces) */}
        <Tabs
          defaultValue="photos"
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as "photos" | "docs" | "links")}
          className="flex-1 flex flex-col min-h-0 overflow-hidden"
        >
          <div className="px-4 border-b border-border bg-muted/20 shrink-0">
            <TabsList className="bg-transparent h-11 p-0 gap-6 border-b-0">
              <TabsTrigger
                value="photos"
                className="h-11 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs font-semibold gap-2"
              >
                <ImageIcon className="h-4 w-4 text-sky-500" />
                <span>Fotos y Videos</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                  {media.images.length}
                </Badge>
              </TabsTrigger>

              <TabsTrigger
                value="docs"
                className="h-11 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs font-semibold gap-2"
              >
                <FileText className="h-4 w-4 text-rose-500" />
                <span>Documentos</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                  {media.documents.length}
                </Badge>
              </TabsTrigger>

              <TabsTrigger
                value="links"
                className="h-11 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs font-semibold gap-2"
              >
                <LinkIcon className="h-4 w-4 text-emerald-500" />
                <span>Enlaces</span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                  {media.links.length}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: FOTOS Y VIDEOS */}
          <TabsContent value="photos" className="flex-1 min-h-0 overflow-y-auto p-4 m-0">
            {filteredImages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-2">
                <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-xs font-medium">No se encontraron fotos ni multimedia compartida.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredImages.map((img) => (
                  <div
                    key={img.id}
                    className="group relative aspect-square rounded-xl border border-border bg-muted overflow-hidden cursor-pointer hover:shadow-md transition-all"
                    onClick={() => onSelectImage?.(img.url)}
                  >
                    <img
                      src={img.url}
                      alt={img.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-2 flex flex-col justify-end text-white text-[10px]">
                      <p className="font-semibold truncate">{img.name}</p>
                      <p className="text-[9px] text-white/80">{img.senderName}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 2: DOCUMENTOS */}
          <TabsContent value="docs" className="flex-1 min-h-0 overflow-y-auto p-4 m-0 space-y-2">
            {filteredDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-2">
                <FileText className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-xs font-medium">No se encontraron documentos ni archivos en este canal.</p>
              </div>
            ) : (
              filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-border/70 bg-card hover:bg-accent/40 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {getFileIcon(doc.name)}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {doc.name}
                      </p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-0.5">
                        <span className="flex items-center gap-1">
                          <UserIcon className="h-3 w-3" /> {doc.senderName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> {new Date(doc.date).toLocaleDateString()}
                        </span>
                        {doc.size && <span>{doc.size}</span>}
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-full gap-1.5 text-xs font-medium hover:bg-primary hover:text-primary-foreground shrink-0 ml-2"
                    asChild
                  >
                    <a href={doc.url} target="_blank" rel="noreferrer">
                      <Download className="h-3.5 w-3.5" /> Descargar
                    </a>
                  </Button>
                </div>
              ))
            )}
          </TabsContent>

          {/* TAB 3: ENLACES */}
          <TabsContent value="links" className="flex-1 min-h-0 overflow-y-auto p-4 m-0 space-y-2">
            {filteredLinks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-2">
                <LinkIcon className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-xs font-medium">No hay enlaces web compartidos en esta conversación.</p>
              </div>
            ) : (
              filteredLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-border/70 bg-card hover:bg-accent/40 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                      <LinkIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {link.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">{link.url}</p>
                      <p className="text-[9px] text-muted-foreground/80 pt-0.5">
                        Compartido por {link.senderName} • {new Date(link.date).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-full gap-1.5 text-xs font-medium hover:bg-primary hover:text-primary-foreground shrink-0 ml-2"
                    asChild
                  >
                    <a href={link.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" /> Abrir Enlace
                    </a>
                  </Button>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
