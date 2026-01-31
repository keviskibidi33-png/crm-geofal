export interface ProgramacionServicio {
    id: string
    item_numero: number
    recep_numero: string
    ot: string | null
    codigo_muestra: string | null
    fecha_recepcion: string | null
    fecha_inicio: string | null
    fecha_entrega_estimada: string | null
    cliente_nombre: string
    descripcion_servicio: string | null
    proyecto: string | null
    entrega_real: string | null
    estado_trabajo: string
    cotizacion_lab: string | null
    autorizacion_lab: string | null
    nota_lab: string | null
    dias_atraso_lab: number
    motivo_dias_atraso_lab: string | null
    evidencia_envio_recepcion: string | null
    envio_informes: string | null
    fecha_solicitud_com: string | null
    fecha_entrega_com: string | null
    evidencia_solicitud_envio: string | null
    dias_atraso_envio_coti: number | null
    motivo_dias_atraso_com: string | null
    numero_factura: string | null
    estado_pago: string | null
    estado_autorizar: string | null
    nota_admin: string | null
}
