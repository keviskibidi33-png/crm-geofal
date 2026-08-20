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
          const [resClientes, resPlantillas] = await Promise.allSettled([
            authFetch(`${API_URL}/clientes?search=${encodeURIComponent(q)}`),
            authFetch(
              `${API_URL}/api/recepcion/plantillas/buscar?q=${encodeURIComponent(q)}`
            ),
          ]);

          const combined: ClienteItem[] = [];

          if (resClientes.status === "fulfilled" && resClientes.value.ok) {
            const json = await resClientes.value.json();
            if (Array.isArray(json.data)) {
              combined.push(...(json.data as ClienteItem[]));
            }
          }

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
                    contacto: p.persona_contacto,
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
