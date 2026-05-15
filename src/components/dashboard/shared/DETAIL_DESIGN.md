# Estándar de Modales de Detalle (CRM Geofal)

## Layout del Dialog

```tsx
<DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
  <DialogHeader className="p-6 border-b shrink-0 bg-background z-10">
    <DialogTitle className="flex items-center gap-2 text-xl">
      <FileText className="h-5 w-5 text-primary" />
      Detalle de ...
    </DialogTitle>
    <DialogDescription>Información completa del formato OT ...</DialogDescription>
  </DialogHeader>

  {/* Content */}
  <div className="flex-1 min-h-0 overflow-auto">
    <div className="p-6 space-y-6">
      ...
    </div>
  </div>

  <DialogFooter className="p-6 border-t shrink-0 bg-muted/5 gap-2 sm:gap-0">
    ...
  </DialogFooter>
</DialogContent>
```

## Cards

### Card principal
- `bg-card rounded-2xl border p-6`

### Card de sección interna
- `bg-slate-50 p-4 rounded-lg border border-slate-100 shadow-sm`
- Título: `text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5`
- Indicador: `w-1 h-3 bg-indigo-500 rounded-full`

## Estado del Trabajo

### Contenedor
- `flex items-center gap-4 p-5 rounded-2xl bg-muted/50 border`

### Icono
- Tamaño: `h-10 w-10`
- Completado: `<CheckCircle2 className="h-10 w-10 text-green-500" />`
- En proceso: `<Clock className="h-10 w-10 text-primary animate-pulse" />`
- Pendiente: `<Clock className="h-10 w-10 text-slate-400" />`

### Textos
- Estado: `text-sm font-black uppercase`
- Vencimiento: `text-[10px] font-bold text-muted-foreground uppercase mt-0.5`
- Fechas: `text-[10px] font-black uppercase tracking-widest`

## Timeline de Etapas

### Línea conectora
- `absolute left-[19px] top-4 bottom-4 w-0.5 bg-slate-200`

### Círculos
- Tamaño: `h-10 w-10 rounded-full flex items-center justify-center shrink-0 z-10`
- Completado: `bg-green-100 text-green-600`
- En proceso: `bg-yellow-100 text-yellow-600`
- Pendiente: `bg-slate-100 text-slate-400`

### Iconos internos
- Completado: `<CheckCircle2 className="h-5 w-5" />`
- En proceso: `<Clock className="h-5 w-5" />`
- Pendiente: `<div className="h-3 w-3 rounded-full bg-current" />`

### Textos
- Nombre etapa: `text-sm font-semibold`
- Mensaje: `text-xs text-muted-foreground`
- Fecha: `text-[10px] text-muted-foreground mt-0.5`

## Tablas

### Header
- `text-[9px] font-black uppercase h-8`
- Fondo: `bg-slate-50/50`

### Celdas
- `text-xs py-2`
- Datos numéricos: `font-bold text-center`
- Códigos: `font-mono text-indigo-700`

## Tipografía Estándar

| Uso | Clase |
|-----|-------|
| Título sección | `text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4` |
| Label campo | `text-[10px] text-slate-500 font-bold uppercase tracking-tighter` |
| Valor campo | `text-sm font-semibold text-slate-800` |
| Valor destacado | `text-sm font-semibold text-indigo-600 font-mono` |
| Badge estado | `text-[9px] font-black` |
| Notas | `text-xs text-slate-600 italic line-clamp-2` |
