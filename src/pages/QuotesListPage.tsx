import { useEffect, useState, useMemo } from 'react';
import { Download, FileText, Plus, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';

interface Quote {
  id?: number;
  numero?: string;
  year?: number;
  cliente?: string;
  ruc?: string;
  proyecto?: string;
  total?: number;
  filepath?: string;
  filename?: string;
  created_at?: string | number;
}

function getApiBaseUrl() {
  return import.meta.env.VITE_QUOTES_API_URL || 'http://localhost:8000';
}

export function QuotesListPage() {
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadQuotes() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${apiBaseUrl}/quotes`);
      if (!resp.ok) throw new Error('Error al cargar cotizaciones');
      const data = await resp.json();
      setQuotes(data.quotes || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQuotes();
  }, []);

  async function handleDownload(quote: Quote) {
    try {
      if (quote.id) {
        const resp = await fetch(`${apiBaseUrl}/quotes/${quote.id}/download`);
        if (!resp.ok) throw new Error('Error al descargar');
        const blob = await resp.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = quote.filename || `COT-${quote.year}-${quote.numero}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al descargar');
    }
  }

  function formatDate(value: string | number | undefined) {
    if (!value) return '-';
    const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
    return date.toLocaleDateString('es-PE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatCurrency(value: number | undefined) {
    if (!value) return '-';
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(value);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cotizaciones</h1>
            <p className="text-gray-500">Lista de cotizaciones generadas</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadQuotes} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            <Button onClick={() => window.location.href = '/'}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Cotización
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-4">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Número
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cliente
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Proyecto
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Cargando cotizaciones...
                  </td>
                </tr>
              ) : quotes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No hay cotizaciones registradas</p>
                  </td>
                </tr>
              ) : (
                quotes.map((quote, idx) => (
                  <tr key={quote.id || idx} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono font-medium text-blue-600">
                        COT-{quote.year}-{quote.numero}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {quote.cliente || quote.filename?.split('_')[1]?.replace('.xlsx', '') || '-'}
                      </div>
                      {quote.ruc && (
                        <div className="text-sm text-gray-500">RUC: {quote.ruc}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {quote.proyecto || '-'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(quote.total)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(quote.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(quote)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
