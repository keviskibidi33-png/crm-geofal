"use client";

import { useState, useEffect, useRef } from "react";
import { authFetch } from "@/lib/api-auth";
import type { ClienteItem } from "../FacturacionSection";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export function useClienteSearch() {
  const [clienteSearch, setClienteSearch] = useState<string>("");
  const [clientes, setClientes] = useState<ClienteItem[]>([]);
  const isSelectionRef = useRef<boolean>(false);

  useEffect(() => {
    if (isSelectionRef.current) {
      isSelectionRef.current = false;
      return;
    }

    const timer = setTimeout(async () => {
      const q = clienteSearch.trim();
      if (q.length >= 1) {
        try {
          const [resDatosClientes, resClientes, resPlantillas] = await Promise.allSettled([
            authFetch(
              `${API_URL}/api/datos-clientes/autocomplete?q=${encodeURIComponent(q)}`
            ),
            authFetch(`${API_URL}/clientes?search=${encodeURIComponent(q)}`),
            authFetch(
              `${API_URL}/api/recepcion/plantillas/buscar?q=${encodeURIComponent(q)}`
            ),
          ]);

          const combined: ClienteItem[] = [];

          // 1. Prioridad: DatosClientes (Directorio especializado para informes)
          if (resDatosClientes.status === "fulfilled" && resDatosClientes.value.ok) {
            const json = await resDatosClientes.value.json();
            if (Array.isArray(json)) {
              json.forEach((dc: any) => {
                const name = dc.cliente || dc.nombre;
                if (name) {
                  combined.push({
                    id: dc.id,
                    nombre: name,
                    cliente: name,
                    ruc: dc.ruc,
                    direccion: dc.domicilio_legal,
                    domicilio_legal: dc.domicilio_legal,
                    contacto: dc.persona_contacto,
                    persona_contacto: dc.persona_contacto,
                    email: dc.email,
                    telefono: dc.telefono,
                    solicitante: dc.solicitante,
                    domicilio_solicitante: dc.domicilio_solicitante,
                    proyecto: dc.proyecto,
                    ubicacion: dc.ubicacion,
                  });
                }
              });
            }
          }

          // 2. Clientes comerciales generales
          if (resClientes.status === "fulfilled" && resClientes.value.ok) {
            const json = await resClientes.value.json();
            if (Array.isArray(json.data)) {
              json.data.forEach((c: any) => {
                const name = c.nombre || c.cliente;
                if (
                  name &&
                  !combined.some(
                    (item) =>
                      String(item.nombre || item.cliente || "").toUpperCase() ===
                      String(name).toUpperCase()
                  )
                ) {
                  combined.push(c as ClienteItem);
                }
              });
            }
          }

          // 3. Plantillas históricas
          if (resPlantillas.status === "fulfilled" && resPlantillas.value.ok) {
            const json = await resPlantillas.value.json();
            if (Array.isArray(json)) {
              json.forEach((p: any) => {
                const name = p.cliente || p.nombre || p.nombre_plantilla;
                if (
                  name &&
                  !combined.some(
                    (c) =>
                      String(c.nombre || c.cliente || "").toUpperCase() ===
                      String(name).toUpperCase()
                  )
                ) {
                  combined.push({
                    id: p.id || p.codigo || name,
                    nombre: name,
                    ruc: p.ruc,
                    direccion: p.domicilio_legal || p.ubicacion,
                    domicilio_legal: p.domicilio_legal,
                    contacto: p.persona_contacto,
                    persona_contacto: p.persona_contacto,
                    email: p.email,
                    telefono: p.telefono,
                    proyecto: p.proyecto,
                    ubicacion: p.ubicacion,
                    solicitante: p.solicitante,
                    domicilio_solicitante: p.domicilio_solicitante,
                  });
                }
              });
            }
          }

          setClientes(combined);
        } catch {
          setClientes([]);
        }
      } else {
        setClientes([]);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [clienteSearch]);

  const selectCliente = (nombre: string) => {
    isSelectionRef.current = true;
    setClienteSearch(nombre);
  };

  return {
    clienteSearch,
    setClienteSearch,
    clientes,
    setClientes,
    selectCliente,
    isSelectionRef,
  };
}
