"""
Exportador XLSX v2 - Modifica el template directamente a nivel ZIP/XML.
Preserva todos los estilos, logos, footers y márgenes del template original.
"""
import io
import zipfile
from datetime import date
from typing import Any, Callable, Optional
from lxml import etree


NAMESPACES = {
    'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
}


def _parse_cell_ref(ref: str) -> tuple[str, int]:
    """Parse 'D5' -> ('D', 5)"""
    col = ''.join(c for c in ref if c.isalpha())
    row = int(''.join(c for c in ref if c.isdigit()))
    return col, row


def _col_letter_to_num(col: str) -> int:
    """A=1, B=2, ..., Z=26, AA=27"""
    num = 0
    for c in col.upper():
        num = num * 26 + (ord(c) - ord('A') + 1)
    return num


def _find_or_create_row(sheet_data: etree._Element, row_num: int, ns: str) -> etree._Element:
    """Encuentra o crea una fila"""
    for row in sheet_data.findall(f'{{{ns}}}row'):
        if row.get('r') == str(row_num):
            return row
    row = etree.SubElement(sheet_data, f'{{{ns}}}row')
    row.set('r', str(row_num))
    return row


def _find_or_create_cell(row: etree._Element, cell_ref: str, ns: str) -> etree._Element:
    """Encuentra o crea una celda"""
    for cell in row.findall(f'{{{ns}}}c'):
        if cell.get('r') == cell_ref:
            return cell
    
    col, _ = _parse_cell_ref(cell_ref)
    col_num = _col_letter_to_num(col)
    
    insert_pos = None
    existing_cells = row.findall(f'{{{ns}}}c')
    for i, existing in enumerate(existing_cells):
        exist_col, _ = _parse_cell_ref(existing.get('r'))
        if col_num < _col_letter_to_num(exist_col):
            insert_pos = i
            break
    
    cell = etree.Element(f'{{{ns}}}c')
    cell.set('r', cell_ref)
    
    if insert_pos is not None:
        row.insert(insert_pos, cell)
    else:
        row.append(cell)
    
    return cell


def _set_cell_value(
    sheet_data: etree._Element,
    cell_ref: str,
    value: Any,
    ns: str,
    is_number: bool = False,
    get_string_idx: Optional[Callable[[str], int]] = None
):
    """Establece el valor de una celda"""
    col, row_num = _parse_cell_ref(cell_ref)
    
    row = _find_or_create_row(sheet_data, row_num, ns)
    cell = _find_or_create_cell(row, cell_ref, ns)
    
    # Preservar estilo
    style = cell.get('s')
    
    # Limpiar contenido
    for child in list(cell):
        cell.remove(child)
    
    if value is None or value == '':
        if 't' in cell.attrib:
            del cell.attrib['t']
        return
    
    if is_number:
        if 't' in cell.attrib:
            del cell.attrib['t']
        v = etree.SubElement(cell, f'{{{ns}}}v')
        v.text = str(value)
    else:
        if get_string_idx is not None:
            cell.set('t', 's')
            v = etree.SubElement(cell, f'{{{ns}}}v')
            v.text = str(get_string_idx(str(value)))
        else:
            cell.set('t', 'inlineStr')
            is_elem = etree.SubElement(cell, f'{{{ns}}}is')
            t_elem = etree.SubElement(is_elem, f'{{{ns}}}t')
            t_elem.text = str(value)
    
    if style:
        cell.set('s', style)


def _shift_rows(sheet_data: etree._Element, from_row: int, shift: int, ns: str):
    """Desplaza filas >= from_row"""
    if shift <= 0:
        return
    
    rows = list(sheet_data.findall(f'{{{ns}}}row'))
    rows.sort(key=lambda r: int(r.get('r')), reverse=True)
    
    for row in rows:
        row_num = int(row.get('r'))
        if row_num >= from_row:
            new_num = row_num + shift
            row.set('r', str(new_num))
            for cell in row.findall(f'{{{ns}}}c'):
                old_ref = cell.get('r')
                col, _ = _parse_cell_ref(old_ref)
                cell.set('r', f'{col}{new_num}')


def _shift_merged_cells(root: etree._Element, from_row: int, shift: int, ns: str):
    """Actualiza las merged cells cuando se desplazan filas"""
    if shift <= 0:
        return
    
    merge_cells = root.find(f'.//{{{ns}}}mergeCells')
    if merge_cells is None:
        return
    
    for merge in merge_cells.findall(f'{{{ns}}}mergeCell'):
        ref = merge.get('ref')
        if ':' not in ref:
            continue
        
        start, end = ref.split(':')
        start_col, start_row = _parse_cell_ref(start)
        end_col, end_row = _parse_cell_ref(end)
        
        # Si la merged cell está en o después de from_row, desplazarla
        if start_row >= from_row:
            new_start_row = start_row + shift
            new_end_row = end_row + shift
            merge.set('ref', f'{start_col}{new_start_row}:{end_col}{new_end_row}')


def _shift_row_breaks(root: etree._Element, from_row: int, shift: int, ns: str):
    """Desplaza los saltos de página manuales cuando se insertan filas"""
    if shift <= 0:
        return
    
    row_breaks = root.find(f'.//{{{ns}}}rowBreaks')
    if row_breaks is None:
        return
    
    for brk in row_breaks.findall(f'{{{ns}}}brk'):
        brk_id = brk.get('id')
        if brk_id and int(brk_id) >= from_row:
            brk.set('id', str(int(brk_id) + shift))


def _update_page_break_position(root: etree._Element, new_row: int, ns: str):
    """Actualiza la posición del salto de página principal"""
    row_breaks = root.find(f'.//{{{ns}}}rowBreaks')
    if row_breaks is None:
        return
    
    for brk in row_breaks.findall(f'{{{ns}}}brk'):
        # Actualizar el primer (y único) salto de página
        brk.set('id', str(new_row))
        break


def _add_row_break(root: etree._Element, row_id: int, ns: str):
    """Agrega un salto de página manual en una fila específica"""
    row_breaks = root.find(f'.//{{{ns}}}rowBreaks')
    if row_breaks is None:
        # Crear elemento rowBreaks si no existe
        sheet_data = root.find(f'{{{ns}}}sheetData')
        row_breaks = etree.Element(f'{{{ns}}}rowBreaks')
        row_breaks.set('count', '0')
        row_breaks.set('manualBreakCount', '0')
        sheet_data.getparent().insert(list(sheet_data.getparent()).index(sheet_data) + 1, row_breaks)
    
    # Agregar nuevo break
    brk = etree.SubElement(row_breaks, f'{{{ns}}}brk')
    brk.set('id', str(row_id))
    brk.set('min', '1')
    brk.set('max', '13')
    brk.set('man', '1')
    
    # Actualizar contadores
    count = int(row_breaks.get('count', '0')) + 1
    row_breaks.set('count', str(count))
    row_breaks.set('manualBreakCount', str(count))


def _duplicate_row(sheet_data: etree._Element, source_row_num: int, target_row_num: int, ns: str, row_height: float = None) -> etree._Element:
    """Duplica una fila existente a una nueva posición, opcionalmente con altura personalizada"""
    source_row = None
    for row in sheet_data.findall(f'{{{ns}}}row'):
        if row.get('r') == str(source_row_num):
            source_row = row
            break
    
    if source_row is None:
        return None
    
    # Crear copia de la fila
    import copy
    new_row = copy.deepcopy(source_row)
    new_row.set('r', str(target_row_num))
    
    # Ajustar altura si se especifica
    if row_height is not None:
        new_row.set('ht', str(row_height))
        new_row.set('customHeight', '1')
    
    # Actualizar referencias de celdas
    for cell in new_row.findall(f'{{{ns}}}c'):
        old_ref = cell.get('r')
        col, _ = _parse_cell_ref(old_ref)
        cell.set('r', f'{col}{target_row_num}')
    
    # Insertar en la posición correcta
    inserted = False
    for i, row in enumerate(sheet_data.findall(f'{{{ns}}}row')):
        if int(row.get('r')) > target_row_num:
            sheet_data.insert(list(sheet_data).index(row), new_row)
            inserted = True
            break
    
    if not inserted:
        sheet_data.append(new_row)
    
    return new_row


def _set_row_height(sheet_data: etree._Element, row_num: int, height: float, ns: str):
    """Establece la altura de una fila específica"""
    for row in sheet_data.findall(f'{{{ns}}}row'):
        if row.get('r') == str(row_num):
            row.set('ht', str(height))
            row.set('customHeight', '1')
            break


def _add_merged_cell(root: etree._Element, ref: str, ns: str):
    """Agrega una merged cell al documento"""
    merge_cells = root.find(f'.//{{{ns}}}mergeCells')
    if merge_cells is None:
        # Crear elemento mergeCells si no existe
        worksheet = root
        merge_cells = etree.SubElement(worksheet, f'{{{ns}}}mergeCells')
    
    # Agregar la nueva merged cell
    merge = etree.SubElement(merge_cells, f'{{{ns}}}mergeCell')
    merge.set('ref', ref)
    
    # Actualizar el count
    count = len(merge_cells.findall(f'{{{ns}}}mergeCell'))
    merge_cells.set('count', str(count))

def _find_merged_cell_range(root: etree._Element, cell_ref: str, ns: str) -> tuple[str, str] | None:
    """Encuentra el rango de merged cells que contiene la celda especificada. 
    Retorna (start_cell, end_cell) o None si no está en un rango combinado"""
    merge_cells = root.find(f'.//{{{ns}}}mergeCells')
    if merge_cells is None:
        return None
    
    col, row = _parse_cell_ref(cell_ref)
    col_num = _col_letter_to_num(col)
    
    for merge in merge_cells.findall(f'{{{ns}}}mergeCell'):
        ref = merge.get('ref')
        if ':' not in ref:
            continue
        
        start, end = ref.split(':')
        start_col, start_row = _parse_cell_ref(start)
        end_col, end_row = _parse_cell_ref(end)
        start_col_num = _col_letter_to_num(start_col)
        end_col_num = _col_letter_to_num(end_col)
        
        # Verificar si cell_ref está dentro del rango
        if (start_row <= row <= end_row and 
            start_col_num <= col_num <= end_col_num):
            return (start, end)
    
    return None


def _clear_merged_cell_range(sheet_data: etree._Element, start_cell: str, end_cell: str, ns: str):
    """Limpia todas las celdas en un rango combinado"""
    start_col, start_row = _parse_cell_ref(start_cell)
    end_col, end_row = _parse_cell_ref(end_cell)
    start_col_num = _col_letter_to_num(start_col)
    end_col_num = _col_letter_to_num(end_col)
    
    # Limpiar todas las celdas del rango
    for row_num in range(start_row, end_row + 1):
        for col_num in range(start_col_num, end_col_num + 1):
            col_letter = chr(ord('A') + col_num - 1) if col_num <= 26 else f'A{chr(ord("A") + col_num - 27)}'
            cell_ref = f'{col_letter}{row_num}'
            _set_cell_value(sheet_data, cell_ref, '', ns)

def export_xlsx_direct(template_path: str, data: dict) -> io.BytesIO:
    """Exporta XLSX modificando el template directamente."""
    
    # 1. Cargar shared strings
    shared_strings = []
    shared_strings_map = {}
    ss_xml_original = None
    
    with zipfile.ZipFile(template_path, 'r') as z:
        if 'xl/sharedStrings.xml' in z.namelist():
            ss_xml_original = z.read('xl/sharedStrings.xml')
            ss_root = etree.fromstring(ss_xml_original)
            ns = ss_root.nsmap.get(None, NAMESPACES['main'])
            
            for si in ss_root.findall(f'{{{ns}}}si'):
                t = si.find(f'{{{ns}}}t')
                if t is not None and t.text:
                    shared_strings.append(t.text)
                    shared_strings_map[t.text] = len(shared_strings) - 1
                else:
                    r_texts = si.findall(f'.//{{{ns}}}t')
                    text = ''.join([t.text or '' for t in r_texts])
                    shared_strings.append(text)
                    if text:
                        shared_strings_map[text] = len(shared_strings) - 1
    
    def get_string_idx(text: str) -> int:
        if text in shared_strings_map:
            return shared_strings_map[text]
        idx = len(shared_strings)
        shared_strings.append(text)
        shared_strings_map[text] = idx
        return idx
    
    # 2. Modificar sheet36.xml (hoja MORT2 - la hoja de cotización)
    sheet_file = 'xl/worksheets/sheet36.xml'
    with zipfile.ZipFile(template_path, 'r') as z:
        sheet_data_xml = z.read(sheet_file)
    
    root = etree.fromstring(sheet_data_xml)
    ns = root.nsmap.get(None, NAMESPACES['main'])
    sheet_data = root.find(f'.//{{{ns}}}sheetData')
    
    if sheet_data is not None:
        # Título
        cotizacion_numero = data.get('cotizacion_numero', '000')
        fecha_emision = data.get('fecha_emision', date.today())
        year = fecha_emision.year if isinstance(fecha_emision, date) else date.today().year
        titulo = f"COTIZACIÓN DE LABORATORIO N° {cotizacion_numero}-{year % 100}"
        _set_cell_value(sheet_data, 'G3', titulo, ns, get_string_idx=get_string_idx)
        
        # Cliente
        _set_cell_value(sheet_data, 'D5', data.get('cliente', ''), ns, get_string_idx=get_string_idx)
        _set_cell_value(sheet_data, 'D6', data.get('ruc', ''), ns, get_string_idx=get_string_idx)
        _set_cell_value(sheet_data, 'D7', data.get('contacto', ''), ns, get_string_idx=get_string_idx)
        _set_cell_value(sheet_data, 'E8', data.get('telefono', ''), ns, get_string_idx=get_string_idx)
        _set_cell_value(sheet_data, 'D9', data.get('email', ''), ns, get_string_idx=get_string_idx)
        
        # Proyecto
        _set_cell_value(sheet_data, 'L5', data.get('proyecto', ''), ns, get_string_idx=get_string_idx)
        
        # Fecha de solicitud (E10:I10 - celda combinada, escribir en E10)
        fecha_solicitud = data.get('fecha_solicitud')
        if fecha_solicitud:
            fecha_sol_str = fecha_solicitud.strftime('%d/%m/%Y') if isinstance(fecha_solicitud, date) else str(fecha_solicitud)
            _set_cell_value(sheet_data, 'E10', fecha_sol_str, ns, get_string_idx=get_string_idx)
        
        _set_cell_value(sheet_data, 'L7', data.get('ubicacion', ''), ns, get_string_idx=get_string_idx)
        _set_cell_value(sheet_data, 'L8', data.get('personal_comercial', ''), ns, get_string_idx=get_string_idx)
        _set_cell_value(sheet_data, 'L9', data.get('telefono_comercial', ''), ns, get_string_idx=get_string_idx)
        
        # Fecha de emisión (L10)
        fecha_str = fecha_emision.strftime('%d/%m/%Y') if isinstance(fecha_emision, date) else str(fecha_emision)
        _set_cell_value(sheet_data, 'L10', fecha_str, ns, get_string_idx=get_string_idx)
        
        # Items
        items = data.get('items', [])
        extra_rows = max(0, len(items) - 1)
        
        if extra_rows > 0:
            # Primero desplazar filas y merged cells
            _shift_rows(sheet_data, 18, extra_rows, ns)
            _shift_merged_cells(root, 18, extra_rows, ns)
            
            # Lógica de salto de página:
            # El salto original está en fila 26, justo antes de CONTRAMUESTRA (fila 27)
            # - Con 1-6 items: desplazar salto normalmente (26 + extra_rows)
            #   Esto mantiene el salto justo antes de CONTRAMUESTRA
            # - Con 7+ items: el contenido puede exceder, ajustar si es necesario
            if len(items) <= 6:
                # Desplazar salto de página normalmente (mantiene posición relativa)
                _shift_row_breaks(root, 18, extra_rows, ns)
            else:
                # Con muchos items, ajustar salto antes de CONTRAMUESTRA
                # CONTRAMUESTRA original en fila 27, con extra_rows -> 27 + extra_rows
                # Salto va en fila 26 + extra_rows (justo antes)
                page_break_row = 26 + extra_rows
                _update_page_break_position(root, page_break_row, ns)
            
            # Luego duplicar fila 17 para items adicionales y agregar merged cells C:I
            for i in range(1, len(items)):
                target_row = 17 + i
                _duplicate_row(sheet_data, 17, target_row, ns)
                # Agregar merged cell para descripción (C:I) en la nueva fila
                _add_merged_cell(root, f'C{target_row}:I{target_row}', ns)
        
        subtotal = 0.0
        for idx, item in enumerate(items):
            row = 17 + idx
            _set_cell_value(sheet_data, f'B{row}', item.get('codigo', ''), ns, get_string_idx=get_string_idx)
            _set_cell_value(sheet_data, f'C{row}', item.get('descripcion', ''), ns, get_string_idx=get_string_idx)
            _set_cell_value(sheet_data, f'J{row}', item.get('norma', ''), ns, get_string_idx=get_string_idx)
            _set_cell_value(sheet_data, f'K{row}', item.get('acreditado', ''), ns, get_string_idx=get_string_idx)
            
            costo = float(item.get('costo_unitario', 0))
            cantidad = float(item.get('cantidad', 0))
            parcial = costo * cantidad
            
            _set_cell_value(sheet_data, f'L{row}', costo, ns, is_number=True)
            _set_cell_value(sheet_data, f'M{row}', cantidad, ns, is_number=True)
            _set_cell_value(sheet_data, f'N{row}', parcial, ns, is_number=True)
            
            subtotal += parcial
        
        # Totales (filas desplazadas)
        row_sub = 18 + extra_rows
        row_igv = 19 + extra_rows
        row_tot = 20 + extra_rows
        
        _set_cell_value(sheet_data, f'N{row_sub}', subtotal, ns, is_number=True)
        
        igv = 0.0
        if data.get('include_igv', True):
            igv = subtotal * float(data.get('igv_rate', 0.18))
        
        _set_cell_value(sheet_data, f'N{row_igv}', igv, ns, is_number=True)
        _set_cell_value(sheet_data, f'N{row_tot}', subtotal + igv, ns, is_number=True)
        
        # CONDICIONES ESPECÍFICAS (fila 23 + extra_rows, celdas combinadas B23:N23)
        condiciones_textos = data.get('condiciones_textos', [])
        row_condiciones = 23 + extra_rows
        print(f"DEBUG: condiciones_textos recibido = {len(condiciones_textos)} items, row_condiciones = {row_condiciones}")
        
        if condiciones_textos:
            # Limpiar todas las celdas de la fila 23 (B23:N23)
            for col in ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N']:
                _set_cell_value(sheet_data, f'{col}{row_condiciones}', '', ns)
            
            # Construir el texto con título y todas las condiciones
            condiciones_text = "CONDICIONES ESPECÍFICAS:\n"
            for condicion in condiciones_textos:
                condiciones_text += f"- {condicion}\n"
            
            print(f"DEBUG: Escribiendo condiciones en B{row_condiciones}: {condiciones_text[:100]}...")
            _set_cell_value(sheet_data, f'B{row_condiciones}', condiciones_text, ns, get_string_idx=get_string_idx)
        # Si no hay condiciones, se mantiene el texto original del template
        
        # PLAZO ESTIMADO (fila 24 + extra_rows, celdas combinadas B24:N24)
        plazo_dias = data.get('plazo_dias', 0)
        row_plazo = 24 + extra_rows
        print(f"DEBUG: plazo_dias recibido = {plazo_dias}, row_plazo = {row_plazo}")
        
        # Siempre limpiar y escribir el texto (con o sin días)
        for col in ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N']:
            _set_cell_value(sheet_data, f'{col}{row_plazo}', '', ns)
        
        if plazo_dias and plazo_dias > 0:
            # Texto con días específicos
            plazo_text = (
                f"PLAZO ESTIMADO DE EJECUCIÓN DE SERVICIO: "
                f"- El plazo de entrega de los resultados se estima en {plazo_dias} días hábiles, "
                f"este tiempo será evaluado de acuerdo a la cantidad de muestra recepcionada y está sujeto "
                f"a la programacion enviada por el Laboratorio de Ensayos de Materiales. "
                f"- El laboratorio enviará un correo de confirmación de recepción y fecha de entrega del informe."
            )
        else:
            # Texto sin días específicos
            plazo_text = (
                f"PLAZO ESTIMADO DE EJECUCIÓN DE SERVICIO: "
                f"- El plazo de entrega de los resultados se estima de acuerdo a la programacion recepcion, "
                f"este tiempo será evaluado de acuerdo a la cantidad de muestra recepcionada y está sujeto "
                f"a la programacion enviada por el Laboratorio de Ensayos de Materiales. "
                f"- El laboratorio enviará un correo de confirmación de recepción y fecha de entrega del informe."
            )
        
        print(f"DEBUG: Escribiendo plazo en B{row_plazo}: {plazo_text[:50]}...")
        _set_cell_value(sheet_data, f'B{row_plazo}', plazo_text, ns, get_string_idx=get_string_idx)
        
        # CONDICIONES DE PAGO (fila 34 + extra_rows, SIN celdas combinadas)
        condicion_pago = data.get('condicion_pago', '')
        row_condicion = 34 + extra_rows
        print(f"DEBUG: condicion_pago recibido = '{condicion_pago}', row_condicion = {row_condicion}")
        if condicion_pago:
            condiciones = {
                'valorizacion': 'El pago del servicio se realizará de acuerdo a la valorización mensual.',
                'adelantado': 'El pago del servicio deberá ser realizado por Adelantado.',
                '50_adelanto': 'El pago del servicio Adelanto el 50% y saldo previo a la entrega del Informe.',
                'credito_7': 'El pago del servicio Crédito a 7 días, previa orden de servicio.',
                'credito_15': 'El pago del servicio Crédito a 15 días, previa orden de servicio.',
                'credito_30': 'El pago del servicio Crédito a 30 días, previa orden de servicio.',
            }
            condicion_text = f"CONDICIÓN: {condiciones.get(condicion_pago, '')}"
            print(f"DEBUG: Escribiendo condición en B{row_condicion}: {condicion_text}")
            _set_cell_value(sheet_data, f'B{row_condicion}', condicion_text, ns, get_string_idx=get_string_idx)
        # Si no hay condicion_pago, se mantiene el texto original del template
        
        # CORREO DEL VENDEDOR (fila 51 + extra_rows, celdas combinadas B51:N51)
        row_aceptacion = 51 + extra_rows
        correo_vendedor = data.get('correo', '')
        print(f"DEBUG: correo={correo_vendedor}, row_aceptacion={row_aceptacion}")
        if correo_vendedor:
            # Limpiar todas las celdas de la fila 51 (B51:N51)
            for col in ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N']:
                _set_cell_value(sheet_data, f'{col}{row_aceptacion}', '', ns)
            
            # Speech exacto: solo mostrar correo, mencionar número sin mostrarlo
            aceptacion_text = (
                f"La aceptación de la cotización por parte del cliente podrá manifestarse a través de cualquiera "
                f"de las siguientes acciones: el pago correspondiente al servicio, el envío de la orden de servicio, "
                f"o el envío de un correo electrónico confirmando la aceptación del servicio según la presente cotización, "
                f"al correo {correo_vendedor} y/o mediante mensaje de WhatsApp al número del asesor comercial, "
                f"en señal de conformidad."
            )
            print(f"DEBUG: Escribiendo aceptación en B{row_aceptacion}: {aceptacion_text[:50]}...")
            _set_cell_value(sheet_data, f'B{row_aceptacion}', aceptacion_text, ns, get_string_idx=get_string_idx)
        # Si no hay correo, se mantiene el texto original del template
    
    modified_sheet1 = etree.tostring(root, encoding='utf-8', xml_declaration=True)
    
    # 3. Generar sharedStrings.xml actualizado
    modified_ss = None
    if ss_xml_original:
        ss_root = etree.fromstring(ss_xml_original)
        ss_ns = ss_root.nsmap.get(None, NAMESPACES['main'])
        
        for child in list(ss_root):
            ss_root.remove(child)
        
        for text in shared_strings:
            si = etree.SubElement(ss_root, f'{{{ss_ns}}}si')
            t = etree.SubElement(si, f'{{{ss_ns}}}t')
            t.text = text if text else ''
        
        ss_root.set('count', str(len(shared_strings)))
        ss_root.set('uniqueCount', str(len(shared_strings)))
        
        modified_ss = etree.tostring(ss_root, encoding='utf-8', xml_declaration=True)
    
    # 3.5 Actualizar área de impresión en workbook.xml si hay filas extra
    modified_wb = None
    if extra_rows > 0:
        with zipfile.ZipFile(template_path, 'r') as z:
            wb_xml = z.read('xl/workbook.xml')
            wb_root = etree.fromstring(wb_xml)
            wb_ns = wb_root.nsmap.get(None)
            
            defs = wb_root.find(f'.//{{{wb_ns}}}definedNames')
            if defs is not None:
                for d in defs.findall(f'{{{wb_ns}}}definedName'):
                    if d.get('name') == '_xlnm.Print_Area' and d.get('localSheetId') == '35':
                        # Actualizar área de impresión de MORT2 (original: $B$3:$N$60)
                        old_text = d.text or ''
                        if '$N$60' in old_text:
                            new_end_row = 60 + extra_rows
                            d.text = old_text.replace('$N$60', f'$N${new_end_row}')
            
            modified_wb = etree.tostring(wb_root, encoding='utf-8', xml_declaration=True)
    
    # 3.6 Actualizar drawings (shapes/textboxes) para desplazar referencias de filas
    modified_drawing = None
    if extra_rows > 0:
        with zipfile.ZipFile(template_path, 'r') as z:
            if 'xl/drawings/drawing28.xml' in z.namelist():
                drawing_xml = z.read('xl/drawings/drawing28.xml')
                drawing_root = etree.fromstring(drawing_xml)
                xdr_ns = 'http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing'
                
                # Desplazar referencias de filas en twoCellAnchor (from/to row)
                for anchor in drawing_root.findall(f'.//{{{xdr_ns}}}twoCellAnchor'):
                    for elem_name in ['from', 'to']:
                        elem = anchor.find(f'{{{xdr_ns}}}{elem_name}')
                        if elem is not None:
                            row_elem = elem.find(f'{{{xdr_ns}}}row')
                            if row_elem is not None and row_elem.text:
                                row_num = int(row_elem.text)
                                # Desplazar filas >= 18 (después de los items)
                                if row_num >= 17:
                                    row_elem.text = str(row_num + extra_rows)
                
                modified_drawing = etree.tostring(drawing_root, encoding='utf-8', xml_declaration=True)
    
    # 4. Escribir output
    output = io.BytesIO()
    
    with zipfile.ZipFile(template_path, 'r') as z_in:
        with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as z_out:
            for item in z_in.namelist():
                if item == 'xl/worksheets/sheet36.xml':
                    z_out.writestr(item, modified_sheet1)
                elif item == 'xl/sharedStrings.xml' and modified_ss:
                    z_out.writestr(item, modified_ss)
                elif item == 'xl/workbook.xml' and modified_wb:
                    z_out.writestr(item, modified_wb)
                elif item == 'xl/drawings/drawing28.xml' and modified_drawing:
                    z_out.writestr(item, modified_drawing)
                else:
                    z_out.writestr(item, z_in.read(item))
    
    output.seek(0)
    return output
