"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Building2,
  Search,
  Plus,
  RefreshCw,
  Eye,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Phone,
  Mail,
  User,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Filter,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { authFetch } from "@/lib/api-auth";
import { ModernConfirmDialog } from "./modern-confirm-dialog";
import { DatosClienteDialog } from "./datos-clientes/DatosClienteDialog";
import { DatosClienteDetailDialog } from "./datos-clientes/DatosClienteDetailDialog";
import type { DatosCliente, DatosClienteListResponse } from "@/types/datos-clientes";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export function DatosClientesModule() {
  const [items, setItems] = useState<DatosCliente[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState<string>("ALL");

  // Modals state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clienteToEdit, setClienteToEdit] = useState<DatosCliente | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);
  const [clienteToView, setClienteToView] = useState<DatosCliente | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [clienteToDelete, setClienteToDelete] = useState<DatosCliente | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDatosClientes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (estadoFilter !== "ALL") params.set("estado", estadoFilter);
      params.set("page", String(page));
      params.set("page_size", String(pageSize));

      const res = await authFetch(`${API_URL}/api/datos-clientes?${params.toString()}`);
      if (!res.ok) throw new Error("Error al obtener datos de clientes");

      const data: DatosClienteListResponse = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);
      setTotalPages(data.total_pages || 1);
    } catch (err: any) {
      toast.error(err.message || "Error al cargar datos");
    } finally {
      setLoading(false);
    }
  }, [search, estadoFilter, page, pageSize]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDatosClientes();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchDatosClientes]);

  const handleOpenCreate = () => {
    setClienteToEdit(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: DatosCliente) => {
    setClienteToEdit(item);
    setDialogOpen(true);
  };

  const handleOpenView = (item: DatosCliente) => {
    setClienteToView(item);
    setDetailOpen(true);
  };

  const handleOpenDelete = (item: DatosCliente) => {
    setClienteToDelete(item);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!clienteToDelete) return;
    setDeleting(true);
    try {
      const res = await authFetch(`${API_URL}/api/datos-clientes/${clienteToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("No se pudo eliminar el registro");

      toast.success("Registro eliminado correctamente");
      setDeleteOpen(false);
      setClienteToDelete(null);
      fetchDatosClientes();
    } catch (err: any) {
      toast.error(err.message || "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  const getMissingFields = (item: DatosCliente): string[] => {
    const missing: string[] = [];
    if (!item.cliente) missing.push("Cliente / Razón Social");
    if (!item.ruc) missing.push("RUC / Doc.");
    if (!item.domicilio_legal) missing.push("Domicilio Legal");
    if (!item.persona_contacto) missing.push("Persona Contacto");
    if (!item.email) missing.push("Email");
    if (!item.telefono) missing.push("Teléfono");
    if (!item.solicitante) missing.push("Solicitante");
    if (!item.domicilio_solicitante) missing.push("Domicilio Solicitante");
    if (!item.proyecto) missing.push("Proyecto");
    if (!item.ubicacion) missing.push("Ubicación");
    return missing;
  };

  const countCompletos = items.filter((i) => i.estado === "COMPLETO").length;
  const countIncompletos = items.filter((i) => i.estado === "INCOMPLETO").length;

  return (
    <div className="space-y-6">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-card border rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-primary/10 text-primary rounded-2xl border border-primary/20 shadow-inner">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-foreground uppercase">
              Datos Clientes & Informes
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Directorio de perfiles de clientes, obras y solicitantes para Recepción e Informes oficiales.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDatosClientes}
            disabled={loading}
            className="rounded-xl h-10 px-4 text-xs font-bold border-border shadow-xs hover:bg-muted"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} />
            Recargar
          </Button>

          <Button
            onClick={handleOpenCreate}
            className="rounded-xl h-10 px-5 text-xs font-black uppercase tracking-wider bg-primary text-primary-foreground shadow-md hover:bg-primary/90 flex items-center gap-2"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            Nuevo Registro
          </Button>
        </div>
      </div>

      {/* METRICS SUMMARY */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-2xl border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Total Registros
              </p>
              <h3 className="text-2xl font-black text-foreground mt-0.5">{total}</h3>
            </div>
            <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Fichas Completas
              </p>
              <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {countCompletos} <span className="text-xs text-muted-foreground font-normal">en pág.</span>
              </h3>
            </div>
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border bg-card shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Fichas Incompletas
              </p>
              <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">
                {countIncompletos} <span className="text-xs text-muted-foreground font-normal">en pág.</span>
              </h3>
            </div>
            <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* FILTROS Y BARRA DE BÚSQUEDA */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-card p-4 rounded-2xl border shadow-xs">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por cliente, RUC, proyecto, contacto..."
            className="pl-9 text-xs rounded-xl h-9"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="w-3.5 h-3.5" />
            <span className="font-bold uppercase text-[10px]">Estado:</span>
          </div>
          <Select
            value={estadoFilter}
            onValueChange={(val) => {
              setEstadoFilter(val);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[140px] text-xs h-9 rounded-xl">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="COMPLETO">Completos</SelectItem>
              <SelectItem value="INCOMPLETO">Incompletos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* TABLA DE PRESENTACIÓN (Conforme a la imagen adjunta del usuario) */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-primary text-primary-foreground font-black uppercase text-[11px] tracking-wider border-b border-primary-foreground/20">
                <th className="py-3.5 px-4 w-16 text-center">No</th>
                <th className="py-3.5 px-4">CLIENTE</th>
                <th className="py-3.5 px-4">PROYECTO</th>
                <th className="py-3.5 px-4">CONTACTO</th>
                <th className="py-3.5 px-4">TELEFONO</th>
                <th className="py-3.5 px-4 text-center">ESTADO</th>
                <th className="py-3.5 px-4 text-center w-36">ACCIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                      <span className="text-xs font-semibold">Cargando registros...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Building2 className="w-8 h-8 text-muted-foreground/40" />
                      <span className="text-sm font-bold">No se encontraron clientes registrados</span>
                      <p className="text-xs text-muted-foreground">
                        Haga clic en "+ Nuevo Registro" para dar de alta el primer cliente e informe.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const itemNumber = (page - 1) * pageSize + idx + 1;
                  const isCompleto = item.estado === "COMPLETO";
                  const missing = getMissingFields(item);

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/50 transition-colors group"
                    >
                      {/* No */}
                      <td className="py-3 px-4 font-mono font-bold text-center text-muted-foreground">
                        {itemNumber}
                      </td>

                      {/* CLIENTE */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-foreground uppercase">
                          {item.cliente}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 mt-0.5">
                          <span className="bg-muted px-1.5 py-0.5 rounded font-bold">
                            RUC: {item.ruc || "Sin RUC"}
                          </span>
                        </div>
                      </td>

                      {/* PROYECTO */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-medium text-foreground uppercase line-clamp-2">
                          {item.proyecto || "-"}
                        </div>
                        {item.ubicacion && (
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                            <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                            {item.ubicacion}
                          </div>
                        )}
                      </td>

                      {/* CONTACTO */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground uppercase">
                          {item.persona_contacto || "-"}
                        </div>
                        {item.email && (
                          <div className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">
                            {item.email}
                          </div>
                        )}
                      </td>

                      {/* TELEFONO */}
                      <td className="py-3 px-4 font-mono font-semibold text-foreground">
                        {item.telefono || "-"}
                      </td>

                      {/* ESTADO */}
                      <td className="py-3 px-4 text-center">
                        <TooltipProvider>
                          <Tooltip delayDuration={200}>
                            <TooltipTrigger asChild>
                              <div className="inline-block cursor-help">
                                <Badge
                                  variant="outline"
                                  className={`px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full inline-flex items-center gap-1 ${
                                    isCompleto
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                  }`}
                                >
                                  {isCompleto ? (
                                    <>
                                      <CheckCircle2 className="w-3 h-3" />
                                      Completo
                                    </>
                                  ) : (
                                    <>
                                      <AlertTriangle className="w-3 h-3" />
                                      Incompleto
                                    </>
                                  )}
                                </Badge>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs max-w-xs p-3">
                              {isCompleto ? (
                                <p className="font-medium text-emerald-500">
                                  ✅ Todos los datos de cliente e informe están completos.
                                </p>
                              ) : (
                                <div>
                                  <p className="font-bold text-amber-500 mb-1">
                                    ⚠️ Campos faltantes para el informe:
                                  </p>
                                  <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                                    {missing.map((m, i) => (
                                      <li key={i}>{m}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>

                      {/* ACCIONES */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenView(item)}
                            title="Ver detalles"
                            className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary text-muted-foreground"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(item)}
                            title="Editar"
                            className="h-7 w-7 rounded-lg hover:bg-blue-500/10 hover:text-blue-600 text-muted-foreground"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDelete(item)}
                            title="Eliminar"
                            className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINACIÓN */}
        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground">
            Mostrando <span className="font-bold text-foreground">{items.length}</span> de{" "}
            <span className="font-bold text-foreground">{total}</span> registros
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="h-8 text-xs rounded-xl"
            >
              <ChevronLeft className="w-3.5 h-3.5 mr-1" />
              Anterior
            </Button>

            <span className="text-xs font-bold px-2">
              Pág. {page} de {totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="h-8 text-xs rounded-xl"
            >
              Siguiente
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* MODAL CREAR / EDITAR */}
      <DatosClienteDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clienteToEdit={clienteToEdit}
        onSaved={fetchDatosClientes}
      />

      {/* MODAL VER DETALLES */}
      <DatosClienteDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        cliente={clienteToView}
        onEdit={(client) => {
          setClienteToEdit(client);
          setDialogOpen(true);
        }}
      />

      {/* MODAL CONFIRMAR ELIMINACIÓN */}
      <ModernConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="¿Eliminar registro de Datos Cliente?"
        description={`¿Está seguro de que desea eliminar el registro de "${clienteToDelete?.cliente}" para el proyecto "${clienteToDelete?.proyecto}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="destructive"
        onConfirm={confirmDelete}
      />
    </div>
  );
}
