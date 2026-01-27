"""
Exportador XLSX que modifica el template directamente a nivel ZIP/XML.
Preserva todos los estilos, logos, footers y márgenes del template original.
"""
import io
import zipfile
from datetime import date
from typing import Any
from lxml import etree


# Namespaces de Excel
NAMESPACES = {
    'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
}


def _parse_cell_ref(ref: str) -> tuple[str, int]:
    """Parse 'D5' -> ('D', 5)"""
    col = ''.join(c for c in ref if c.isalpha())
    row = int(''.join(c for c in ref if c.isdigit()))
    return col, row


def _make_cell_ref(col: str, row: int) -> str:
    """Make 'D' + 5 -> 'D5'"""
    return f"{col}{row}"


def _col_letter_to_num(col: str) -> int:
    """A=1, B=2, ..., Z=26, AA=27, etc."""
    num = 0
    for c in col.upper():
        num = num * 26 + (ord(c) - ord('A') + 1)
    return num


def _find_or_create_row(sheet_data: etree.Element, row_num: int) -> etree.Element:
    """Encuentra o crea una fila en sheetData"""
    nsmap = sheet_data.nsmap
    main_ns = nsmap.get(None, NAMESPACES['main'])
    
    # Buscar fila existente
    for row in sheet_data.findall(f'{{{main_ns}}}row'):
        if row.get('r') == str(row_num):
            return row
    
    # Crear nueva fila
    row = etree.SubElement(sheet_data, f'{{{main_ns}}}row')
    row.set('r', str(row_num))
    return row


def _find_or_create_cell(row: etree.Element, cell_ref: str) -> etree.Element:
    """Encuentra o crea una celda en una fila"""
    nsmap = row.nsmap
    main_ns = nsmap.get(None, NAMESPACES['main'])
    
    # Buscar celda existente
    for cell in row.findall(f'{{{main_ns}}}c'):
        if cell.get('r') == cell_ref:
            return cell
    
    # Crear nueva celda en la posición correcta
    col, _ = _parse_cell_ref(cell_ref)
    col_num = _col_letter_to_num(col)
    
    # Encontrar posición de inserción
    insert_pos = None
    for i, existing_cell in enumerate(row.findall(f'{{{main_ns}}}c')):
        existing_ref = existing_cell.get('r')
        existing_col, _ = _parse_cell_ref(existing_ref)
        existing_col_num = _col_letter_to_num(existing_col)
        if col_num < existing_col_num:
            insert_pos = i
            break
    
    cell = etree.Element(f'{{{main_ns}}}c')
    cell.set('r', cell_ref)
    
    if insert_pos is not None:
        row.insert(insert_pos, cell)
    else:
        row.append(cell)
    
    return cell


def _set_cell_value(sheet_data: etree.Element, cell_ref: str, value: Any, is_number: bool = False, string_idx_fn=None):
    """Establece el valor de una celda, preservando estilos"""
    col, row_num = _parse_cell_ref(cell_ref)
    
    row = _find_or_create_row(sheet_data, row_num)
    cell = _find_or_create_cell(row, cell_ref)
    
    nsmap = cell.nsmap
    main_ns = nsmap.get(None, NAMESPACES['main'])
    
    # Preservar atributo 's' (estilo) si existe
    style_attr = cell.get('s')
    
    # Limpiar solo el contenido (v, is, f), NO los atributos
    for child in list(cell):
        cell.remove(child)
    
    # Establecer valor
    if value is None or value == '':
        # Celda vacía - mantener solo atributos de estilo
        if 't' in cell.attrib:
            del cell.attrib['t']
        return
    
    if is_number:
        # Número - remover tipo texto si existe
        if 't' in cell.attrib:
            del cell.attrib['t']
        v = etree.SubElement(cell, f'{{{main_ns}}}v')
        v.text = str(value)
    else:
        # Texto - usar shared strings si está disponible
        if string_idx_fn is not None:
            cell.set('t', 's')
            v = etree.SubElement(cell, f'{{{main_ns}}}v')
            v.text = str(string_idx_fn(str(value)))
        else:
            # Fallback a inlineStr
            cell.set('t', 'inlineStr')
            is_elem = etree.SubElement(cell, f'{{{main_ns}}}is')
            t_elem = etree.SubElement(is_elem, f'{{{main_ns}}}t')
            t_elem.text = str(value)
    
    # Restaurar estilo si existía
    if style_attr is not None:
        cell.set('s', style_attr)


def _shift_rows(sheet_data: etree.Element, from_row: int, shift: int):
    """Desplaza todas las filas >= from_row hacia abajo"""
    if shift <= 0:
        return
    
    nsmap = sheet_data.nsmap
    main_ns = nsmap.get(None, NAMESPACES['main'])
    
    rows = list(sheet_data.findall(f'{{{main_ns}}}row'))
    # Procesar en orden inverso para evitar conflictos
    rows.sort(key=lambda r: int(r.get('r')), reverse=True)
    
    for row in rows:
        row_num = int(row.get('r'))
        if row_num >= from_row:
            new_row_num = row_num + shift
            row.set('r', str(new_row_num))
            
            # Actualizar referencias de celdas
            for cell in row.findall(f'{{{main_ns}}}c'):
                old_ref = cell.get('r')
                col, _ = _parse_cell_ref(old_ref)
                new_ref = _make_cell_ref(col, new_row_num)
                cell.set('r', new_ref)


def export_xlsx_direct(template_path: str, data: dict) -> io.BytesIO:
    """
    Exporta XLSX modificando el template directamente.
    Preserva todos los estilos, logos, footers y márgenes.
    """
    output = io.BytesIO()
    
    # Cargar shared strings del template
    shared_strings = []
    shared_strings_map = {}
    ss_xml_data = None
    ss_ns = NAMESPACES['main']
    
    with zipfile.ZipFile(template_path, 'r') as template_zip:
        if 'xl/sharedStrings.xml' in template_zip.namelist():
            ss_xml_data = template_zip.read('xl/sharedStrings.xml')
            ss_root = etree.fromstring(ss_xml_data)
            ss_ns = ss_root.nsmap.get(None, NAMESPACES['main'])
            
            for si in ss_root.findall(f'{{{ss_ns}}}si'):
                t = si.find(f'{{{ss_ns}}}t')
                if t is not None and t.text:
                    shared_strings.append(t.text)
                    shared_strings_map[t.text] = len(shared_strings) - 1
                else:
                    # Puede tener rich text con múltiples <r> elementos
                    r_elems = si.findall(f'.//{{{ss_ns}}}t')
                    text = ''.join([r.text or '' for r in r_elems])
                    shared_strings.append(text)
                    if text:
                        shared_strings_map[text] = len(shared_strings) - 1
    
    def _get_or_add_string(text: str) -> int:
        """Obtiene o agrega un string a la tabla compartida"""
        if text in shared_strings_map:
            return shared_strings_map[text]
        idx = len(shared_strings)
        shared_strings.append(text)
        shared_strings_map[text] = idx
        return idx
    
    # Primera pasada: modificar sheet1.xml y agregar strings nuevos
    modified_sheet1 = None
    
    with zipfile.ZipFile(template_path, 'r') as template_zip:
        sheet1_data = template_zip.read('xl/worksheets/sheet1.xml')
        parser = etree.XMLParser(remove_blank_text=False)
        root = etree.fromstring(sheet1_data, parser)
        
        nsmap = root.nsmap
        main_ns = nsmap.get(None, NAMESPACES['main'])
        sheet_data = root.find(f'.//{{{main_ns}}}sheetData')
        
        if sheet_data is not None:
            # 1. TÍTULO - G3
            cotizacion_numero = data.get('cotizacion_numero', '000')
            fecha_emision = data.get('fecha_emision', date.today())
            year = fecha_emision.year if isinstance(fecha_emision, date) else date.today().year
            titulo = f"COTIZACIÓN DE LABORATORIO N° {cotizacion_numero}-{year % 100}"
            _set_cell_value(sheet_data, 'G3', titulo, string_idx_fn=_get_or_add_string)
            
            # 2. DATOS CLIENTE
            _set_cell_value(sheet_data, 'D5', data.get('cliente', ''), string_idx_fn=_get_or_add_string)
            _set_cell_value(sheet_data, 'D6', data.get('ruc', ''), string_idx_fn=_get_or_add_string)
            _set_cell_value(sheet_data, 'D7', data.get('contacto', ''), string_idx_fn=_get_or_add_string)
            _set_cell_value(sheet_data, 'E8', data.get('telefono', ''), string_idx_fn=_get_or_add_string)
            _set_cell_value(sheet_data, 'D9', data.get('email', ''), string_idx_fn=_get_or_add_string)
            
            # 3. DATOS PROYECTO
            _set_cell_value(sheet_data, 'L5', data.get('proyecto', ''), string_idx_fn=_get_or_add_string)
            _set_cell_value(sheet_data, 'L7', data.get('ubicacion', ''), string_idx_fn=_get_or_add_string)
            fecha_str = fecha_emision.strftime('%d/%m/%Y') if isinstance(fecha_emision, date) else str(fecha_emision)
            _set_cell_value(sheet_data, 'L10', fecha_str, string_idx_fn=_get_or_add_string)
            
            # 4. ITEMS
            items = data.get('items', [])
            extra_rows = max(0, len(items) - 1)
            
            if extra_rows > 0:
                _shift_rows(sheet_data, 18, extra_rows)
            
            subtotal = 0.0
            for idx, item in enumerate(items):
                row = 17 + idx
                _set_cell_value(sheet_data, f'B{row}', item.get('codigo', ''), string_idx_fn=_get_or_add_string)
                _set_cell_value(sheet_data, f'C{row}', item.get('descripcion', ''), string_idx_fn=_get_or_add_string)
                _set_cell_value(sheet_data, f'J{row}', item.get('norma', ''), string_idx_fn=_get_or_add_string)
                _set_cell_value(sheet_data, f'K{row}', item.get('acreditado', ''), string_idx_fn=_get_or_add_string)
                
                costo = float(item.get('costo_unitario', 0))
                cantidad = float(item.get('cantidad', 0))
                parcial = costo * cantidad
                
                _set_cell_value(sheet_data, f'L{row}', costo, True)
                _set_cell_value(sheet_data, f'M{row}', cantidad, True)
                _set_cell_value(sheet_data, f'N{row}', parcial, True)
                
                subtotal += parcial
            
            # 5. TOTALES
            row_subtotal = 18 + extra_rows
            row_igv = 19 + extra_rows
            row_total = 20 + extra_rows
            
            _set_cell_value(sheet_data, f'N{row_subtotal}', subtotal, True)
            
            igv = 0.0
            if data.get('include_igv', True):
                igv = subtotal * float(data.get('igv_rate', 0.18))
            
            _set_cell_value(sheet_data, f'N{row_igv}', igv, True)
            _set_cell_value(sheet_data, f'N{row_total}', subtotal + igv, True)
        
        modified_sheet1 = etree.tostring(root, encoding='utf-8', xml_declaration=True)
    
    # Generar sharedStrings.xml actualizado
    modified_ss = None
    if ss_xml_data:
        ss_root = etree.fromstring(ss_xml_data)
        ss_ns_actual = ss_root.nsmap.get(None, NAMESPACES['main'])
        
        # Limpiar y reconstruir
        for child in list(ss_root):
            ss_root.remove(child)
        
        for text in shared_strings:
            si = etree.SubElement(ss_root, f'{{{ss_ns_actual}}}si')
            t = etree.SubElement(si, f'{{{ss_ns_actual}}}t')
            t.text = text if text else ''
        
        ss_root.set('count', str(len(shared_strings)))
        ss_root.set('uniqueCount', str(len(shared_strings)))
        
        modified_ss = etree.tostring(ss_root, encoding='utf-8', xml_declaration=True)
    
    # Segunda pasada: escribir todo al output
    with zipfile.ZipFile(template_path, 'r') as template_zip:
        with zipfile.ZipFile(output, 'w', compression=zipfile.ZIP_DEFLATED) as output_zip:
            for item in template_zip.namelist():
                if item == 'xl/worksheets/sheet1.xml':
                    output_zip.writestr(item, modified_sheet1)
                elif item == 'xl/sharedStrings.xml' and modified_ss:
                    output_zip.writestr(item, modified_ss)
                else:
                    output_zip.writestr(item, template_zip.read(item))
                    # Parse con lxml preservando todo
                    parser = etree.XMLParser(remove_blank_text=False)
                    root = etree.fromstring(file_data, parser)
                    
                    # Encontrar sheetData
                    nsmap = root.nsmap
                    main_ns = nsmap.get(None, NAMESPACES['main'])
                    sheet_data = root.find(f'.//{{{main_ns}}}sheetData')
                    
                    if sheet_data is not None:
                        # 1. TÍTULO - G3
                        cotizacion_numero = data.get('cotizacion_numero', '000')
                        fecha_emision = data.get('fecha_emision', date.today())
                        year = fecha_emision.year if isinstance(fecha_emision, date) else date.today().year
                        titulo = f"COTIZACIÓN DE LABORATORIO N° {cotizacion_numero}-{year % 100}"
                        _set_cell_value(sheet_data, 'G3', titulo, string_idx_fn=_get_or_add_string)
                        
                        # 2. DATOS CLIENTE
                        _set_cell_value(sheet_data, 'D5', data.get('cliente', ''), string_idx_fn=_get_or_add_string)
                        _set_cell_value(sheet_data, 'D6', data.get('ruc', ''), string_idx_fn=_get_or_add_string)
                        _set_cell_value(sheet_data, 'D7', data.get('contacto', ''), string_idx_fn=_get_or_add_string)
                        _set_cell_value(sheet_data, 'E8', data.get('telefono', ''), string_idx_fn=_get_or_add_string)
                        _set_cell_value(sheet_data, 'D9', data.get('email', ''), string_idx_fn=_get_or_add_string)
                        
                        # 3. DATOS PROYECTO
                        _set_cell_value(sheet_data, 'L5', data.get('proyecto', ''), string_idx_fn=_get_or_add_string)
                        _set_cell_value(sheet_data, 'L7', data.get('ubicacion', ''), string_idx_fn=_get_or_add_string)
                        fecha_str = fecha_emision.strftime('%d/%m/%Y') if isinstance(fecha_emision, date) else str(fecha_emision)
                        _set_cell_value(sheet_data, 'L10', fecha_str, string_idx_fn=_get_or_add_string)
                        
                        # 4. ITEMS
                        items = data.get('items', [])
                        extra_rows = max(0, len(items) - 1)
                        
                        # Insertar filas si es necesario
                        if extra_rows > 0:
                            _shift_rows(sheet_data, 18, extra_rows)
                        
                        # Llenar items
                        subtotal = 0.0
                        for idx, item in enumerate(items):
                            row = 17 + idx
                            _set_cell_value(sheet_data, f'B{row}', item.get('codigo', ''), string_idx_fn=_get_or_add_string)
                            _set_cell_value(sheet_data, f'C{row}', item.get('descripcion', ''), string_idx_fn=_get_or_add_string)
                            _set_cell_value(sheet_data, f'J{row}', item.get('norma', ''), string_idx_fn=_get_or_add_string)
                            _set_cell_value(sheet_data, f'K{row}', item.get('acreditado', ''), string_idx_fn=_get_or_add_string)
                            
                            costo = float(item.get('costo_unitario', 0))
                            cantidad = float(item.get('cantidad', 0))
                            parcial = costo * cantidad
                            
                            _set_cell_value(sheet_data, f'L{row}', costo, True)
                            _set_cell_value(sheet_data, f'M{row}', cantidad, True)
                            _set_cell_value(sheet_data, f'N{row}', parcial, True)
                            
                            subtotal += parcial
                        
                        # 5. TOTALES
                        row_subtotal = 18 + extra_rows
                        row_igv = 19 + extra_rows
                        row_total = 20 + extra_rows
                        
                        _set_cell_value(sheet_data, f'N{row_subtotal}', subtotal, True)
                        
                        igv = 0.0
                        if data.get('include_igv', True):
                            igv = subtotal * float(data.get('igv_rate', 0.18))
                        
                        _set_cell_value(sheet_data, f'N{row_igv}', igv, True)
                        _set_cell_value(sheet_data, f'N{row_total}', subtotal + igv, True)
                    
                    # Serializar preservando formato
                    file_data = etree.tostring(root, encoding='utf-8', xml_declaration=True, pretty_print=False)
                
                # Actualizar sharedStrings.xml
                elif item == 'xl/sharedStrings.xml':
                    ss_root = etree.fromstring(file_data)
                    ss_ns = ss_root.nsmap.get(None, NAMESPACES['main'])
                    
                    # Limpiar strings existentes
                    for si in list(ss_root):
                        ss_root.remove(si)
                    
                    # Agregar todos los strings (originales + nuevos)
                    for text in shared_strings:
                        si = etree.SubElement(ss_root, f'{{{ss_ns}}}si')
                        t = etree.SubElement(si, f'{{{ss_ns}}}t')
                        t.text = text if text else ''
                    
                    # Actualizar count
                    ss_root.set('count', str(len(shared_strings)))
                    ss_root.set('uniqueCount', str(len(shared_strings)))
                    
                    file_data = etree.tostring(ss_root, encoding='utf-8', xml_declaration=True, pretty_print=False)
                
                output_zip.writestr(item, file_data)
    
    output.seek(0)
    return output
