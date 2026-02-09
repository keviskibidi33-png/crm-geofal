import { useState, useCallback } from 'react';

export interface StageStatus {
    name: string;
    key: string;
    status: 'pendiente' | 'en_proceso' | 'completado' | 'por_implementar';
    message: string;
    date?: string;
    download_url?: string;
    data?: any;
}

export interface TracingData {
    numero_recepcion: string;
    cliente?: string;
    proyecto?: string;
    stages: StageStatus[];
    last_update: string;
}

export interface StageSummary {
    key: string;
    status: string;
}

export interface TracingSummary {
    numero_recepcion: string;
    cliente?: string;
    fecha?: string;
    stages: StageSummary[];
}

export function useTracing() {
    const [loading, setLoading] = useState(false);
    const [loadingList, setLoadingList] = useState(false);
    const [tracingData, setTracingData] = useState<TracingData | null>(null);
    const [tracingList, setTracingList] = useState<TracingSummary[]>([]);
    const [error, setError] = useState<string | null>(null);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    const fetchTracing = useCallback(async (numeroRecepcion: string) => {
        if (!numeroRecepcion) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_URL}/api/tracing/flujo/${encodeURIComponent(numeroRecepcion)}`);
            if (!response.ok) {
                if (response.status === 404) {
                    setError("No se encontró información para este número de recepción.");
                } else {
                    throw new Error(`Error del servidor: ${response.status}`);
                }
                setTracingData(null);
                return;
            }

            const data = await response.json();
            setTracingData(data);
        } catch (err: any) {
            console.error("Error fetching tracing:", err);
            setError(err.message || "Error al conectar con el servidor.");
            setTracingData(null);
        } finally {
            setLoading(false);
        }
    }, [API_URL]);

    const fetchTracingList = useCallback(async () => {
        setLoadingList(true);
        setError(null);

        try {
            const response = await fetch(`${API_URL}/api/tracing/listar`);
            if (!response.ok) {
                throw new Error(`Error al cargar la lista: ${response.status}`);
            }

            const data = await response.json();
            setTracingList(data);
        } catch (err: any) {
            console.error("Error fetching tracing list:", err);
            setError(err.message || "Error al conectar con el servidor.");
        } finally {
            setLoadingList(false);
        }
    }, [API_URL]);

    return {
        tracingData,
        tracingList,
        loading,
        loadingList,
        error,
        fetchTracing,
        fetchTracingList,
        setTracingData
    };
}
