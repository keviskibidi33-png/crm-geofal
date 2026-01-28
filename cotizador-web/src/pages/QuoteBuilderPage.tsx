import { useEffect, useMemo, useState, useCallback } from 'react';
import { Plus, Trash2, Download, Building2, FolderOpen, Save, FileText } from 'lucide-react';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { AutocompleteInput } from '../components/ui/autocomplete-input';
import { searchEnsayos, getEnsayoByCodigo, getEnsayosRelacionados, ensayosData, type EnsayoItem } from '../data/ensayos-data';

type QuoteItem = {
  codigo: string;
  descripcion: string;
  norma?: string;
  acreditado?: string;
  costo_unitario: number;
  cantidad: number;
  ensayoData?: EnsayoItem;
};

type Condicion = {
  id: string;
  texto: string;
  categoria?: string;
  orden: number;
  created_by?: string | null;
};

type QuotePayload = {
  cotizacion_numero?: string;
  fecha_emision?: string;
  fecha_solicitud?: string;
  cliente?: string;
  ruc?: string;
  contacto?: string;
  telefono_contacto?: string;
  correo?: string;
  proyecto?: string;
  ubicacion?: string;
  personal_comercial?: string;
  telefono_comercial?: string;
  correo_vendedor?: string;
  plazo_dias?: number;
  condicion_pago?: string;
  condiciones_ids?: string[];
  include_igv: boolean;
  igv_rate: number;
  items: QuoteItem[];
  template_id?: string;
  cliente_id?: string;
  proyecto_id?: string;
  user_id?: string;
};

type Cliente = {
  id: string;
  nombre: string;
  empresa?: string;
  ruc?: string;
  contacto?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
};

type Proyecto = {
  id: string;
  nombre: string;
  ubicacion?: string;
  direccion?: string;
  cliente_id: string;
  cliente_nombre?: string;
  vendedor_nombre?: string;
  vendedor_telefono?: string;
  created_at?: string;
};

type UserProfile = {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
};


function getApiBaseUrl() {
  return import.meta.env.VITE_QUOTES_API_URL || 'http://localhost:8000';
}

function getUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    user_id: urlParams.get('user_id') || '',
    email: urlParams.get('email') || '',
    name: urlParams.get('name') || '',
    access_token: urlParams.get('access_token') || '',
    phone: urlParams.get('phone') || '',
    quote_id: urlParams.get('quote_id') || '', // Para editar cotización existente
  };
}

export function QuoteBuilderPage() {
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const urlParams = useMemo(() => getUrlParams(), []);

  const [includeIgv, setIncludeIgv] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false); // Modo edición
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null); // ID de cotización siendo editada
  const [header, setHeader] = useState<Omit<QuotePayload, 'include_igv' | 'igv_rate' | 'items'>>({
    fecha_emision: new Date().toISOString().slice(0, 10),
    fecha_solicitud: new Date().toISOString().slice(0, 10),
    cliente: '',
    ruc: '',
    contacto: '',
    telefono_contacto: '',
    correo: '',
    proyecto: '',
    ubicacion: '',
    personal_comercial: urlParams.name || '',
    telefono_comercial: urlParams.phone || '',
    correo_vendedor: urlParams.email || '', // Inicializar con email del vendedor
    plazo_dias: 0,
    condicion_pago: '',
  });

  const [items, setItems] = useState<QuoteItem[]>([
    {
      codigo: '',
      descripcion: '',
      norma: '',
      acreditado: 'NO',
      costo_unitario: 0,
      cantidad: 1,
    },
  ]);
  const [showCodigoSuggestions, setShowCodigoSuggestions] = useState(false);
  const [showDescripcionSuggestions, setShowDescripcionSuggestions] = useState(false);
  const [focusedItemIndex, setFocusedItemIndex] = useState<number | null>(null);

  const [exporting, setExporting] = useState(false);
  const [quoteNumber, setQuoteNumber] = useState<string>('001');
  const [quoteYear, setQuoteYear] = useState<number>(new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('V1');

  // Client/Project state
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [selectedProyecto, setSelectedProyecto] = useState<Proyecto | null>(null);
  const [clienteSearch, setClienteSearch] = useState('');
  const [proyectoSearch, setProyectoSearch] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [showProyectoDropdown, setShowProyectoDropdown] = useState(false);
  const [showNewClienteModal, setShowNewClienteModal] = useState(false);
  const [showNewProyectoModal, setShowNewProyectoModal] = useState(false);
  const [newCliente, setNewCliente] = useState({ nombre: '', ruc: '', contacto: '', telefono: '', email: '' });
  const [newProyecto, setNewProyecto] = useState({ nombre: '', ubicacion: '' });
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // Condiciones state
  const [condiciones, setCondiciones] = useState<Condicion[]>([]);
  const [selectedCondiciones, setSelectedCondiciones] = useState<string[]>([]);
  const [showCondicionesModal, setShowCondicionesModal] = useState(false);
  const [condicionSearch, setCondicionSearch] = useState('');
  const [showNewCondicionForm, setShowNewCondicionForm] = useState(false);
  const [newCondicion, setNewCondicion] = useState({ texto: '', categoria: '' });
  const [creatingCondicion, setCreatingCondicion] = useState(false);
  const [notification, setNotification] = useState<{ show: boolean; message: string; type: 'success' | 'error' } | null>(null);
  const [condicionToDelete, setCondicionToDelete] = useState<string | null>(null);
  const [deletingCondicion, setDeletingCondicion] = useState(false);
  
  // Storage cleanup state
  const [showClearStorageModal, setShowClearStorageModal] = useState(false);
  const [clearStorageStep, setClearStorageStep] = useState<1 | 2>(1);
  const [storageConfirmText, setStorageConfirmText] = useState('');
  const [showStorageTooltip, setShowStorageTooltip] = useState(false);

  // Plantillas state
  const [plantillas, setPlantillas] = useState<any[]>([]);
  const [showPlantillasModal, setShowPlantillasModal] = useState(false);
  const [showSavePlantillaModal, setShowSavePlantillaModal] = useState(false);
  const [nuevaPlantilla, setNuevaPlantilla] = useState({ nombre: '', descripcion: '' });
  const [savingPlantilla, setSavingPlantilla] = useState(false);
  const [loadingPlantillas, setLoadingPlantillas] = useState(false);
  const [showDeletePlantillaModal, setShowDeletePlantillaModal] = useState(false);
  const [plantillaToDelete, setPlantillaToDelete] = useState<any>(null);
  const [deletePlantillaStep, setDeletePlantillaStep] = useState<1 | 2>(1);
  const [deletePlantillaConfirmText, setDeletePlantillaConfirmText] = useState('');
  const [deletingPlantilla, setDeletingPlantilla] = useState(false);
  const [plantillaSearch, setPlantillaSearch] = useState('');
  const [expandedPlantilla, setExpandedPlantilla] = useState<string | null>(null);

  // Cargar plantillas del vendedor al iniciar
  useEffect(() => {
    const vendedorId = currentUser?.id || urlParams.user_id;
    if (vendedorId) {
      fetchPlantillas();
    }
  }, [currentUser, urlParams.user_id]);

  const fetchPlantillas = async () => {
    const vendedorId = currentUser?.id || urlParams.user_id;
    if (!vendedorId) return;
    
    setLoadingPlantillas(true);
    try {
      const resp = await fetch(`${apiBaseUrl}/plantillas?vendedor_id=${vendedorId}`);
      if (resp.ok) {
        const data = await resp.json();
        console.log('Plantillas cargadas del backend:', data);
        
        // Parsear condiciones_ids de PostgreSQL array string a JS array
        const plantillasParseadas = data.map((p: any) => ({
          ...p,
          condiciones_ids: typeof p.condiciones_ids === 'string' && p.condiciones_ids.startsWith('{')
            ? p.condiciones_ids.slice(1, -1).split(',').filter(Boolean)
            : (Array.isArray(p.condiciones_ids) ? p.condiciones_ids : [])
        }));
        
        if (plantillasParseadas.length > 0) {
          console.log('Primera plantilla condiciones_ids PARSEADOS:', plantillasParseadas[0].condiciones_ids);
        }
        
        setPlantillas(plantillasParseadas);
      }
    } catch (err) {
      console.error('Error fetching plantillas:', err);
    } finally {
      setLoadingPlantillas(false);
    }
  };

  const handleSavePlantilla = async () => {
    const vendedorId = currentUser?.id || urlParams.user_id;
    
    if (!nuevaPlantilla.nombre.trim()) {
      setNotification({ show: true, message: 'El nombre es requerido', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    if (!vendedorId) {
      setNotification({ show: true, message: 'No se pudo identificar al vendedor', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    setSavingPlantilla(true);
    try {
      const payload = {
        nombre: nuevaPlantilla.nombre,
        descripcion: nuevaPlantilla.descripcion,
        vendedor_id: vendedorId,
        items: items,
        condiciones_ids: selectedCondiciones,
        plazo_dias: header.plazo_dias,
        condicion_pago: header.condicion_pago
      };

      console.log('Guardando plantilla:', payload);
      console.log('Items:', items);
      console.log('Condiciones seleccionadas:', selectedCondiciones);

      const resp = await fetch(`${apiBaseUrl}/plantillas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (resp.ok) {
        setNotification({ show: true, message: 'Plantilla guardada exitosamente', type: 'success' });
        setTimeout(() => setNotification(null), 3000);
        setShowSavePlantillaModal(false);
        setNuevaPlantilla({ nombre: '', descripcion: '' });
        fetchPlantillas();
      } else {
        throw new Error('Error al guardar plantilla');
      }
    } catch (err) {
      console.error('Error saving plantilla:', err);
      setNotification({ show: true, message: 'Error al guardar plantilla', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setSavingPlantilla(false);
    }
  };

  const handleDeletePlantilla = async () => {
    if (!plantillaToDelete) return;
    
    setDeletingPlantilla(true);
    try {
      const resp = await fetch(`${apiBaseUrl}/plantillas/${plantillaToDelete.id}`, {
        method: 'DELETE'
      });
      
      if (resp.ok) {
        setNotification({ show: true, message: 'Plantilla eliminada exitosamente', type: 'success' });
        setTimeout(() => setNotification(null), 3000);
        setShowDeletePlantillaModal(false);
        setPlantillaToDelete(null);
        setDeletePlantillaStep(1);
        setDeletePlantillaConfirmText('');
        fetchPlantillas();
      } else {
        throw new Error('Error al eliminar plantilla');
      }
    } catch (err) {
      console.error('Error deleting plantilla:', err);
      setNotification({ show: true, message: 'Error al eliminar plantilla', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setDeletingPlantilla(false);
    }
  };

  const handleLoadPlantilla = async (plantillaId: string) => {
    try {
      const resp = await fetch(`${apiBaseUrl}/plantillas/${plantillaId}`);
      if (!resp.ok) throw new Error('Error al cargar plantilla');
      
      const plantilla = await resp.json();
      console.log('Plantilla cargada:', plantilla);
      console.log('Condiciones IDs:', plantilla.condiciones_ids);
      
      // Cargar items de la plantilla
      const plantillaItems = typeof plantilla.items_json === 'string' 
        ? JSON.parse(plantilla.items_json) 
        : plantilla.items_json;
      
      setItems(plantillaItems);
      
      // Parsear condiciones_ids de PostgreSQL array string a JS array
      let condicionesIds: string[] = [];
      if (typeof plantilla.condiciones_ids === 'string' && plantilla.condiciones_ids.startsWith('{')) {
        condicionesIds = plantilla.condiciones_ids.slice(1, -1).split(',').filter(Boolean);
      } else if (Array.isArray(plantilla.condiciones_ids)) {
        condicionesIds = plantilla.condiciones_ids;
      }
      
      console.log('Condiciones parseadas:', condicionesIds);
      setSelectedCondiciones(condicionesIds);
      
      // SOLO actualizar plazo y condición de pago, NO datos del cliente
      setHeader(prev => ({
        ...prev,
        plazo_dias: plantilla.plazo_dias,
        condicion_pago: plantilla.condicion_pago
      }));
      
      // Limpiar selección de cliente y proyecto para que el vendedor los elija
      setSelectedCliente(null);
      setSelectedProyecto(null);
      setClienteSearch('');
      setProyectoSearch('');
      
      setShowPlantillasModal(false);
      setNotification({ show: true, message: `Plantilla "${plantilla.nombre}" aplicada. Selecciona el cliente y proyecto.`, type: 'success' });
      setTimeout(() => setNotification(null), 4000);
    } catch (err) {
      console.error('Error loading plantilla:', err);
      setNotification({ show: true, message: 'Error al cargar plantilla', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    }
  };

  // Auto-fill personal comercial from URL params (passed by Directus)
  useEffect(() => {
    if (urlParams.name) {
      setHeader(prev => ({
        ...prev,
        personal_comercial: urlParams.name || prev.personal_comercial,
        telefono_comercial: urlParams.phone || prev.telefono_comercial,
        correo_vendedor: urlParams.email || prev.correo_vendedor, // Autocomplete correo vendedor
      }));
      setCurrentUser({
        id: urlParams.user_id,
        first_name: urlParams.name.split(' ')[0],
        last_name: urlParams.name.split(' ').slice(1).join(' '),
        email: urlParams.email,
        phone: urlParams.phone,
      });
    }
  }, [urlParams.name, urlParams.phone]);

  // Handle phone updates from URL specifically if name matches but phone was empty
  useEffect(() => {
    if (urlParams.phone && !header.telefono_comercial) {
      setHeader(h => ({ ...h, telefono_comercial: urlParams.phone }));
    }
  }, [urlParams.phone]);

  // Cargar condiciones al inicio
  useEffect(() => {
    async function loadCondiciones() {
      try {
        const resp = await fetch(`${apiBaseUrl}/condiciones`);
        const data = await resp.json();
        setCondiciones(data.data || []);
      } catch (err) {
        console.error('Error cargando condiciones:', err);
      }
    }
    loadCondiciones();
  }, [apiBaseUrl]);

  // Cargar datos guardados desde localStorage al iniciar
  useEffect(() => {
    // Si está en modo edición, no cargar de localStorage
    if (urlParams.quote_id) return;
    
    try {
      const savedData = localStorage.getItem('cotizacion_draft');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (parsed.header) setHeader(prev => ({ ...prev, ...parsed.header }));
        if (parsed.items && parsed.items.length > 0) setItems(parsed.items);
        if (parsed.includeIgv !== undefined) setIncludeIgv(parsed.includeIgv);
        if (parsed.selectedCondiciones) setSelectedCondiciones(parsed.selectedCondiciones);
        
        // Restaurar cliente y proyecto, y actualizar los IDs en header
        if (parsed.selectedCliente) {
          setSelectedCliente(parsed.selectedCliente);
          setHeader(prev => ({ ...prev, cliente_id: parsed.selectedCliente.id }));
        }
        if (parsed.selectedProyecto) {
          setSelectedProyecto(parsed.selectedProyecto);
          setHeader(prev => ({ ...prev, proyecto_id: parsed.selectedProyecto.id }));
        }
        
        console.log('Datos cargados desde localStorage');
      }
    } catch (err) {
      console.error('Error cargando datos de localStorage:', err);
    }
  }, [urlParams.quote_id]);

  // Cargar cotización existente para editar
  useEffect(() => {
    if (!urlParams.quote_id) return;
    
    async function loadQuote() {
      try {
        const resp = await fetch(`${apiBaseUrl}/quotes/${urlParams.quote_id}`);
        if (!resp.ok) throw new Error('Error cargando cotización');
        
        const { data } = await resp.json();
        
        // Cargar header
        setHeader({
          fecha_emision: data.fecha_emision || new Date().toISOString().slice(0, 10),
          fecha_solicitud: data.fecha_solicitud || new Date().toISOString().slice(0, 10),
          cliente: data.cliente || '',
          ruc: data.ruc || '',
          contacto: data.contacto || '',
          telefono_contacto: data.telefono_contacto || '',
          correo: data.correo || '',
          proyecto: data.proyecto || '',
          ubicacion: data.ubicacion || '',
          personal_comercial: data.personal_comercial || urlParams.name || '',
          telefono_comercial: data.telefono_comercial || urlParams.phone || '',
          correo_vendedor: data.correo_vendedor || '',
          plazo_dias: data.plazo_dias || 0,
          condicion_pago: data.condicion_pago || '',
          cliente_id: data.cliente_id,
          proyecto_id: data.proyecto_id,
        });
        
        // Cargar items
        if (data.items_json && Array.isArray(data.items_json)) {
          setItems(data.items_json.map((item: any) => ({
            codigo: item.codigo || '',
            descripcion: item.descripcion || '',
            norma: item.norma || '',
            acreditado: item.acreditado || 'NO',
            costo_unitario: item.costo_unitario || 0,
            cantidad: item.cantidad || 1,
          })));
        }
        
        // Cargar configuración
        setIncludeIgv(data.include_igv !== false);
        setQuoteNumber(data.numero || '001');
        setQuoteYear(data.year || new Date().getFullYear());
        
        // Cargar condiciones
        if (data.condiciones_ids) {
          setSelectedCondiciones(data.condiciones_ids);
        }
        
        // Marcar como modo edición
        setIsEditMode(true);
        setEditingQuoteId(urlParams.quote_id);
        
        setNotification({ show: true, message: 'Cotización cargada para editar', type: 'success' });
        setTimeout(() => setNotification(null), 3000);
      } catch (err) {
        console.error('Error cargando cotización:', err);
        setNotification({ show: true, message: 'Error cargando cotización', type: 'error' });
        setTimeout(() => setNotification(null), 3000);
      }
    }
    
    loadQuote();
  }, [urlParams.quote_id, apiBaseUrl]);

  // Guardar automáticamente en localStorage cuando cambian los datos (solo si NO está editando)
  useEffect(() => {
    if (isEditMode) return; // No autoguardar cuando está editando una cotización
    
    const dataToSave = {
      header,
      items,
      includeIgv,
      selectedCondiciones,
      selectedCliente,
      selectedProyecto,
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem('cotizacion_draft', JSON.stringify(dataToSave));
  }, [header, items, includeIgv, selectedCondiciones, selectedCliente, selectedProyecto, isEditMode]);

  // Función para limpiar localStorage
  const clearLocalStorage = () => {
    localStorage.removeItem('cotizacion_draft');
    // Reset form
    setHeader({
      fecha_emision: new Date().toISOString().slice(0, 10),
      fecha_solicitud: new Date().toISOString().slice(0, 10),
      cliente: '',
      ruc: '',
      contacto: '',
      telefono_contacto: '',
      correo: '',
      proyecto: '',
      ubicacion: '',
      personal_comercial: urlParams.name || '',
      telefono_comercial: urlParams.phone || '',
      correo_vendedor: urlParams.email || '', // Mantener correo vendedor al limpiar
      plazo_dias: 0,
      condicion_pago: '',
    });
    setItems([{
      codigo: '',
      descripcion: '',
      norma: '',
      acreditado: 'NO',
      costo_unitario: 0,
      cantidad: 1,
    }]);
    setIncludeIgv(true);
    setSelectedCondiciones([]);
    setSelectedCliente(null);
    setSelectedProyecto(null);
    setClienteSearch('');
    setProyectoSearch('');
    setShowClearStorageModal(false);
    setClearStorageStep(1);
    setStorageConfirmText('');
    
    setNotification({ show: true, message: 'Datos borrados correctamente', type: 'success' });
    setTimeout(() => setNotification(null), 3000);
  };

  // Función para recargar condiciones
  async function reloadCondiciones() {
    try {
      const resp = await fetch(`${apiBaseUrl}/condiciones`);
      const data = await resp.json();
      setCondiciones(data.data || []);
    } catch (err) {
      console.error('Error recargando condiciones:', err);
    }
  }

  // Crear nueva condición
  async function createCondicion() {
    if (!newCondicion.texto.trim()) {
      setNotification({ show: true, message: 'El texto de la condición es obligatorio', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
      return;
    }

    setCreatingCondicion(true);
    try {
      const vendedorId = currentUser?.id || urlParams.user_id;
      
      const resp = await fetch(`${apiBaseUrl}/condiciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto: newCondicion.texto,
          categoria: newCondicion.categoria || 'General',
          orden: condiciones.length + 1,
          vendedor_id: vendedorId,
        }),
      });

      if (!resp.ok) throw new Error('Error creando condición');

      const data = await resp.json();
      console.log('Condición creada:', data.data);
      console.log('created_by:', data.data.created_by);
      setCondiciones(prev => [...prev, data.data]);
      setNewCondicion({ texto: '', categoria: '' });
      setShowNewCondicionForm(false);
      
      // Notificación de éxito
      setNotification({ show: true, message: 'Condición creada exitosamente', type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      console.error('Error:', err);
      setNotification({ show: true, message: 'Error al crear la condición', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setCreatingCondicion(false);
    }
  }

  // Eliminar condición
  async function deleteCondicion(id: string) {
    setDeletingCondicion(true);
    try {
      const resp = await fetch(`${apiBaseUrl}/condiciones/${id}`, {
        method: 'DELETE',
      });

      if (!resp.ok) throw new Error('Error eliminando condición');

      setCondiciones(prev => prev.filter(c => c.id !== id));
      setSelectedCondiciones(prev => prev.filter(cid => cid !== id));
      setCondicionToDelete(null);
      
      // Notificación de éxito
      setNotification({ show: true, message: 'Condición eliminada exitosamente', type: 'success' });
      setTimeout(() => setNotification(null), 3000);
    } catch (err) {
      console.error('Error:', err);
      setNotification({ show: true, message: 'Error al eliminar la condición', type: 'error' });
      setTimeout(() => setNotification(null), 3000);
    } finally {
      setDeletingCondicion(false);
    }
  }

  // Filtrar condiciones por búsqueda
  const condicionesFiltradas = useMemo(() => {
    if (!condicionSearch.trim()) return condiciones;
    
    const search = condicionSearch.toLowerCase();
    return condiciones.filter(c => 
      c.texto.toLowerCase().includes(search) ||
      (c.categoria && c.categoria.toLowerCase().includes(search))
    );
  }, [condiciones, condicionSearch]);
  useEffect(() => {
    async function loadNext() {
      try {
        setError(null);
        const resp = await fetch(`${apiBaseUrl}/quote/next-number`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fecha_emision: header.fecha_emision }),
        });
        if (!resp.ok) return;
        const json = (await resp.json()) as { number: string; year: number; token: string };
        setQuoteNumber(json.number);
        setQuoteYear(json.year);
      } catch {
        // opcional
      }
    }

    loadNext();
  }, [apiBaseUrl, header.fecha_emision]);

  const quoteToken = useMemo(() => {
    const yearSuffix = String(quoteYear).slice(-2);
    return `${quoteNumber}-${yearSuffix}`;
  }, [quoteNumber, quoteYear]);

  const subtotal = useMemo(() => {
    return items.reduce((acc, it) => acc + (Number(it.costo_unitario) || 0) * (Number(it.cantidad) || 0), 0);
  }, [items]);
  const igv = useMemo(() => (includeIgv ? subtotal * 0.18 : 0), [includeIgv, subtotal]);
  const total = useMemo(() => subtotal + igv, [subtotal, igv]);

  function updateItem(idx: number, patch: Partial<QuoteItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  // Function to add an ensayo and its related ensayos
  function addEnsayoWithRelated(idx: number, ensayo: EnsayoItem) {
    // First, update the current item
    updateItem(idx, {
      codigo: ensayo.codigo,
      descripcion: ensayo.descripcion,
      norma: ensayo.norma,
      acreditado: ensayo.acreditado,
      costo_unitario: ensayo.precio,
      ensayoData: ensayo,
    });

    // Then, add related ensayos if any
    if (ensayo.codigosRelacionados && ensayo.codigosRelacionados.length > 0) {
      const relatedEnsayos = getEnsayosRelacionados(ensayo.codigo);
      
      if (relatedEnsayos.length > 0) {
        // Always add related ensayos after the current item
        setItems((prev) => {
          const newItems: QuoteItem[] = relatedEnsayos.map(related => ({
            codigo: related.codigo,
            descripcion: related.descripcion,
            norma: related.norma,
            acreditado: related.acreditado,
            costo_unitario: related.precio,
            cantidad: 1,
            ensayoData: related,
          }));
          
          // Insert related items after the current item
          const result = [...prev];
          result.splice(idx + 1, 0, ...newItems);
          return result;
        });
      }
    }
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        codigo: '',
        descripcion: '',
        norma: '',
        acreditado: 'NO',
        costo_unitario: 0,
        cantidad: 1,
      },
    ]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  // Load condiciones from backend
  const loadCondiciones = useCallback(async () => {
    try {
      const resp = await fetch(`${apiBaseUrl}/condiciones`);
      const data = await resp.json();
      setCondiciones(data.data || []);
    } catch (err) {
      console.error('Error loading condiciones:', err);
      setCondiciones([]);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    loadCondiciones();
  }, [loadCondiciones]);

  // Search clients
  const searchClientes = useCallback(async (search: string) => {
    try {
      const resp = await fetch(`${apiBaseUrl}/clientes?search=${encodeURIComponent(search)}`);
      const data = await resp.json();
      setClientes(data.data || []);
    } catch { setClientes([]); }
  }, [apiBaseUrl]);

  // Search projects
  const searchProyectos = useCallback(async (clienteId?: string, searchStr?: string) => {
    try {
      let url = `${apiBaseUrl}/proyectos?`;
      const params = new URLSearchParams();

      const actualClienteId = clienteId || selectedCliente?.id;
      const actualSearch = searchStr !== undefined ? searchStr : proyectoSearch;

      if (actualClienteId) params.append('cliente_id', String(actualClienteId));
      if (actualSearch) params.append('search', actualSearch);

      url += params.toString();
      const resp = await fetch(url);
      const data = await resp.json();
      setProyectos(data.data || []);
    } catch { setProyectos([]); }
  }, [apiBaseUrl, proyectoSearch, selectedCliente?.id]);

  // Select client
  async function selectCliente(c: Cliente) {
    setSelectedCliente(c);
    setClienteSearch(c.nombre); // Keep search text updated
    setShowClienteDropdown(false);
    setHeader((prev) => ({
      ...prev,
      cliente: c.nombre, // The backend already maps empresa to nombre if available
      ruc: c.ruc || '',
      contacto: c.contacto || '',
      telefono_contacto: c.telefono || '',
      correo: c.email || '',
    }));
    setSelectedProyecto(null); // Clear selected project when client changes
    setProyectoSearch(''); // Clear project search when client changes
    searchProyectos(c.id);
  }

  // Select project
  async function selectProyecto(p: Proyecto) {
    setSelectedProyecto(p);
    setProyectoSearch(p.nombre); // Keep search text updated
    setShowProyectoDropdown(false);
    setHeader((prev) => ({
      ...prev,
      proyecto: p.nombre,
      ubicacion: p.ubicacion || p.direccion || '',
      // Mantener los datos del vendedor actual, no sobrescribir con el vendedor que creó el proyecto
    }));
  }

  // Create new client
  async function createNewCliente() {
    if (!newCliente.nombre.trim()) return;
    try {
      const resp = await fetch(`${apiBaseUrl}/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newCliente,
          vendedor_id: urlParams.user_id || currentUser?.id,
        }),
      });
      const data = await resp.json();
      if (data.data) {
        selectCliente(data.data); // Use the correct handler
        setShowNewClienteModal(false);
        setNewCliente({ nombre: '', ruc: '', contacto: '', telefono: '', email: '' });
      }
    } catch (e) { console.error(e); }
  }

  // Create new project
  async function createNewProyecto() {
    if (!newProyecto.nombre.trim() || !selectedCliente) return;
    try {
      const resp = await fetch(`${apiBaseUrl}/proyectos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProyecto,
          cliente_id: selectedCliente.id,
          ubicacion: newProyecto.ubicacion,
          vendedor_id: urlParams.user_id || currentUser?.id,
        }),
      });
      const data = await resp.json();
      if (data.data) {
        selectProyecto(data.data); // Use the correct handler
        setShowNewProyectoModal(false);
        setNewProyecto({ nombre: '', ubicacion: '' });
      }
    } catch (e) { console.error(e); }
  }

  // Load clients on search
  useEffect(() => {
    if (clienteSearch.length >= 2) {
      searchClientes(clienteSearch);
    }
  }, [clienteSearch, searchClientes]);

  // Load projects on search
  useEffect(() => {
    if (proyectoSearch.length >= 2 && !selectedProyecto) {
      searchProyectos(selectedCliente?.id, proyectoSearch);
    } else if (proyectoSearch.length === 0 && selectedCliente) {
      // Refresh list if search cleared but client selected
      searchProyectos(selectedCliente.id, '');
    }
  }, [proyectoSearch, searchProyectos, selectedProyecto, selectedCliente]);

  async function onExport() {
    setExporting(true);
    setError(null);
    try {
      const payload: QuotePayload = {
        ...header,
        correo_vendedor: urlParams.email || '',
        cotizacion_numero: quoteNumber || undefined,
        condiciones_ids: selectedCondiciones,
        include_igv: includeIgv,
        igv_rate: 0.18,
        items,
        template_id: selectedTemplate,
        user_id: urlParams.user_id || undefined,
        proyecto_id: selectedProyecto?.id,
        cliente_id: selectedCliente?.id,
      };

      // Si está en modo edición, actualizar en lugar de crear
      const endpoint = isEditMode && editingQuoteId 
        ? `${apiBaseUrl}/quotes/${editingQuoteId}`
        : `${apiBaseUrl}/export/xlsx`;
      
      const method = isEditMode && editingQuoteId ? 'PUT' : 'POST';

      const resp = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || `HTTP ${resp.status}`);
      }

      // Si es actualización, manejar respuesta JSON
      if (isEditMode && editingQuoteId) {
        const result = await resp.json();
        
        // Signal CRM that quote was updated
        if (window.parent !== window) {
          window.parent.postMessage({ type: 'QUOTE_UPDATED', quote_id: editingQuoteId }, '*');
        }
        
        setNotification({ show: true, message: 'Cotización actualizada exitosamente', type: 'success' });
        setTimeout(() => setNotification(null), 3000);
        
        // Opcional: cerrar el iframe o redirigir
        setTimeout(() => {
          if (window.parent !== window) {
            window.parent.postMessage({ type: 'CLOSE_IFRAME' }, '*');
          }
        }, 1500);
        
        return;
      }

      // Si es creación nueva, manejar descarga de archivo
      const blob = await resp.blob();
      console.log('Blob created:', blob.size, blob.type);

      const contentDisposition = resp.headers.get('Content-Disposition');
      console.log('Content-Disposition header:', contentDisposition);

      let filename = 'cotizacion_v1_1.xlsx';

      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";]+)"?/);
        if (match) {
          filename = match[1];
          console.log('Extracted filename:', filename);
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      a.setAttribute('download', filename);

      console.log('Triggering download for (v1.2):', filename);
      document.body.appendChild(a);
      a.click();

      // Signal CRM that quote was created
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'QUOTE_CREATED' }, '*');
      }

      // Limpiar localStorage automáticamente después de descargar
      setTimeout(() => {
        localStorage.removeItem('cotizacion_draft');
        
        // Resetear formulario a estado inicial
        setHeader({
          fecha_emision: new Date().toISOString().slice(0, 10),
          fecha_solicitud: new Date().toISOString().slice(0, 10),
          cliente: '',
          ruc: '',
          contacto: '',
          telefono_contacto: '',
          correo: '',
          proyecto: '',
          ubicacion: '',
          personal_comercial: urlParams.name || '',
          telefono_comercial: urlParams.phone || '',
          correo_vendedor: urlParams.email || '', // Mantener correo vendedor al resetear
          plazo_dias: 0,
          condicion_pago: '',
        });
        setItems([{
          codigo: '',
          descripcion: '',
          norma: '',
          acreditado: 'NO',
          costo_unitario: 0,
          cantidad: 1,
        }]);
        setIncludeIgv(true);
        setSelectedCondiciones([]);
        setSelectedCliente(null);
        setSelectedProyecto(null);
        setClienteSearch('');
        setProyectoSearch('');
        
        // Notificación de nueva cotización lista
        setNotification({ show: true, message: 'Cotización descargada. Formulario reiniciado para nueva cotización', type: 'success' });
        setTimeout(() => setNotification(null), 4000);
      }, 1500); // Esperar 1.5s para asegurar que la descarga inició

      // Dejamos el objeto URL vivo por 1 minuto
      setTimeout(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
        window.URL.revokeObjectURL(url);
        console.log('Download cleanup done (v1.2)');
      }, 60000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error exportando');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              Cotizaciones <span className="text-xs font-normal text-slate-400">v1.4</span>
              {isEditMode && (
                <span className="ml-3 px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                  EDITANDO COT-{quoteNumber}-{String(quoteYear).slice(-2)}
                </span>
              )}
            </h1>
            <p className="text-sm text-slate-500">
              {isEditMode ? 'Modificando cotización existente' : 'Genera cotizaciones para Muestra de Suelo y Agregado.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => setShowPlantillasModal(true)}
              disabled={isEditMode}
            >
              <FileText className="mr-2 h-4 w-4" />
              Cargar Plantilla
            </Button>
            <Button 
              variant="outline"
              onClick={() => setShowSavePlantillaModal(true)}
              disabled={items.length === 0 || isEditMode}
            >
              <Save className="mr-2 h-4 w-4" />
              Guardar como Plantilla
            </Button>
            <div className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-700">
              <span>N° Cotización:</span>
              <input
                type="text"
                value={quoteNumber}
                onChange={(e) => setQuoteNumber(e.target.value.replace(/\D/g, '').slice(0, 5) || '001')}
                className="w-20 rounded border border-slate-300 px-2 py-1 text-center font-semibold focus:border-blue-500 focus:outline-none"
                maxLength={5}
              />
              <span className="font-semibold">-{String(quoteYear).slice(-2)}</span>
            </div>
            <Button onClick={onExport} disabled={exporting}>
              <Download className="mr-2 h-4 w-4" />
              {exporting ? (isEditMode ? 'Actualizando…' : 'Exportando…') : (isEditMode ? 'Actualizar Cotización' : 'Exportar Excel')}
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="rounded-lg border border-border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Datos de la cotización</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Cliente Autocomplete */}
            <div className="space-y-2 relative">
              <Label className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Cliente / Empresa</Label>
              <Input
                value={clienteSearch}
                onChange={(e) => { setClienteSearch(e.target.value); setShowClienteDropdown(true); }}
                onFocus={() => { if (clientes.length > 0) setShowClienteDropdown(true); }}
                placeholder="Buscar cliente..."
              />
              {showClienteDropdown && clientes.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-auto">
                  {clientes.map(c => (
                    <div key={c.id} onClick={() => selectCliente(c)} className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm">
                      <div className="font-medium">{c.nombre}</div>
                      {c.ruc && <div className="text-xs text-slate-500">RUC: {c.ruc}</div>}
                    </div>
                  ))}
                  <div onClick={() => { setShowNewClienteModal(true); setShowClienteDropdown(false); }} className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm text-blue-600 border-t">
                    <Plus className="inline h-3 w-3 mr-1" /> Crear nuevo cliente
                  </div>
                </div>
              )}
              {clienteSearch.length >= 2 && clientes.length === 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg p-3">
                  <div onClick={() => { setNewCliente(p => ({ ...p, nombre: clienteSearch })); setShowNewClienteModal(true); }} className="text-sm text-blue-600 cursor-pointer">
                    <Plus className="inline h-3 w-3 mr-1" /> Crear "{clienteSearch}"
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>RUC</Label>
              <Input value={header.ruc || ''} onChange={(e) => setHeader((p) => ({ ...p, ruc: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Contacto</Label>
              <Input value={header.contacto || ''} onChange={(e) => setHeader((p) => ({ ...p, contacto: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Teléfono de contacto</Label>
              <Input value={header.telefono_contacto || ''} onChange={(e) => setHeader((p) => ({ ...p, telefono_contacto: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Correo</Label>
              <Input value={header.correo || ''} onChange={(e) => setHeader((p) => ({ ...p, correo: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Fecha de solicitud</Label>
              <Input
                type="date"
                value={header.fecha_solicitud || ''}
                onChange={(e) => setHeader((p) => ({ ...p, fecha_solicitud: e.target.value }))}
              />
            </div>

            {/* Proyecto Autocomplete */}
            <div className="space-y-2 relative">
              <Label className="flex items-center gap-2"><FolderOpen className="h-4 w-4" /> Proyecto</Label>
              <Input
                value={proyectoSearch}
                onChange={(e) => { setProyectoSearch(e.target.value); setShowProyectoDropdown(true); }}
                onFocus={() => { if (selectedCliente) setShowProyectoDropdown(true); }}
                onClick={() => { if (selectedCliente) setShowProyectoDropdown(true); }}
                placeholder={selectedCliente ? "Buscar proyecto..." : "Selecciona cliente primero"}
                disabled={!selectedCliente}
              />
              {showProyectoDropdown && selectedCliente && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-auto">
                  {proyectos.map(p => (
                    <div key={p.id} onClick={() => selectProyecto(p)} className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{p.nombre}</span>
                        {p.created_at && (
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                            {new Date(p.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {p.ubicacion && <div className="text-xs text-slate-500">{p.ubicacion}</div>}
                    </div>
                  ))}
                  <div onClick={() => { setShowNewProyectoModal(true); setShowProyectoDropdown(false); }} className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm text-blue-600 border-t font-medium sticky bottom-0 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                    <Plus className="inline h-3 w-3 mr-1" /> Crear nuevo proyecto
                  </div>
                </div>
              )}
              {selectedCliente && proyectoSearch.length >= 2 && proyectos.length === 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg p-3">
                  <div onClick={() => { setNewProyecto(p => ({ ...p, nombre: proyectoSearch })); setShowNewProyectoModal(true); }} className="text-sm text-blue-600 cursor-pointer">
                    <Plus className="inline h-3 w-3 mr-1" /> Crear "{proyectoSearch}"
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Ubicación</Label>
              <Input value={header.ubicacion || ''} onChange={(e) => setHeader((p) => ({ ...p, ubicacion: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Fecha de emisión</Label>
              <Input
                type="date"
                value={header.fecha_emision || ''}
                onChange={(e) => setHeader((p) => ({ ...p, fecha_emision: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Personal comercial</Label>
              <Input
                value={header.personal_comercial || ''}
                onChange={(e) => setHeader((p) => ({ ...p, personal_comercial: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono comercial</Label>
              <Input
                value={header.telefono_comercial || ''}
                onChange={(e) => setHeader((p) => ({ ...p, telefono_comercial: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Correo vendedor</Label>
              <Input
                type="email"
                value={header.correo_vendedor || ''}
                onChange={(e) => setHeader((p) => ({ ...p, correo_vendedor: e.target.value }))}
                placeholder="vendedor@geofal.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Plazo estimado (días)</Label>
              <Input
                type="number"
                min="0"
                value={header.plazo_dias || 0}
                onChange={(e) => setHeader((p) => ({ ...p, plazo_dias: Number(e.target.value) }))}
                placeholder="0 = texto por defecto"
              />
            </div>

            <div className="space-y-2">
              <Label>Condiciones de pago</Label>
              <select
                value={header.condicion_pago || ''}
                onChange={(e) => setHeader((p) => ({ ...p, condicion_pago: e.target.value }))}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Seleccionar...</option>
                <option value="valorizacion">Valorización mensual</option>
                <option value="adelantado">Adelantado</option>
                <option value="50_adelanto">50% Adelanto y saldo previo a entrega</option>
                <option value="credito_7">Crédito a 7 días</option>
                <option value="credito_15">Crédito a 15 días</option>
                <option value="credito_30">Crédito a 30 días</option>
              </select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Condiciones Específicas</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowCondicionesModal(true)}
                  className="h-7 text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" /> Gestionar
                </Button>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-md p-3">
                {condiciones.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Cargando condiciones...</p>
                ) : (
                  condiciones.map((cond) => (
                    <label key={cond.id} className="flex items-start gap-2 cursor-pointer hover:bg-slate-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={selectedCondiciones.includes(cond.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCondiciones(prev => [...prev, cond.id]);
                          } else {
                            setSelectedCondiciones(prev => prev.filter(id => id !== cond.id));
                          }
                        }}
                        className="mt-0.5 rounded border-slate-300"
                      />
                      <span className="text-xs text-slate-700">{cond.texto}</span>
                    </label>
                  ))
                )}
              </div>
              {selectedCondiciones.length > 0 && (
                <p className="text-xs text-blue-600">
                  {selectedCondiciones.length} condición(es) seleccionada(s)
                </p>
              )}
            </div>

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <div className="text-sm font-medium text-slate-900">IGV</div>
                <div className="text-xs text-slate-500">Activar / desactivar</div>
              </div>
              <Switch checked={includeIgv} onCheckedChange={setIncludeIgv} />
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-border bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Ítems</h2>
            <Button variant="outline" onClick={addItem}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar ítem
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-slate-600">
                  <th className="py-2 pr-3">Código</th>
                  <th className="py-2 pr-3">Descripción</th>
                  <th className="py-2 pr-3">Norma</th>
                  <th className="py-2 pr-3">Acreditado</th>
                  <th className="py-2 pr-3">Costo unitario</th>
                  <th className="py-2 pr-3">Cantidad</th>
                  <th className="py-2 pr-3">Parcial</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const parcial = (Number(it.costo_unitario) || 0) * (Number(it.cantidad) || 0);
                  return (
                    <tr key={idx} className="border-b border-border last:border-b-0">
                      <td className="py-2 pr-3 min-w-[120px]">
                        <AutocompleteInput
                          value={it.codigo}
                          onChange={(value) => updateItem(idx, { codigo: value })}
                          onSelect={(ensayo: EnsayoItem) => {
                            addEnsayoWithRelated(idx, ensayo);
                          }}
                          suggestions={ensayosData}
                          placeholder="Código"
                          displayField="descripcion"
                          codeField="codigo"
                        />
                      </td>
                      <td className="py-2 pr-3 min-w-[250px]">
                        <AutocompleteInput
                          value={it.descripcion}
                          onChange={(value) => updateItem(idx, { descripcion: value })}
                          onSelect={(ensayo: EnsayoItem) => {
                            addEnsayoWithRelated(idx, ensayo);
                          }}
                          suggestions={ensayosData}
                          placeholder="Descripción"
                          displayField="descripcion"
                          codeField="codigo"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input value={it.norma || ''} onChange={(e) => updateItem(idx, { norma: e.target.value })} />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          value={it.acreditado || ''}
                          onChange={(e) => updateItem(idx, { acreditado: e.target.value })}
                          placeholder="SI/NO"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          value={String(it.costo_unitario)}
                          onChange={(e) => updateItem(idx, { costo_unitario: Number(e.target.value) })}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          value={String(it.cantidad)}
                          onChange={(e) => updateItem(idx, { cantidad: Number(e.target.value) })}
                        />
                      </td>
                      <td className="py-2 pr-3 text-right font-medium text-slate-900">
                        {parcial.toFixed(2)}
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(idx)}
                          disabled={items.length <= 1}
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-sm rounded-md border border-border p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-medium text-slate-900">S/. {subtotal.toFixed(2)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-slate-600">IGV (18%)</span>
                <span className="font-medium text-slate-900">S/. {igv.toFixed(2)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm">
                <span className="text-slate-600 font-semibold">Total</span>
                <span className="font-bold text-blue-600 text-lg">S/. {total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-xs text-slate-500">
          API: <span className="font-mono">{apiBaseUrl}</span>
        </div>
      </div>

      {/* Modal: New Cliente */}
      {showNewClienteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border-2 border-slate-100 rounded-xl p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Nuevo Cliente</h3>
            <p className="text-sm text-slate-500 mb-6">Añade los datos de la empresa y contacto.</p>
            <div className="space-y-3">
              <div>
                <Label>Nombre / Empresa *</Label>
                <Input value={newCliente.nombre} onChange={e => setNewCliente(p => ({ ...p, nombre: e.target.value }))} />
              </div>
              <div>
                <Label>RUC</Label>
                <Input value={newCliente.ruc} onChange={e => setNewCliente(p => ({ ...p, ruc: e.target.value }))} />
              </div>
              <div>
                <Label>Contacto</Label>
                <Input value={newCliente.contacto} onChange={e => setNewCliente(p => ({ ...p, contacto: e.target.value }))} />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input value={newCliente.telefono} onChange={e => setNewCliente(p => ({ ...p, telefono: e.target.value }))} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={newCliente.email} onChange={e => setNewCliente(p => ({ ...p, email: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowNewClienteModal(false)}>Cancelar</Button>
              <Button onClick={createNewCliente}>Crear Cliente</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Proyecto */}
      {showNewProyectoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border-2 border-slate-100 rounded-xl p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Nuevo Proyecto</h3>
            <p className="text-sm text-slate-500 mb-2">Cliente: <span className="font-semibold text-blue-600">{selectedCliente?.nombre}</span></p>
            <p className="text-xs text-slate-400 mb-6">El proyecto se vinculará automáticamente a este cliente.</p>
            <div className="space-y-3">
              <div>
                <Label>Nombre del Proyecto *</Label>
                <Input value={newProyecto.nombre} onChange={e => setNewProyecto(p => ({ ...p, nombre: e.target.value }))} />
              </div>
              <div>
                <Label>Ubicación</Label>
                <Input value={newProyecto.ubicacion} onChange={e => setNewProyecto(p => ({ ...p, ubicacion: e.target.value }))} placeholder="Ubicación de la obra" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowNewProyectoModal(false)}>Cancelar</Button>
              <Button onClick={createNewProyecto}>Crear Proyecto</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Gestionar Condiciones */}
      {showCondicionesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border-2 border-slate-100 rounded-xl p-8 w-full max-w-3xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[85vh] flex flex-col">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Gestionar Condiciones Específicas</h3>
            <p className="text-sm text-slate-500 mb-4">Selecciona las condiciones que aparecerán en la cotización.</p>
            
            {/* Buscador y botón crear en línea */}
            <div className="flex gap-2 mb-4">
              <Input
                type="text"
                placeholder="Buscar condiciones..."
                value={condicionSearch}
                onChange={(e) => setCondicionSearch(e.target.value)}
                className="flex-1"
              />
              <Button 
                type="button"
                size="sm"
                onClick={() => {
                  setShowNewCondicionForm(true);
                  setShowCondicionesModal(false);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white shrink-0 px-3"
              >
                <Plus className="h-4 w-4 mr-1.5" /> Nueva
              </Button>
            </div>

            {/* Lista de condiciones con scroll */}
            <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-2 min-h-[200px]">
              {condicionesFiltradas.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  {condicionSearch ? 'No se encontraron condiciones' : 'No hay condiciones disponibles'}
                </p>
              ) : (
                condicionesFiltradas.map((cond) => (
                  <label key={cond.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm transition-all duration-150 group cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCondiciones.includes(cond.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCondiciones(prev => [...prev, cond.id]);
                        } else {
                          setSelectedCondiciones(prev => prev.filter(id => id !== cond.id));
                        }
                      }}
                      className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="flex-1">
                      <span className="text-sm text-slate-700">{cond.texto}</span>
                      {cond.categoria && (
                        <span className="ml-2 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {cond.categoria}
                        </span>
                      )}
                    </div>
                    {/* Solo mostrar botón eliminar si la condición fue creada por un usuario */}
                    {cond.created_by && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setCondicionToDelete(cond.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition p-1"
                        title="Eliminar condición"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </label>
                ))
              )}
            </div>

            {/* Footer del modal */}
            <div className="sticky bottom-0 flex items-center justify-between pt-4 pb-2 px-1 border-t-2 border-slate-300 bg-white shrink-0 mt-auto shadow-[0_-4px_12px_-2px_rgba(0,0,0,0.08)]">
              <p className="text-sm font-semibold text-slate-800">
                <span className="text-blue-600">{selectedCondiciones.length}</span> de {condiciones.length} seleccionada(s)
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowCondicionesModal(false);
                    setCondicionSearch('');
                    setShowNewCondicionForm(false);
                    setNewCondicion({ texto: '', categoria: '' });
                  }}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={() => {
                    setShowCondicionesModal(false);
                    setCondicionSearch('');
                    setShowNewCondicionForm(false);
                    setNewCondicion({ texto: '', categoria: '' });
                  }}
                >
                  Confirmar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Eliminación */}
      {condicionToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border-2 border-red-100 rounded-xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">¿Eliminar condición?</h3>
            <p className="text-sm text-slate-600 mb-4">
              Esta acción no se puede deshacer. La condición será eliminada permanentemente.
            </p>
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setCondicionToDelete(null)}
                disabled={deletingCondicion}
              >
                Cancelar
              </Button>
              <Button 
                onClick={() => condicionToDelete && deleteCondicion(condicionToDelete)}
                disabled={deletingCondicion}
                className="bg-red-600 hover:bg-red-700"
              >
                {deletingCondicion ? 'Eliminando...' : 'Eliminar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nueva Condición */}
      {showNewCondicionForm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border-2 border-blue-200 rounded-xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Plus className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">Nueva Condición</h3>
                <p className="text-sm text-slate-600">
                  Crea una nueva condición que podrás reutilizar en futuras cotizaciones.
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <Label className="text-sm font-medium mb-2 block">Texto de la condición *</Label>
                <textarea
                  value={newCondicion.texto}
                  onChange={(e) => setNewCondicion(p => ({ ...p, texto: e.target.value }))}
                  placeholder="Ej: El cliente deberá proporcionar..."
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm min-h-[100px] focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                  autoFocus
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Categoría (opcional)</Label>
                <Input
                  value={newCondicion.categoria}
                  onChange={(e) => setNewCondicion(p => ({ ...p, categoria: e.target.value }))}
                  placeholder="Ej: Ensayos, Logística, Pagos, etc."
                  className="text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Usa categorías para organizar mejor tus condiciones
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowNewCondicionForm(false);
                  setNewCondicion({ texto: '', categoria: '' });
                  setShowCondicionesModal(true);
                }}
                disabled={creatingCondicion}
              >
                Cancelar
              </Button>
              <Button 
                onClick={async () => {
                  await createCondicion();
                  if (!creatingCondicion) {
                    setShowCondicionesModal(true);
                  }
                }}
                disabled={creatingCondicion || !newCondicion.texto.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {creatingCondicion ? 'Creando...' : 'Crear Condición'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Notificación flotante */}
      {notification?.show && (
        <div className={`fixed top-4 right-4 z-[70] animate-in slide-in-from-top-2 duration-300 ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-2`}>
          {notification.type === 'success' ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span className="font-medium">{notification.message}</span>
        </div>
      )}

      {/* Botón flotante de limpiar storage */}
      <div 
        className="fixed bottom-4 right-4 z-50"
        onMouseEnter={() => setShowStorageTooltip(true)}
        onMouseLeave={() => setShowStorageTooltip(false)}
      >
        {/* Tooltip desplegable */}
        {showStorageTooltip && (
          <div className="absolute bottom-full right-0 mb-2 w-72">
            <div className="bg-slate-800 text-white rounded-lg shadow-xl p-3 border border-slate-600">
              <div className="flex items-start gap-2 mb-2">
                <svg className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <h4 className="font-semibold text-xs mb-1">Limpiar Datos</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Elimina el borrador guardado automáticamente.
                  </p>
                </div>
              </div>
              <div className="bg-red-900/30 border border-red-700/50 rounded px-2 py-1.5">
                <p className="text-xs text-red-200">
                  ⚠️ Acción irreversible
                </p>
              </div>
              {/* Flecha del tooltip */}
              <div className="absolute bottom-0 right-4 translate-y-1/2 w-2 h-2 bg-slate-800 border-r border-b border-slate-600 rotate-45"></div>
            </div>
          </div>
        )}
        
        {/* Botón de basura - discreto */}
        <button
          onClick={() => setShowClearStorageModal(true)}
          className="w-11 h-11 bg-slate-600 hover:bg-red-600 text-white rounded-full shadow-lg transition-colors duration-200 flex items-center justify-center opacity-60 hover:opacity-100"
          aria-label="Limpiar datos guardados"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Modal: Limpiar Storage - Confirmación 2 pasos */}
      {showClearStorageModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border-2 border-red-200 rounded-xl p-6 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            {clearStorageStep === 1 ? (
              <>
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <Trash2 className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">¿Eliminar datos guardados?</h3>
                    <p className="text-sm text-slate-600">
                      Esta acción eliminará toda la información de la cotización actual guardada en tu navegador.
                    </p>
                  </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-semibold text-red-900 mb-2 flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Se perderán los siguientes datos:
                  </h4>
                  <ul className="text-xs text-red-800 space-y-1 ml-6 list-disc">
                    <li>Información del cliente y proyecto seleccionados</li>
                    <li>Todos los ítems agregados a la cotización</li>
                    <li>Condiciones específicas seleccionadas</li>
                    <li>Configuración de plazo y condiciones de pago</li>
                    <li>Fechas y datos del encabezado</li>
                  </ul>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
                  <p className="text-xs text-blue-800">
                    <strong>💡 Recomendación:</strong> Si solo deseas crear una cotización nueva, no es necesario limpiar los datos. Simplemente descarga la cotización actual y modifica los campos necesarios.
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowClearStorageModal(false);
                      setClearStorageStep(1);
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={() => setClearStorageStep(2)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Continuar
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-red-900 mb-1">Confirmación Final</h3>
                    <p className="text-sm text-slate-600 mb-4">
                      Para confirmar que deseas eliminar todos los datos, escribe <strong className="text-red-600">ELIMINAR</strong> en el campo de abajo:
                    </p>
                  </div>
                </div>

                <Input
                  value={storageConfirmText}
                  onChange={(e) => setStorageConfirmText(e.target.value)}
                  placeholder="Escribe ELIMINAR"
                  className="mb-4 text-center font-semibold"
                  autoFocus
                />

                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowClearStorageModal(false);
                      setClearStorageStep(1);
                      setStorageConfirmText('');
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={clearLocalStorage}
                    disabled={storageConfirmText !== 'ELIMINAR'}
                    className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Eliminar Todo
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal: Cargar Plantilla */}
      {showPlantillasModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Cargar Plantilla</h2>
              <p className="text-sm text-slate-600 mb-3">Selecciona una plantilla para aplicar su configuración completa</p>
              
              {/* Buscador de plantillas */}
              <div className="relative">
                <input
                  type="text"
                  value={plantillaSearch}
                  onChange={(e) => setPlantillaSearch(e.target.value)}
                  placeholder="Buscar por nombre, descripción o código de ensayo..."
                  className="w-full px-4 py-2 pl-10 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <svg className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {loadingPlantillas ? (
                <div className="text-center py-12 text-slate-500">
                  <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                  <p>Cargando plantillas...</p>
                </div>
              ) : plantillas.filter(p => {
                const searchLower = plantillaSearch.toLowerCase();
                const items = Array.isArray(p.items_json) ? p.items_json : JSON.parse(p.items_json || '[]');
                const itemsText = items.map((item: any) => `${item.codigo} ${item.descripcion}`).join(' ').toLowerCase();
                return p.nombre.toLowerCase().includes(searchLower) ||
                       (p.descripcion || '').toLowerCase().includes(searchLower) ||
                       itemsText.includes(searchLower);
              }).length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500 mb-1 font-medium">
                    {plantillaSearch ? 'No se encontraron plantillas' : 'No hay plantillas guardadas'}
                  </p>
                  <p className="text-sm text-slate-400">
                    {plantillaSearch ? 'Intenta con otros términos de búsqueda' : 'Crea una cotización y guárdala como plantilla'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 p-6">
                  {plantillas.filter(p => {
                    const searchLower = plantillaSearch.toLowerCase();
                    const items = Array.isArray(p.items_json) ? p.items_json : JSON.parse(p.items_json || '[]');
                    const itemsText = items.map((item: any) => `${item.codigo} ${item.descripcion}`).join(' ').toLowerCase();
                    return p.nombre.toLowerCase().includes(searchLower) ||
                           (p.descripcion || '').toLowerCase().includes(searchLower) ||
                           itemsText.includes(searchLower);
                  }).map((plantilla) => {
                    const items = Array.isArray(plantilla.items_json) 
                      ? plantilla.items_json 
                      : JSON.parse(plantilla.items_json || '[]');
                    const itemsCount = items.length;
                    const condicionesCount = Array.isArray(plantilla.condiciones_ids) 
                      ? plantilla.condiciones_ids.length 
                      : 0;
                    const plantillaCondiciones = condicionesCount > 0 
                      ? condiciones.filter(c => plantilla.condiciones_ids?.includes(c.id))
                      : [];
                    const isExpanded = expandedPlantilla === plantilla.id;
                    
                    // Debug condiciones
                    if (isExpanded && condicionesCount > 0) {
                      console.log('Plantilla expandida:', plantilla.nombre);
                      console.log('condiciones_ids de plantilla:', plantilla.condiciones_ids);
                      console.log('Condiciones disponibles:', condiciones.length);
                      console.log('Condiciones filtradas:', plantillaCondiciones.length);
                      console.log('Condiciones filtradas:', plantillaCondiciones);
                    }
                    
                    // Calcular total de la plantilla
                    const totalPlantilla = items.reduce((sum: number, item: any) => 
                      sum + ((item.cantidad || 0) * (item.costo_unitario || item.precio_unitario || 0)), 0
                    );

                    return (
                      <div
                        key={plantilla.id}
                        className={`border rounded-lg transition-all relative ${
                          isExpanded 
                            ? 'border-blue-500 shadow-lg' 
                            : 'border-slate-200 hover:border-blue-400'
                        }`}
                      >
                        {/* Header de la plantilla */}
                        <div className="p-4 group">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 pr-8">
                              <h3 className="font-semibold text-slate-900 mb-1">{plantilla.nombre}</h3>
                              {plantilla.descripcion && (
                                <p className="text-sm text-slate-600 mb-2">{plantilla.descripcion}</p>
                              )}
                            </div>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">
                              {plantilla.veces_usada || 0} usos
                            </span>
                          </div>

                          {/* Resumen rápido */}
                          <div className="space-y-2 mb-3">
                            <div className="flex items-center gap-4 text-xs text-slate-600">
                              <span className="flex items-center gap-1 font-medium">
                                <FileText className="h-3.5 w-3.5 text-blue-500" />
                                {itemsCount} ensayo{itemsCount !== 1 ? 's' : ''}
                              </span>
                              {plantilla.plazo_dias && (
                                <span className="flex items-center gap-1">
                                  📅 {plantilla.plazo_dias} días
                                </span>
                              )}
                              {plantilla.condicion_pago && (
                                <span className="flex items-center gap-1">
                                  💳 {plantilla.condicion_pago}
                                </span>
                              )}
                              <span className="flex items-center gap-1 font-semibold text-slate-700">
                                💰 S/ {totalPlantilla.toFixed(2)}
                              </span>
                            </div>

                            {/* Preview de condiciones */}
                            {condicionesCount > 0 && !isExpanded && (
                              <div className="text-xs text-slate-600">
                                <span className="font-medium">✓ {condicionesCount} condición{condicionesCount !== 1 ? 'es' : ''} específica{condicionesCount !== 1 ? 's' : ''}</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="text-xs text-slate-400">
                              Creada: {new Date(plantilla.created_at).toLocaleDateString('es-PE', { 
                                day: '2-digit', 
                                month: 'short', 
                                year: 'numeric' 
                              })}
                            </div>
                            
                            {/* Botón expandir/colapsar */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedPlantilla(isExpanded ? null : plantilla.id);
                              }}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                            >
                              {isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
                              <svg 
                                className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                                fill="none" 
                                stroke="currentColor" 
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        {/* Detalles expandibles */}
                        {isExpanded && (
                          <div className="border-t border-slate-200 bg-slate-50">
                            {/* Lista detallada de ensayos */}
                            <div className="p-4">
                              <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                <FileText className="h-4 w-4 text-blue-600" />
                                Ensayos incluidos ({itemsCount})
                              </h4>
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {items.map((item: any, idx: number) => (
                                  <div 
                                    key={idx} 
                                    className="bg-white border border-slate-200 rounded p-3 text-xs"
                                  >
                                    <div className="flex items-start justify-between mb-1">
                                      <div className="flex-1">
                                        <span className="font-mono text-blue-600 font-semibold">{item.codigo}</span>
                                        <span className="text-slate-400 mx-2">•</span>
                                        <span className="text-slate-700">{item.descripcion}</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-4 text-slate-600 mt-2">
                                      {item.categoria && (
                                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-medium">
                                          {item.categoria}
                                        </span>
                                      )}
                                      <span>Cant: <strong>{item.cantidad}</strong></span>
                                      <span>P.U: <strong>S/ {(item.costo_unitario || item.precio_unitario || 0).toFixed(2)}</strong></span>
                                      <span className="ml-auto font-semibold text-slate-900">
                                        Subtotal: S/ {((item.cantidad || 0) * (item.costo_unitario || item.precio_unitario || 0)).toFixed(2)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Condiciones específicas detalladas */}
                            {condicionesCount > 0 && (
                              <div className="px-4 pb-4">
                                <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                  <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Condiciones específicas ({condicionesCount})
                                </h4>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                  {plantillaCondiciones.map((cond: any) => (
                                    <div 
                                      key={cond.id} 
                                      className="bg-white border border-slate-200 rounded p-3 text-xs"
                                    >
                                      <div className="flex items-start gap-2">
                                        <div className="flex-shrink-0 w-1 h-full bg-green-500 rounded-full"></div>
                                        <div className="flex-1">
                                          <div className="font-medium text-slate-900 mb-1">{cond.texto}</div>
                                          {cond.categoria && (
                                            <div className="text-slate-500 text-[10px]">
                                              Categoría: {cond.categoria}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Información adicional */}
                            <div className="px-4 pb-4">
                              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                                <div className="grid grid-cols-3 gap-4 text-xs">
                                  <div>
                                    <div className="text-slate-600 mb-1">Plazo de entrega</div>
                                    <div className="font-semibold text-slate-900">
                                      {plantilla.plazo_dias || 'No especificado'} {plantilla.plazo_dias ? 'días' : ''}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-slate-600 mb-1">Condición de pago</div>
                                    <div className="font-semibold text-slate-900">
                                      {plantilla.condicion_pago || 'No especificada'}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-slate-600 mb-1">Total</div>
                                    <div className="font-bold text-lg text-blue-700">
                                      S/ {totalPlantilla.toFixed(2)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Botón aplicar */}
                            <div className="px-4 pb-4">
                              <button
                                onClick={() => handleLoadPlantilla(plantilla.id)}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                              >
                                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                Aplicar esta plantilla
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Botón de eliminar */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setPlantillaToDelete(plantilla);
                            setShowDeletePlantillaModal(true);
                          }}
                          className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-red-50 rounded text-red-600 hover:text-red-700"
                          title="Eliminar plantilla"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center bg-slate-50">
              <p className="text-sm text-slate-600">
                {plantillas.filter(p => {
                  const searchLower = plantillaSearch.toLowerCase();
                  const items = Array.isArray(p.items_json) ? p.items_json : JSON.parse(p.items_json || '[]');
                  const itemsText = items.map((item: any) => `${item.codigo} ${item.descripcion}`).join(' ').toLowerCase();
                  return p.nombre.toLowerCase().includes(searchLower) ||
                         (p.descripcion || '').toLowerCase().includes(searchLower) ||
                         itemsText.includes(searchLower);
                }).length} plantilla(s) encontrada(s)
              </p>
              <Button variant="outline" onClick={() => {
                setShowPlantillasModal(false);
                setPlantillaSearch('');
              }}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Guardar como Plantilla */}
      {showSavePlantillaModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Guardar como Plantilla</h2>
              <p className="text-sm text-slate-500">Reutiliza esta configuración en futuras cotizaciones</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <Label>Nombre de la Plantilla *</Label>
                <Input
                  value={nuevaPlantilla.nombre}
                  onChange={(e) => setNuevaPlantilla(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="ej: Full Proctor - Estándar"
                  autoFocus
                />
              </div>
              
              <div className="space-y-2">
                <Label>Descripción (opcional)</Label>
                <Input
                  value={nuevaPlantilla.descripcion}
                  onChange={(e) => setNuevaPlantilla(prev => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="ej: Ensayos estándar para proyectos de suelo"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <p className="text-blue-900 font-medium mb-1">Se guardará:</p>
                <ul className="text-blue-700 text-xs space-y-1">
                  <li>• {items.length} items/ensayos</li>
                  <li>• {selectedCondiciones.length} condiciones específicas</li>
                  <li>• Plazo: {header.plazo_dias || 0} días</li>
                  <li>• Condición de pago: {header.condicion_pago || 'No especificado'}</li>
                </ul>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowSavePlantillaModal(false);
                  setNuevaPlantilla({ nombre: '', descripcion: '' });
                }}
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleSavePlantilla}
                disabled={savingPlantilla || !nuevaPlantilla.nombre.trim()}
              >
                {savingPlantilla ? 'Guardando...' : 'Guardar Plantilla'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Eliminar Plantilla con Confirmación de 2 Pasos */}
      {showDeletePlantillaModal && plantillaToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-red-900">Eliminar Plantilla</h2>
              <p className="text-sm text-slate-600">Esta acción no se puede deshacer</p>
            </div>

            <div className="p-6">
              {deletePlantillaStep === 1 ? (
                <div className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-red-900 font-medium mb-2">
                      ¿Estás seguro de que deseas eliminar esta plantilla?
                    </p>
                    <div className="text-sm text-red-800 space-y-1">
                      <p className="font-semibold">{plantillaToDelete.nombre}</p>
                      {plantillaToDelete.descripcion && (
                        <p className="text-xs">{plantillaToDelete.descripcion}</p>
                      )}
                      <p className="text-xs mt-2">
                        • {Array.isArray(plantillaToDelete.items_json) ? plantillaToDelete.items_json.length : JSON.parse(plantillaToDelete.items_json || '[]').length} ensayos guardados
                      </p>
                      <p className="text-xs">
                        • Usada {plantillaToDelete.veces_usada || 0} veces
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setShowDeletePlantillaModal(false);
                        setPlantillaToDelete(null);
                        setDeletePlantillaStep(1);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      onClick={() => setDeletePlantillaStep(2)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Continuar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-900 font-medium mb-3">
                      Para confirmar, escribe <span className="font-bold">ELIMINAR</span> en el campo de abajo:
                    </p>
                    <Input
                      value={deletePlantillaConfirmText}
                      onChange={(e) => setDeletePlantillaConfirmText(e.target.value.toUpperCase())}
                      placeholder="Escribe ELIMINAR"
                      className="font-mono"
                      autoFocus
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setDeletePlantillaStep(1);
                        setDeletePlantillaConfirmText('');
                      }}
                    >
                      Atrás
                    </Button>
                    <Button 
                      onClick={handleDeletePlantilla}
                      disabled={deletePlantillaConfirmText !== 'ELIMINAR' || deletingPlantilla}
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingPlantilla ? 'Eliminando...' : 'Eliminar Plantilla'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
