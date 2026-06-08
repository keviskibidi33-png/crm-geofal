import type { ModuleConfig, ModuleFormState, RenderTools } from './types'
import { emptyRow, normalizeFlexibleDate, round, toNumber } from './helpers'

const COLOR_GARDNER_MAP: Record<number, number> = {
    1: 5,
    2: 8,
    3: 11,
    4: 14,
    5: 16,
}

const tableClass = 'w-full table-fixed border border-slate-300 text-sm'
const headClass = 'border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-800'
const cellClass = 'border border-slate-300 p-1 align-middle'
const sectionTitleClass = 'border-b border-slate-300 bg-slate-100 px-3 py-2 text-xs font-semibold tracking-wide text-slate-800'
const excelTableClass = 'w-full table-fixed border-collapse text-[13px] text-black'
const excelHeadClass = 'border border-black px-2 py-1.5 text-center text-[13px] font-semibold leading-tight text-black'
const excelCellClass = 'border border-black px-2 py-1.5 align-middle text-[13px] leading-tight text-black'
const excelTitleCellClass = 'border border-black px-3 py-2 text-center text-[15px] font-semibold text-black'
const excelGroupTitleClass = 'border border-black px-2 py-1.5 text-left text-[13px] font-semibold text-black'
const excelInputClass = '!h-8 !rounded-none !border-0 !bg-transparent !px-1.5 !text-[13px] !text-black !shadow-none focus:!ring-0'
const excelBlueInputClass = '!h-8 !rounded-none !border-0 !bg-[#dbe6f4] !px-1.5 !text-[13px] !text-black !shadow-none focus:!ring-0'
const excelReadonlyInputClass = '!h-8 !rounded-none !border-0 !bg-[#eef3f8] !px-1.5 !text-[13px] !font-semibold !text-black !shadow-none focus:!ring-0'
const excelReadonlySpacerClass = 'h-8 bg-[#eef3f8]'
const excelSelectBlueClass = '!h-8 !rounded-none !border-0 !bg-[#dbe6f4] !px-1.5 !text-[13px] !text-black !shadow-none focus:!ring-0'
const excelTextareaClass = '!min-h-[96px] !rounded-none !border-0 !bg-transparent !px-2 !py-2 !text-[13px] !text-black !shadow-none focus:!ring-0'
const FOOTER_REVIEWERS = ['-', 'FABIAN LA ROSA'] as const
const FOOTER_APPROVERS = ['-', 'IRMA COAQUIRA'] as const

function createBaseState(): ModuleFormState {
    return {
        muestra: '',
        numero_ot: '',
        fecha_ensayo: '',
        realizado_por: '',
        cliente: '',
        observaciones: '',
        revisado_por: '-',
        revisado_fecha: '',
        aprobado_por: '-',
        aprobado_fecha: '',
    }
}

function deriveContMatOrganica(state: ModuleFormState): ModuleFormState {
    const pesoSeco = toNumber(state.peso_especimen_seco_crisol_g)
    const pesoCalcinado = toNumber(state.peso_especimen_calcinado_g)
    const pesoCrisol = toNumber(state.peso_crisol_g)
    const contenido =
        pesoSeco !== null && pesoCalcinado !== null && pesoCrisol !== null && pesoSeco !== pesoCrisol
            ? round(((pesoSeco - pesoCalcinado) / (pesoSeco - pesoCrisol)) * 100, 3)
            : null

    return {
        ...state,
        contenido_materia_organica_pct: contenido,
    }
}

function deriveAzulMetileno(state: ModuleFormState): ModuleFormState {
    const concentracion = toNumber(state.concentracion_solucion_mg_ml) ?? 5
    const solucion = toNumber(state.solucion_usada_ml) ?? 10
    const materialConstante = toNumber(state.material_seco_constante_g) ?? 10
    const valor = materialConstante ? round((concentracion * solucion) / materialConstante, 3) : null

    return {
        ...state,
        concentracion_solucion_mg_ml: concentracion,
        solucion_usada_ml: solucion,
        material_seco_constante_g: materialConstante,
        valor_azul_metileno_mg_g: valor,
    }
}

function deriveImpOrganicas(state: ModuleFormState): ModuleFormState {
    const colorPlaca = toNumber(state.color_placa_organica)
    return {
        ...state,
        color_placa_organica: colorPlaca,
        color_estandar_gardner: colorPlaca && COLOR_GARDNER_MAP[colorPlaca] ? COLOR_GARDNER_MAP[colorPlaca] : null,
    }
}

function derivePartLivianas(state: ModuleFormState): ModuleFormState {
    const finoMasaPorcion = toNumber(state.fino_masa_porcion_g)
    const finoMasaFlotan = toNumber(state.fino_masa_flotan_g)
    const finoPct =
        finoMasaPorcion && finoMasaFlotan !== null ? round((finoMasaFlotan / finoMasaPorcion) * 100, 3) : null

    const gruesoPorciones = [
        toNumber(state.grueso_a_masa_porcion_g),
        toNumber(state.grueso_b_masa_porcion_g),
        toNumber(state.grueso_c_masa_porcion_g),
        toNumber(state.grueso_d_masa_porcion_g),
    ]
    const gruesoFlotan = [
        toNumber(state.grueso_a_masa_flotan_g),
        toNumber(state.grueso_b_masa_flotan_g),
        toNumber(state.grueso_c_masa_flotan_g),
        toNumber(state.grueso_d_masa_flotan_g),
    ]
    const sumaPorcion = round(gruesoPorciones.reduce<number>((acc, value) => acc + (value || 0), 0), 3)
    const sumaFlotan = round(gruesoFlotan.reduce<number>((acc, value) => acc + (value || 0), 0), 3)
    const gruesoPct = sumaPorcion ? round((sumaFlotan / sumaPorcion) * 100, 3) : null

    return {
        ...state,
        fino_particulas_livianas_pct: finoPct,
        grueso_suma_masa_porcion_g: sumaPorcion,
        grueso_suma_masa_flotan_g: sumaFlotan,
        grueso_particulas_livianas_pct: gruesoPct,
    }
}

function deriveTerrones(state: ModuleFormState): ModuleFormState {
    const next: ModuleFormState = { ...state }
    const prefixes = ['grueso_a', 'grueso_b', 'grueso_c', 'grueso_d', 'fino']
    let gruesoAntes = 0
    let gruesoPerdida = 0

    for (const prefix of prefixes) {
        const masaAntes = toNumber(next[`${prefix}_masa_antes_g`])
        const masaConstante = toNumber(next[`${prefix}_masa_constante_g`])
        const perdida = masaAntes !== null && masaConstante !== null ? round(masaAntes - masaConstante, 3) : null
        const pct = masaAntes ? round(((perdida || 0) / masaAntes) * 100, 3) : null

        next[`${prefix}_perdida_g`] = perdida
        next[`${prefix}_pct`] = pct

        if (prefix.startsWith('grueso')) {
            gruesoAntes += masaAntes || 0
            gruesoPerdida += perdida || 0
        }
    }

    next.grueso_total_pct = gruesoAntes ? round((gruesoPerdida / gruesoAntes) * 100, 3) : null
    next.fino_total_pct = toNumber(next.fino_pct)
    return next
}

type SulMagFinoRow = {
    gradacion_pct: number | null
    masa_fraccion_ensayo_g: number | null
    masa_material_retenido_g: number | null
    masa_perdida_g: number | null
    pct_pasa_post_ensayo: number | null
    pct_perdida_ponderado: number | null
}

type SulMagGruesoRow = {
    gradacion_pct: number | null
    masa_individual_tamiz_g: number | null
    masa_fraccion_ensayo_g: number | null
    masa_material_retenido_g: number | null
    masa_perdida_g: number | null
    pct_pasa_post_ensayo: number | null
    pct_perdida_ponderado: number | null
}

type SulMagCualitativoRow = {
    total_particulas: number | null
    rajadas_num: number | null
    rajadas_pct: number | null
    desmoronadas_num: number | null
    desmoronadas_pct: number | null
    fracturadas_num: number | null
    fracturadas_pct: number | null
    astilladas_num: number | null
    astilladas_pct: number | null
}

function createSulMagFinoRow(): SulMagFinoRow {
    return {
        gradacion_pct: null,
        masa_fraccion_ensayo_g: null,
        masa_material_retenido_g: null,
        masa_perdida_g: null,
        pct_pasa_post_ensayo: null,
        pct_perdida_ponderado: null,
    }
}

function createSulMagGruesoRow(): SulMagGruesoRow {
    return {
        gradacion_pct: null,
        masa_individual_tamiz_g: null,
        masa_fraccion_ensayo_g: null,
        masa_material_retenido_g: null,
        masa_perdida_g: null,
        pct_pasa_post_ensayo: null,
        pct_perdida_ponderado: null,
    }
}

function createSulMagCualitativoRow(): SulMagCualitativoRow {
    return {
        total_particulas: null,
        rajadas_num: null,
        rajadas_pct: null,
        desmoronadas_num: null,
        desmoronadas_pct: null,
        fracturadas_num: null,
        fracturadas_pct: null,
        astilladas_num: null,
        astilladas_pct: null,
    }
}

function deriveSulMagnesio(state: ModuleFormState): ModuleFormState {
    const finoRows = ((state.fino_rows as SulMagFinoRow[] | undefined) || emptyRow(createSulMagFinoRow, 5)).slice(0, 5)
    const gruesoRows = ((state.grueso_rows as SulMagGruesoRow[] | undefined) || emptyRow(createSulMagGruesoRow, 7)).slice(0, 7)
    const cualitativoRows = ((state.cualitativo_rows as SulMagCualitativoRow[] | undefined) || emptyRow(createSulMagCualitativoRow, 2)).slice(0, 2)

    const normalizedFino = finoRows.map((row) => {
        const masaPerdida =
            row.masa_fraccion_ensayo_g !== null && row.masa_material_retenido_g !== null
                ? round(row.masa_fraccion_ensayo_g - row.masa_material_retenido_g, 3)
                : null
        const pctPasa =
            row.masa_fraccion_ensayo_g ? round(((masaPerdida || 0) / row.masa_fraccion_ensayo_g) * 100, 3) : null
        const ponderado =
            row.gradacion_pct !== null && pctPasa !== null ? round((pctPasa * row.gradacion_pct) / 100, 3) : null
        return {
            ...row,
            masa_perdida_g: masaPerdida,
            pct_pasa_post_ensayo: pctPasa,
            pct_perdida_ponderado: ponderado,
        }
    })

    const normalizedGrueso = gruesoRows.map((row) => {
        const masaPerdida =
            row.masa_fraccion_ensayo_g !== null && row.masa_material_retenido_g !== null
                ? round(row.masa_fraccion_ensayo_g - row.masa_material_retenido_g, 3)
                : null
        const pctPasa =
            row.masa_fraccion_ensayo_g ? round(((masaPerdida || 0) / row.masa_fraccion_ensayo_g) * 100, 3) : null
        const ponderado =
            row.gradacion_pct !== null && pctPasa !== null ? round((pctPasa * row.gradacion_pct) / 100, 3) : null
        return {
            ...row,
            masa_perdida_g: masaPerdida,
            pct_pasa_post_ensayo: pctPasa,
            pct_perdida_ponderado: ponderado,
        }
    })

    const normalizedCualitativo = cualitativoRows.map((row) => {
        const total = row.total_particulas || 0
        const buildPct = (value: number | null) => (total ? round(((value || 0) / total) * 100, 3) : null)
        return {
            ...row,
            rajadas_pct: buildPct(row.rajadas_num),
            desmoronadas_pct: buildPct(row.desmoronadas_num),
            fracturadas_pct: buildPct(row.fracturadas_num),
            astilladas_pct: buildPct(row.astilladas_num),
        }
    })

    return {
        ...state,
        fino_rows: normalizedFino,
        fino_total_pct: round(normalizedFino.reduce<number>((acc, row) => acc + (row.pct_perdida_ponderado || 0), 0), 3),
        grueso_rows: normalizedGrueso,
        grueso_total_pct: round(normalizedGrueso.reduce<number>((acc, row) => acc + (row.pct_perdida_ponderado || 0), 0), 3),
        cualitativo_rows: normalizedCualitativo,
    }
}

function computeVoid(
    massWithCylinder: number | null,
    emptyCylinder: number | null,
    cylinderVolume: number | null,
    specificGravity: number | null,
): { netMass: number | null; voidPct: number | null } {
    if (massWithCylinder === null || emptyCylinder === null) {
        return { netMass: null, voidPct: null }
    }
    const netMass = round(massWithCylinder - emptyCylinder, 3)
    if (!cylinderVolume || !specificGravity) {
        return { netMass, voidPct: null }
    }
    return {
        netMass,
        voidPct: round(((cylinderVolume - (netMass / specificGravity)) / cylinderVolume) * 100, 3),
    }
}

function average(values: Array<number | null>): number | null {
    const present = values.filter((value): value is number => value !== null)
    return present.length > 0 ? round(present.reduce((acc, value) => acc + value, 0) / present.length, 3) : null
}

function deriveAngularidad(state: ModuleFormState): ModuleFormState {
    const volume = toNumber(state.volumen_cilindro_medida_ml)
    const emptyCylinder = toNumber(state.masa_cilindro_vacio_g)
    const gs = toNumber(state.gravedad_especifica_agregado_fino_gs)

    const a1 = computeVoid(toNumber(state.metodo_a_prueba_1_masa_agregado_cilindro_g), emptyCylinder, volume, gs)
    const a2 = computeVoid(toNumber(state.metodo_a_prueba_2_masa_agregado_cilindro_g), emptyCylinder, volume, gs)
    const b1 = computeVoid(toNumber(state.metodo_b_n8_n16_prueba_1_masa_agregado_cilindro_g), emptyCylinder, volume, gs)
    const b2 = computeVoid(toNumber(state.metodo_b_n8_n16_prueba_2_masa_agregado_cilindro_g), emptyCylinder, volume, gs)
    const b3 = computeVoid(toNumber(state.metodo_b_n16_n30_prueba_1_masa_agregado_cilindro_g), emptyCylinder, volume, gs)
    const b4 = computeVoid(toNumber(state.metodo_b_n16_n30_prueba_2_masa_agregado_cilindro_g), emptyCylinder, volume, gs)
    const b5 = computeVoid(toNumber(state.metodo_b_n30_n50_prueba_1_masa_agregado_cilindro_g), emptyCylinder, volume, gs)
    const b6 = computeVoid(toNumber(state.metodo_b_n30_n50_prueba_2_masa_agregado_cilindro_g), emptyCylinder, volume, gs)
    const c1 = computeVoid(toNumber(state.metodo_c_prueba_1_masa_agregado_cilindro_g), emptyCylinder, volume, gs)
    const c2 = computeVoid(toNumber(state.metodo_c_prueba_2_masa_agregado_cilindro_g), emptyCylinder, volume, gs)

    const metodoATotal = round(
        [
            toNumber(state.metodo_a_n8_n16_masa_g),
            toNumber(state.metodo_a_n16_n30_masa_g),
            toNumber(state.metodo_a_n30_n50_masa_g),
            toNumber(state.metodo_a_n50_n100_masa_g),
        ].reduce<number>((acc, value) => acc + (value || 0), 0),
        3,
    )
    const metodoBTotal = round(
        [
            toNumber(state.metodo_b_n8_n16_masa_g),
            toNumber(state.metodo_b_n16_n30_masa_g),
            toNumber(state.metodo_b_n30_n50_masa_g),
        ].reduce<number>((acc, value) => acc + (value || 0), 0),
        3,
    )

    return {
        ...state,
        metodo_a_total_masa_g: metodoATotal,
        metodo_a_prueba_1_masa_neta_agregado_g: a1.netMass,
        metodo_a_prueba_1_vacio_pct: a1.voidPct,
        metodo_a_prueba_2_masa_neta_agregado_g: a2.netMass,
        metodo_a_prueba_2_vacio_pct: a2.voidPct,
        metodo_a_angularidad_promedio_us_pct: average([a1.voidPct, a2.voidPct]),
        metodo_b_total_masa_g: metodoBTotal,
        metodo_b_n8_n16_prueba_1_masa_neta_agregado_g: b1.netMass,
        metodo_b_n8_n16_prueba_1_vacio_pct: b1.voidPct,
        metodo_b_n8_n16_prueba_2_masa_neta_agregado_g: b2.netMass,
        metodo_b_n8_n16_prueba_2_vacio_pct: b2.voidPct,
        metodo_b_n16_n30_prueba_1_masa_neta_agregado_g: b3.netMass,
        metodo_b_n16_n30_prueba_1_vacio_pct: b3.voidPct,
        metodo_b_n16_n30_prueba_2_masa_neta_agregado_g: b4.netMass,
        metodo_b_n16_n30_prueba_2_vacio_pct: b4.voidPct,
        metodo_b_n30_n50_prueba_1_masa_neta_agregado_g: b5.netMass,
        metodo_b_n30_n50_prueba_1_vacio_pct: b5.voidPct,
        metodo_b_n30_n50_prueba_2_masa_neta_agregado_g: b6.netMass,
        metodo_b_n30_n50_prueba_2_vacio_pct: b6.voidPct,
        metodo_b_angularidad_promedio_um_pct: average([b1.voidPct, b2.voidPct, b3.voidPct, b4.voidPct, b5.voidPct, b6.voidPct]),
        metodo_c_total_masa_g: toNumber(state.metodo_c_n8_n200_masa_g),
        metodo_c_prueba_1_masa_neta_agregado_g: c1.netMass,
        metodo_c_prueba_1_vacio_pct: c1.voidPct,
        metodo_c_prueba_2_masa_neta_agregado_g: c2.netMass,
        metodo_c_prueba_2_vacio_pct: c2.voidPct,
        metodo_c_angularidad_promedio_ur_pct: average([c1.voidPct, c2.voidPct]),
    }
}

function renderApprovalBoxes(tools: RenderTools) {
    return (
        <div className="grid gap-6 pt-2 md:grid-cols-2">
            {[
                ['Revisado', 'revisado_por', 'revisado_fecha'],
                ['Aprobado', 'aprobado_por', 'aprobado_fecha'],
            ].map(([label, personPath, datePath]) => (
                <div key={String(label)} className="border border-black p-4 text-[13px] text-black">
                    <p className="font-medium">{label}:</p>
                    <div className="mt-2 border-b border-black">
                        {tools.select(String(personPath), {
                            className: excelInputClass,
                            values: (personPath === 'revisado_por' ? FOOTER_REVIEWERS : FOOTER_APPROVERS).map((option) => ({
                                label: option,
                                value: option,
                            })),
                        })}
                    </div>
                    <div className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2">
                        <span>Fecha:</span>
                        <div className="border-b border-black">
                            {tools.text(String(datePath), {
                                placeholder: 'YYYY/MM/DD',
                                normalizeOnBlur: normalizeFlexibleDate,
                                className: excelInputClass,
                            })}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

function renderContMatOrganica(tools: RenderTools) {
    return (
        <div className="space-y-5">
            <div className="mx-auto max-w-[920px] overflow-x-auto">
                <table className={`${excelTableClass} min-w-[720px]`}>
                    <tbody>
                        <tr>
                            <th className={excelTitleCellClass} colSpan={4}>ANALISIS DEL AGREGADO</th>
                        </tr>
                        <tr>
                            <td className={`${excelCellClass} text-center w-[34px]`}>a</td>
                            <td className={excelCellClass}>N° de Crisol</td>
                            <td className={`${excelCellClass} text-center w-[78px]`}></td>
                            <td className={`${excelCellClass} p-0 w-[110px]`}>{tools.text('crisol_numero', { align: 'center', className: excelInputClass })}</td>
                        </tr>
                        <tr>
                            <td className={`${excelCellClass} text-center`}>b</td>
                            <td className={excelCellClass}>Peso del especimen seco + Peso de crisol</td>
                            <td className={`${excelCellClass} text-center`}>g</td>
                            <td className={`${excelCellClass} p-0`}>{tools.number('peso_especimen_seco_crisol_g', { className: excelInputClass })}</td>
                        </tr>
                        <tr>
                            <td className={`${excelCellClass} text-center`}>c</td>
                            <td className={excelCellClass}>Peso del especimen después de calcinado</td>
                            <td className={`${excelCellClass} text-center`}>g</td>
                            <td className={`${excelCellClass} p-0`}>{tools.number('peso_especimen_calcinado_g', { className: excelInputClass })}</td>
                        </tr>
                        <tr>
                            <td className={`${excelCellClass} text-center`}>d</td>
                            <td className={excelCellClass}>Peso de crisol</td>
                            <td className={`${excelCellClass} text-center`}>g</td>
                            <td className={`${excelCellClass} p-0`}>{tools.number('peso_crisol_g', { className: excelInputClass })}</td>
                        </tr>
                        <tr>
                            <td className={`${excelCellClass} text-center`}>e</td>
                            <td className={excelCellClass}>Contenido de Materia Orgánica</td>
                            <td className={`${excelCellClass} text-center`}>%</td>
                            <td className={`${excelCellClass} p-0`}>{tools.readonly('contenido_materia_organica_pct', { className: excelInputClass })}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-end">
                <div className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-3 pt-1">
                    <p className="text-[13px] font-semibold text-black">Nota:</p>
                    <div className="border-b border-black">
                        {tools.textarea('observaciones', { rows: 2, className: excelTextareaClass })}
                    </div>
                </div>

                <table className={excelTableClass}>
                    <tbody>
                        <tr>
                            <th className={excelHeadClass}>Equipo utilizado</th>
                            <th className={excelHeadClass}>Código</th>
                        </tr>
                        <tr>
                            <td className={excelCellClass}>Balanza 0.0001 g</td>
                            <td className={`${excelCellClass} p-0`}>{tools.text('balanza_0001_codigo', { align: 'center', className: excelInputClass })}</td>
                        </tr>
                        <tr>
                            <td className={excelCellClass}>Horno</td>
                            <td className={`${excelCellClass} p-0`}>{tools.text('horno_codigo', { align: 'center', className: excelInputClass })}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {renderApprovalBoxes(tools)}
        </div>
    )
}

function renderAzulMetileno(tools: RenderTools) {
    return (
        <div className="space-y-5">
            <div className="mx-auto max-w-[760px] overflow-x-auto">
                <table className={excelTableClass}>
                    <thead>
                        <tr>
                            <th className={excelHeadClass}>DESCRIPCIÓN</th>
                            <th className={excelHeadClass}>UND</th>
                            <th className={excelHeadClass}>DATOS</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className={excelCellClass}>Concentración de solución de azul de metileno</td>
                            <td className={`${excelCellClass} text-center`}>mg/ml</td>
                            <td className={`${excelCellClass} p-0`}>{tools.number('concentracion_solucion_mg_ml', { className: excelInputClass })}</td>
                        </tr>
                        <tr>
                            <td className={excelCellClass}>Solución usada</td>
                            <td className={`${excelCellClass} text-center`}>ml</td>
                            <td className={`${excelCellClass} p-0`}>{tools.number('solucion_usada_ml', { className: excelInputClass })}</td>
                        </tr>
                        <tr>
                            <td className={excelCellClass}>Material seco</td>
                            <td className={`${excelCellClass} text-center`}>g</td>
                            <td className={`${excelCellClass} p-0`}>{tools.number('material_seco_g', { className: excelInputClass })}</td>
                        </tr>
                        <tr>
                            <td className={excelCellClass}>Material seco constante</td>
                            <td className={`${excelCellClass} text-center`}>g</td>
                            <td className={`${excelCellClass} p-0`}>{tools.number('material_seco_constante_g', { className: excelInputClass })}</td>
                        </tr>
                        <tr>
                            <td className="border border-black px-2 py-1.5 text-[13px] font-semibold uppercase text-black">VALOR DE AZUL DE METILENO</td>
                            <td className={`${excelCellClass} text-center font-semibold`}>mg/g</td>
                            <td className={`${excelCellClass} p-0`}>{tools.readonly('valor_azul_metileno_mg_g', { className: excelInputClass })}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="grid min-h-[250px] items-end gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
                <table className={excelTableClass}>
                    <tbody>
                        <tr>
                            <th className={excelGroupTitleClass}>OBSERVACIONES</th>
                        </tr>
                        <tr>
                            <td className="border border-black p-0">{tools.textarea('observaciones', { rows: 8, className: excelTextareaClass })}</td>
                        </tr>
                    </tbody>
                </table>

                <table className={excelTableClass}>
                    <tbody>
                        <tr>
                            <th className={excelHeadClass}>Equipo utilizado</th>
                            <th className={excelHeadClass}>Código</th>
                        </tr>
                        <tr>
                            <td className={excelCellClass}>Balanza 0.0001 g</td>
                            <td className={`${excelCellClass} p-0`}>{tools.text('balanza_0001_codigo', { align: 'center', className: excelInputClass })}</td>
                        </tr>
                        <tr>
                            <td className={excelCellClass}>Horno 110°C</td>
                            <td className={`${excelCellClass} p-0`}>{tools.text('horno_codigo', { align: 'center', className: excelInputClass })}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {renderApprovalBoxes(tools)}
        </div>
    )
}

function renderImpOrganicas(tools: RenderTools) {
    return (
        <div className="space-y-5">
            <div className="mx-auto max-w-[700px] overflow-x-auto">
                <table className={excelTableClass}>
                    <tbody>
                        <tr>
                            <td className={excelCellClass}>TAMAÑO DE LA PARTICULA</td>
                            <td className={`${excelCellClass} p-0 w-[180px]`}>{tools.text('tamano_particula', { align: 'center', className: excelInputClass })}</td>
                        </tr>
                        <tr>
                            <td className={excelCellClass}>FECHA INICIO ENSAYO</td>
                            <td className={`${excelCellClass} p-0`}>{tools.text('fecha_inicio_ensayo', { align: 'center', className: excelInputClass })}</td>
                        </tr>
                        <tr>
                            <td className={excelCellClass}>FECHA FIN ENSAYO</td>
                            <td className={`${excelCellClass} p-0`}>{tools.text('fecha_fin_ensayo', { align: 'center', className: excelInputClass })}</td>
                        </tr>
                        <tr>
                            <td className={excelCellClass}>TEMPERATURA DE LA SOLUCION</td>
                            <td className={`${excelCellClass} p-0`}>{tools.number('temperatura_solucion_c', { className: excelInputClass })}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="mx-auto max-w-[700px] overflow-x-auto">
                <table className={excelTableClass}>
                    <thead>
                        <tr>
                            <th className={excelHeadClass}>N° de color en la placa orgánica</th>
                            <th className={excelHeadClass}>Color estándar Garden N°</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[1, 2, 3, 4, 5].map((value) => {
                            const selected = tools.numberValue('color_placa_organica') === value
                            return (
                                <tr key={value}>
                                    <td className={`${excelCellClass} text-center ${selected ? 'bg-[#dbe6f4]' : ''}`}>{value === 3 ? '3 (estándar)' : value}</td>
                                    <td className={`${excelCellClass} text-center ${selected ? 'bg-[#dbe6f4]' : ''}`}>{COLOR_GARDNER_MAP[value]}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="overflow-x-auto">
                    <table className={excelTableClass}>
                        <tbody>
                            <tr>
                                <td className={excelCellClass}>N° de color en la placa orgánica</td>
                                <td className={`${excelCellClass} p-0 w-[220px]`}>
                                    {tools.select('color_placa_organica', {
                                        className: excelSelectBlueClass,
                                        values: [
                                            { label: 'Seleccionar color', value: '' },
                                            { label: '1', value: '1' },
                                            { label: '2', value: '2' },
                                            { label: '3 (estándar)', value: '3' },
                                            { label: '4', value: '4' },
                                            { label: '5', value: '5' },
                                        ],
                                    })}
                                </td>
                            </tr>
                            <tr>
                                <td className={excelCellClass}>Color estándar Gardner N°</td>
                                <td className={`${excelCellClass} p-0`}>{tools.readonly('color_estandar_gardner', { className: excelReadonlyInputClass })}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="border border-black p-4 text-[13px] leading-relaxed text-black">
                    La equivalencia Gardner se completa automaticamente al elegir el color observado en la placa orgánica.
                </div>
            </div>

            {renderApprovalBoxes(tools)}
        </div>
    )
}

function renderPartLivianas(tools: RenderTools) {
    return (
        <div className="space-y-5">
            <div className="mx-auto max-w-[520px] overflow-x-auto">
                <table className={excelTableClass}>
                    <tbody>
                        <tr>
                            <td className={`${excelHeadClass} text-center`}>TAMANO MAXIMO NOMINAL PARTICULAS</td>
                            <td className={`${excelCellClass} p-0 w-[150px]`}>{tools.text('tamano_maximo_nominal', { align: 'center', className: excelInputClass })}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="overflow-x-auto">
                <table className={`${excelTableClass} min-w-[760px]`}>
                    <tbody>
                        <tr>
                            <th className={excelTitleCellClass} colSpan={4}>PARTICULAS LIVIANAS AGREGADO FINO</th>
                        </tr>
                        <tr>
                            <td className={`${excelCellClass} text-center`}>a</td>
                            <td className={excelCellClass}>Masa seca de la porcion de agregado mas grueso que el tamiz N° 50</td>
                            <td className={`${excelCellClass} text-center`}>(gr)</td>
                            <td className={`${excelCellClass} p-0 w-[180px]`}>{tools.number('fino_masa_porcion_g', { className: excelBlueInputClass })}</td>
                        </tr>
                        <tr>
                            <td className={`${excelCellClass} text-center`}>b</td>
                            <td className={excelCellClass}>Masa seca de particulas que flotan</td>
                            <td className={`${excelCellClass} text-center`}>(gr)</td>
                            <td className={`${excelCellClass} p-0`}>{tools.number('fino_masa_flotan_g', { className: excelBlueInputClass })}</td>
                        </tr>
                        <tr>
                            <td className={`${excelCellClass} text-center`}>c</td>
                            <td className={`${excelCellClass} text-center font-semibold`}>Particulas Livianas</td>
                            <td className={`${excelCellClass} text-center`}>(b)/(a)*100</td>
                            <td className={`${excelCellClass} p-0`}>{tools.readonly('fino_particulas_livianas_pct', { className: excelReadonlyInputClass })}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="overflow-x-auto">
                <table className={`${excelTableClass} min-w-[900px]`}>
                    <thead>
                        <tr>
                            <th className={excelTitleCellClass} colSpan={6}>PARTICULAS LIVIANAS AGREGADO GRUESO</th>
                        </tr>
                        <tr>
                            <th className={excelHeadClass} rowSpan={2}>N°</th>
                            <th className={excelHeadClass} colSpan={2}>Tamaño del Tamiz in</th>
                            <th className={excelHeadClass} rowSpan={2}>und</th>
                            <th className={excelHeadClass} rowSpan={2}>Masa seca de la porcion mas grueso que el tamiz No. 4</th>
                            <th className={excelHeadClass} rowSpan={2}>Masa seca de particulas que flotan</th>
                        </tr>
                        <tr>
                            <th className={excelHeadClass}>Pasa</th>
                            <th className={excelHeadClass}>Retenido</th>
                        </tr>
                    </thead>
                    <tbody>
                        {[
                            ['a', '2', '<2', 'grueso_a_masa_porcion_g', 'grueso_a_masa_flotan_g'],
                            ['b', '1', '1 1/2', 'grueso_b_masa_porcion_g', 'grueso_b_masa_flotan_g'],
                            ['c', '1/2', '3/4', 'grueso_c_masa_porcion_g', 'grueso_c_masa_flotan_g'],
                            ['d', '3/8', '', 'grueso_d_masa_porcion_g', 'grueso_d_masa_flotan_g'],
                        ].map(([label, pass, retained, portionPath, floatPath]) => (
                            <tr key={String(label)}>
                                <td className={`${excelCellClass} text-center`}>{label}</td>
                                <td className={`${excelCellClass} text-center`}>{pass}</td>
                                <td className={`${excelCellClass} text-center`}>{retained}</td>
                                <td className={`${excelCellClass} text-center`}>(gr)</td>
                                <td className={`${excelCellClass} p-0`}>{tools.number(String(portionPath), { className: excelBlueInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.number(String(floatPath), { className: excelBlueInputClass })}</td>
                            </tr>
                        ))}
                        <tr>
                            <td className={`${excelCellClass} text-center`}>e</td>
                            <td className={excelCellClass} colSpan={3}>Suma de la masa</td>
                            <td className={`${excelCellClass} p-0`}>{tools.readonly('grueso_suma_masa_porcion_g', { className: excelReadonlyInputClass })}</td>
                            <td className={`${excelCellClass} p-0`}>{tools.readonly('grueso_suma_masa_flotan_g', { className: excelReadonlyInputClass })}</td>
                        </tr>
                        <tr>
                            <td className={`${excelCellClass} text-center`}>f</td>
                            <td className={excelCellClass} colSpan={3}>Particulas Livianas</td>
                            <td className={`${excelCellClass} text-center`}>%</td>
                            <td className={`${excelCellClass} p-0`}>{tools.readonly('grueso_particulas_livianas_pct', { className: excelReadonlyInputClass })}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)] xl:items-start">
                <div className="overflow-x-auto">
                    <table className={excelTableClass}>
                        <thead>
                            <tr>
                                <th className={excelTitleCellClass} colSpan={3}>TABLA DE PESOS MINIMOS</th>
                            </tr>
                            <tr>
                                <th className={excelHeadClass} colSpan={2}>Tamaño maximo nominal</th>
                                <th className={excelHeadClass} rowSpan={2}>Masa minima muestra (gr)</th>
                            </tr>
                            <tr>
                                <th className={excelHeadClass}>Tamiz pulg.</th>
                                <th className={excelHeadClass}>mm</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td className={`${excelCellClass} text-center`}>N° 4</td><td className={`${excelCellClass} text-center`}>4.75</td><td className={`${excelCellClass} text-center`}>200</td></tr>
                            <tr><td className={`${excelCellClass} text-center`}>3/8"</td><td className={`${excelCellClass} text-center`}>9.5</td><td className={`${excelCellClass} text-center`}>1500</td></tr>
                            <tr><td className={`${excelCellClass} text-center`}>1/2" a 3/4"</td><td className={`${excelCellClass} text-center`}>12.5 a 19.0</td><td className={`${excelCellClass} text-center`}>3000</td></tr>
                            <tr><td className={`${excelCellClass} text-center`}>1" a 1 1/2"</td><td className={`${excelCellClass} text-center`}>25 a 37.5</td><td className={`${excelCellClass} text-center`}>5000</td></tr>
                            <tr><td className={`${excelCellClass} text-center`}>2" a mas</td><td className={`${excelCellClass} text-center`}>50 a mas</td><td className={`${excelCellClass} text-center`}>10000</td></tr>
                        </tbody>
                    </table>
                </div>

                <div className="space-y-4">
                    {renderApprovalBoxes(tools)}
                    <div className="border-t-2 border-b-2 border-[#294d92] px-4 py-3 text-center text-[12px] leading-tight text-black">
                        <p>WEB: www.geofal.com.pe E-MAIL: laboratorio@geofal.com.pe | geofal.sac@gmail.com</p>
                        <p>Av. Marañón 763, Los Olivos-Lima | Teléfono 01522-1851</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

function renderTerrones(tools: RenderTools) {
    const gruesoRows = [
        ['1 1/2', '', 'grueso_a'],
        ['1 1/2', '3/4', 'grueso_b'],
        ['3/4', '3/8', 'grueso_c'],
        ['3/8', 'No. 4', 'grueso_d'],
    ]

    return (
        <div className="space-y-5">
            <div className="overflow-x-auto">
                <table className={`${excelTableClass} min-w-[1100px]`}>
                    <thead>
                        <tr>
                            <th className={excelTitleCellClass} colSpan={7}>ANALISIS AGREGADO GRUESO</th>
                        </tr>
                        <tr>
                            <th className={excelHeadClass} colSpan={2}>Tamaño del Tamiz</th>
                            <th className={excelHeadClass} rowSpan={2}>Masa de Muestra antes de ensayo<br />g<br /><br />(a)</th>
                            <th className={excelHeadClass} rowSpan={2}>Masa seca despues de ensayo<br />g<br /><br />(b)</th>
                            <th className={excelHeadClass} rowSpan={2}>Masa seca a peso constante<br />g<br /><br />(c)</th>
                            <th className={excelHeadClass} rowSpan={2}>Perdida de Masa<br />g<br /><br />d =(a-c)</th>
                            <th className={excelHeadClass} rowSpan={2}>Arcilla y Particulas Friables<br />%<br /><br />e = (d/a) x 100</th>
                        </tr>
                        <tr>
                            <th className={excelHeadClass}>Pasante (in)</th>
                            <th className={excelHeadClass}>Retenido (in)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {gruesoRows.map(([pass, retained, prefix]) => (
                            <tr key={String(prefix)}>
                                <td className={`${excelCellClass} text-center`}>{pass}</td>
                                <td className={`${excelCellClass} text-center`}>{retained}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.number(`${prefix}_masa_antes_g`, { className: excelInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.number(`${prefix}_masa_seca_despues_g`, { className: excelInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.number(`${prefix}_masa_constante_g`, { className: excelInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.readonly(`${prefix}_perdida_g`, { className: excelInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.readonly(`${prefix}_pct`, { className: excelInputClass })}</td>
                            </tr>
                        ))}
                        <tr>
                            <td className={excelCellClass} colSpan={6}>Total de Arcilla y Particulas Friables&nbsp;&nbsp;%</td>
                            <td className={`${excelCellClass} p-0`}>{tools.readonly('grueso_total_pct', { className: excelInputClass })}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="overflow-x-auto">
                <table className={`${excelTableClass} min-w-[1100px]`}>
                    <thead>
                        <tr>
                            <th className={excelTitleCellClass} colSpan={7}>ANALISIS AGREGADO FINO</th>
                        </tr>
                        <tr>
                            <th className={excelHeadClass} colSpan={2}>Tamaño del Tamiz</th>
                            <th className={excelHeadClass} rowSpan={2}>Masa de Muestra antes de ensayo<br />g<br /><br />(a)</th>
                            <th className={excelHeadClass} rowSpan={2}>Masa seca despues de ensayo<br />g<br /><br />(b)</th>
                            <th className={excelHeadClass} rowSpan={2}>Masa seca a peso constante<br />g<br /><br />(c)</th>
                            <th className={excelHeadClass} rowSpan={2}>Perdida de Masa<br />g<br /><br />d =(a-c)</th>
                            <th className={excelHeadClass} rowSpan={2}>Arcilla y Particulas Friables<br />%<br /><br />e = (d/a) x 100</th>
                        </tr>
                        <tr>
                            <th className={excelHeadClass}>Pasante (in)</th>
                            <th className={excelHeadClass}>Retenido (in)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className={`${excelCellClass} text-center`}>No. 4</td>
                            <td className={`${excelCellClass} text-center`}>No. 16</td>
                            <td className={`${excelCellClass} p-0`}>{tools.number('fino_masa_antes_g', { className: excelInputClass })}</td>
                            <td className={`${excelCellClass} p-0`}>{tools.number('fino_masa_seca_despues_g', { className: excelInputClass })}</td>
                            <td className={`${excelCellClass} p-0`}>{tools.number('fino_masa_constante_g', { className: excelInputClass })}</td>
                            <td className={`${excelCellClass} p-0`}>{tools.readonly('fino_perdida_g', { className: excelInputClass })}</td>
                            <td className={`${excelCellClass} p-0`}>{tools.readonly('fino_pct', { className: excelInputClass })}</td>
                        </tr>
                        <tr>
                            <td className={excelCellClass} colSpan={6}>Total de Arcilla y Particulas Friables&nbsp;&nbsp;%</td>
                            <td className={`${excelCellClass} p-0`}>{tools.readonly('fino_total_pct', { className: excelInputClass })}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
                <div className="space-y-5">
                    <table className={excelTableClass}>
                        <tbody>
                            <tr>
                                <td className={excelCellClass}>La muestra se secó en horno a masa constante a 110 5°C.</td>
                                <td className={`${excelCellClass} p-0 w-[140px]`}>
                                    {tools.select('secado_horno', {
                                        className: excelInputClass,
                                        values: [
                                            { label: 'SI o NO', value: '' },
                                            { label: 'SI', value: 'SI' },
                                            { label: 'NO', value: 'NO' },
                                        ],
                                    })}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <table className={excelTableClass}>
                        <thead>
                            <tr>
                                <th className={excelTitleCellClass}>TABLA DE PESOS MINIMOS</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border border-black px-4 py-3 text-center text-[13px] leading-tight text-black">
                                    <p className="font-semibold">Size of Particles Making Up Test Sample &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Mass of Test Sample, min, g</p>
                                    <div className="mt-3 space-y-1">
                                        <p>4.75 to 9.5-mm (No. 4 to ⅜-in.)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;1000</p>
                                        <p>9.5 to 19.0-mm (⅜ to ¾-in.)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;2000</p>
                                        <p>19.0 to 37.5-mm (¾ to 1½-in.)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;3000</p>
                                        <p>Over 37.5-mm (1½-in.)&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;5000</p>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-3 pt-1">
                        <p className="text-[13px] font-semibold text-black">NOTA:</p>
                        <div className="border-b border-black">
                            {tools.textarea('observaciones', { rows: 3, className: excelTextareaClass })}
                        </div>
                    </div>
                </div>

                <table className={excelTableClass}>
                    <tbody>
                        <tr>
                            <th className={excelHeadClass}>Equipo utilizado</th>
                            <th className={excelHeadClass}>Código</th>
                        </tr>
                        <tr>
                            <td className={excelCellClass}>Balanza 0.1 g</td>
                            <td className={`${excelCellClass} p-0`}>{tools.text('balanza_01_codigo', { align: 'center', className: excelInputClass })}</td>
                        </tr>
                        <tr>
                            <td className={excelCellClass}>Horno 110 ± 5°C</td>
                            <td className={`${excelCellClass} p-0`}>{tools.text('horno_codigo', { align: 'center', className: excelInputClass })}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {renderApprovalBoxes(tools)}
        </div>
    )
}

function renderSulMagnesio(tools: RenderTools) {
    const fineRows = [
        ['No. 30', 'No. 50'],
        ['No. 16', 'No. 30'],
        ['No. 8', 'No. 16'],
        ['No. 4', 'No. 8'],
        ['3/8 in.', 'No. 4'],
    ]
    const coarseRows = [
        ['2 1/2 in.', '2 in.'],
        ['2 in.', '1 1/2 in.'],
        ['1 1/2 in.', '1 in.'],
        ['1 in.', '3/4 in.'],
        ['3/4 in.', '1/2 in.'],
        ['1/2 in.', '3/8 in.'],
        ['3/8 in.', 'No. 4'],
    ]
    const qualitativeRows = [
        ['2 1/2 in.', '1 1/2 in.'],
        ['1 1/2 in.', '3/4 in.'],
    ]

    return (
        <div className="space-y-5">
            <div className="overflow-x-auto">
                <table className={`${excelTableClass} min-w-[1160px]`}>
                    <thead>
                        <tr>
                            <th className={excelTitleCellClass} colSpan={8}>Ensayo de Inalterabilidad del Agregado Fino (Examen cuantitativo)</th>
                        </tr>
                        <tr>
                            <th className={excelHeadClass}>Pasa el tamiz normalizado</th>
                            <th className={excelHeadClass}>Retenido sobre el tamiz normalizado</th>
                            <th className={excelHeadClass}>Gradación de la muestra original (*)</th>
                            <th className={excelHeadClass}>Masa de la fracción de ensayo</th>
                            <th className={excelHeadClass}>Masa del material retenido en el tamiz especificado</th>
                            <th className={excelHeadClass}>Masa de perdida en cada fracción</th>
                            <th className={excelHeadClass}>Porcentaje que pasa los tamices después del ensayo</th>
                            <th className={excelHeadClass}>Porcentaje de perdida ponderado</th>
                        </tr>
                        <tr>
                            <th className={excelHeadClass}></th>
                            <th className={excelHeadClass}></th>
                            <th className={excelHeadClass}>(%)<br />[1]</th>
                            <th className={excelHeadClass}>(g)<br />[2]</th>
                            <th className={excelHeadClass}>(g)<br />[3]</th>
                            <th className={excelHeadClass}>(g)<br />[4]=[2-3]</th>
                            <th className={excelHeadClass}>(%)<br />[5]=([4/2]*100)</th>
                            <th className={excelHeadClass}>(%)<br />[6]=([5*1]/100)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {fineRows.map(([pass, retained], index) => (
                            <tr key={`${pass}-${retained}`}>
                                <td className={`${excelCellClass} text-center`}>{pass}</td>
                                <td className={`${excelCellClass} text-center`}>{retained}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.number(`fino_rows.${index}.gradacion_pct`, { className: excelBlueInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.number(`fino_rows.${index}.masa_fraccion_ensayo_g`, { className: excelBlueInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.number(`fino_rows.${index}.masa_material_retenido_g`, { className: excelBlueInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.readonly(`fino_rows.${index}.masa_perdida_g`, { className: excelReadonlyInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.readonly(`fino_rows.${index}.pct_pasa_post_ensayo`, { className: excelReadonlyInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.readonly(`fino_rows.${index}.pct_perdida_ponderado`, { className: excelReadonlyInputClass })}</td>
                            </tr>
                        ))}
                        <tr>
                            <td className={`${excelCellClass} text-right font-semibold`} colSpan={7}>Σ Porcentaje de perdida</td>
                            <td className={`${excelCellClass} p-0`}>{tools.readonly('fino_total_pct', { className: excelReadonlyInputClass })}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <p className="text-[12px] italic leading-tight text-black">(*) se considera el % retenido en cada tamiz del ensayo granulométrico</p>

            <div className="overflow-x-auto">
                <table className={`${excelTableClass} min-w-[1260px]`}>
                    <thead>
                        <tr>
                            <th className={excelTitleCellClass} colSpan={9}>Ensayo de Inalterabilidad del Agregado Grueso (Examen cuantitativo)</th>
                        </tr>
                        <tr>
                            <th className={excelHeadClass}>Pasa el tamiz normalizado</th>
                            <th className={excelHeadClass}>Retenido sobre el tamiz normalizado</th>
                            <th className={excelHeadClass}>Gradación de la muestra original (*)</th>
                            <th className={excelHeadClass}>Masa individual en cada tamiz</th>
                            <th className={excelHeadClass}>Masa de la fracción de ensayo</th>
                            <th className={excelHeadClass}>Masa del material retenido en el tamiz especificado</th>
                            <th className={excelHeadClass}>Masa de perdida en cada fracción</th>
                            <th className={excelHeadClass}>Porcentaje que pasa los tamices después del ensayo</th>
                            <th className={excelHeadClass}>Porcentaje de perdida ponderado</th>
                        </tr>
                        <tr>
                            <th className={excelHeadClass}></th>
                            <th className={excelHeadClass}></th>
                            <th className={excelHeadClass}>(%)<br />[1]</th>
                            <th className={excelHeadClass}>(g)<br />[2]</th>
                            <th className={excelHeadClass}>(g)<br />[3]</th>
                            <th className={excelHeadClass}>(g)<br />[4]</th>
                            <th className={excelHeadClass}>(g)<br />[5]=[3-4]</th>
                            <th className={excelHeadClass}>(%)<br />[6]=([5/3]*100)</th>
                            <th className={excelHeadClass}>(%)<br />[7]=([6*1]/100)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {coarseRows.map(([pass, retained], index) => (
                            <tr key={`${pass}-${retained}`}>
                                <td className={`${excelCellClass} text-center`}>{pass}</td>
                                <td className={`${excelCellClass} text-center`}>{retained}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.number(`grueso_rows.${index}.gradacion_pct`, { className: excelBlueInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.number(`grueso_rows.${index}.masa_individual_tamiz_g`, { className: excelBlueInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.number(`grueso_rows.${index}.masa_fraccion_ensayo_g`, { className: excelBlueInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.number(`grueso_rows.${index}.masa_material_retenido_g`, { className: excelBlueInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.readonly(`grueso_rows.${index}.masa_perdida_g`, { className: excelReadonlyInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.readonly(`grueso_rows.${index}.pct_pasa_post_ensayo`, { className: excelReadonlyInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.readonly(`grueso_rows.${index}.pct_perdida_ponderado`, { className: excelReadonlyInputClass })}</td>
                            </tr>
                        ))}
                        <tr>
                            <td className={`${excelCellClass} text-right font-semibold`} colSpan={8}>Σ Porcentaje de perdida</td>
                            <td className={`${excelCellClass} p-0`}>{tools.readonly('grueso_total_pct', { className: excelReadonlyInputClass })}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="space-y-1 text-[12px] italic leading-tight text-black">
                <p>(*) se considera el % retenido en cada tamiz del ensayo granulométrico</p>
                <p>Nota 1; Solo se ensayarán las fracciones individuales que contengan más del 5% en masa retenido en el tamiz.</p>
                <p>Nota 2; Cuando se ensaye un agregado fino y grueso con cantidades apreciables en la fracción menor N° 4 y mayor N° 4, se ensayan por separado.</p>
            </div>

            <div className="overflow-x-auto">
                <table className={`${excelTableClass} min-w-[1240px]`}>
                    <thead>
                        <tr>
                            <th className={excelTitleCellClass} colSpan={11}>Examen Cualitativo de las partículas mayores a 3/4 in.</th>
                        </tr>
                        <tr>
                            <th className={excelHeadClass} rowSpan={2}>Pasa el tamiz normalizado</th>
                            <th className={excelHeadClass} rowSpan={2}>Retenido sobre el tamiz normalizado</th>
                            <th className={excelHeadClass} rowSpan={2}>Total de partículas antes del ensayo</th>
                            <th className={excelHeadClass} colSpan={8}>Partículas Que Exhiben Fallas</th>
                        </tr>
                        <tr>
                            <th className={excelHeadClass} colSpan={2}>Rajadas</th>
                            <th className={excelHeadClass} colSpan={2}>Desmoronadas</th>
                            <th className={excelHeadClass} colSpan={2}>Fracturadas</th>
                            <th className={excelHeadClass} colSpan={2}>Astilladas</th>
                        </tr>
                        <tr>
                            <th className={excelHeadClass}></th>
                            <th className={excelHeadClass}></th>
                            <th className={excelHeadClass}>No.</th>
                            <th className={excelHeadClass}>No.</th>
                            <th className={excelHeadClass}>%</th>
                            <th className={excelHeadClass}>No.</th>
                            <th className={excelHeadClass}>%</th>
                            <th className={excelHeadClass}>No.</th>
                            <th className={excelHeadClass}>%</th>
                            <th className={excelHeadClass}>No.</th>
                            <th className={excelHeadClass}>%</th>
                        </tr>
                    </thead>
                    <tbody>
                        {qualitativeRows.map(([pass, retained], index) => (
                            <tr key={`${pass}-${retained}`}>
                                <td className={`${excelCellClass} text-center`}>{pass}</td>
                                <td className={`${excelCellClass} text-center`}>{retained}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.number(`cualitativo_rows.${index}.total_particulas`, { className: excelBlueInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.number(`cualitativo_rows.${index}.rajadas_num`, { className: excelBlueInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.readonly(`cualitativo_rows.${index}.rajadas_pct`, { className: excelReadonlyInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.number(`cualitativo_rows.${index}.desmoronadas_num`, { className: excelBlueInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.readonly(`cualitativo_rows.${index}.desmoronadas_pct`, { className: excelReadonlyInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.number(`cualitativo_rows.${index}.fracturadas_num`, { className: excelBlueInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.readonly(`cualitativo_rows.${index}.fracturadas_pct`, { className: excelReadonlyInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.number(`cualitativo_rows.${index}.astilladas_num`, { className: excelBlueInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.readonly(`cualitativo_rows.${index}.astilladas_pct`, { className: excelReadonlyInputClass })}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
                <div className="overflow-x-auto">
                    <table className={`${excelTableClass} min-w-[620px]`}>
                        <thead>
                            <tr>
                                <th className={excelTitleCellClass} colSpan={4}>Tabla de masa mínima de la muestra (g)</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr><td className={`${excelCellClass} text-center`}>2 1/2 in.</td><td className={`${excelCellClass} text-center`}>2 in.</td><td className={`${excelCellClass} text-center`}>3000 ± 300</td><td className={`${excelCellClass} text-center`}>5000 ± 300</td></tr>
                            <tr><td className={`${excelCellClass} text-center`}>2 in.</td><td className={`${excelCellClass} text-center`}>1 1/2 in.</td><td className={`${excelCellClass} text-center`}>2000 ± 200</td><td className={excelCellClass}></td></tr>
                            <tr><td className={`${excelCellClass} text-center`}>1 1/2 in.</td><td className={`${excelCellClass} text-center`}>1 in.</td><td className={`${excelCellClass} text-center`}>1000 ± 50</td><td className={`${excelCellClass} text-center`}>1500 ± 50</td></tr>
                            <tr><td className={`${excelCellClass} text-center`}>1 in.</td><td className={`${excelCellClass} text-center`}>3/4 in.</td><td className={`${excelCellClass} text-center`}>500 ± 30</td><td className={excelCellClass}></td></tr>
                            <tr><td className={`${excelCellClass} text-center`}>3/4 in.</td><td className={`${excelCellClass} text-center`}>1/2 in.</td><td className={`${excelCellClass} text-center`}>670 ± 10</td><td className={`${excelCellClass} text-center`}>1000 ± 10</td></tr>
                            <tr><td className={`${excelCellClass} text-center`}>1/2 in.</td><td className={`${excelCellClass} text-center`}>3/8 in.</td><td className={`${excelCellClass} text-center`}>300 ± 5</td><td className={excelCellClass}></td></tr>
                            <tr><td className={`${excelCellClass} text-center`}>3/8 in.</td><td className={`${excelCellClass} text-center`}>No. 4</td><td className={`${excelCellClass} text-center`}>300 ± 5</td><td className={`${excelCellClass} text-center`}>300 ± 5</td></tr>
                            <tr><td className={`${excelCellClass} text-center`} colSpan={2}>&lt; No. 4</td><td className={`${excelCellClass} text-center`}>100 ± 0.1</td><td className={excelCellClass}></td></tr>
                        </tbody>
                    </table>
                </div>

                <table className={excelTableClass}>
                    <tbody>
                        <tr>
                            <th className={excelTitleCellClass} colSpan={2}>Equipos utilizados</th>
                        </tr>
                        <tr>
                            <th className={excelHeadClass}>Equipo utilizado</th>
                            <th className={excelHeadClass}>Código</th>
                        </tr>
                        <tr>
                            <td className={excelCellClass}>Horno</td>
                            <td className={`${excelCellClass} p-0`}>{tools.text('horno_codigo', { align: 'center', className: excelInputClass })}</td>
                        </tr>
                        <tr>
                            <td className={excelCellClass}>Balanza 0.1 g</td>
                            <td className={`${excelCellClass} p-0`}>{tools.text('balanza_01_codigo', { align: 'center', className: excelInputClass })}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {renderApprovalBoxes(tools)}
        </div>
    )
}

function renderAngularidad(tools: RenderTools) {
    const metodoATrials = [
        ['N° 8 al N° 100', 1, 'metodo_a_prueba_1'],
        ['', 2, 'metodo_a_prueba_2'],
    ]
    const metodoBTrials = [
        ['N° 8 al N° 16', 1, 'metodo_b_n8_n16_prueba_1'],
        ['', 2, 'metodo_b_n8_n16_prueba_2'],
        ['N° 16 al N° 30', 1, 'metodo_b_n16_n30_prueba_1'],
        ['', 2, 'metodo_b_n16_n30_prueba_2'],
        ['N° 30 al N° 50', 1, 'metodo_b_n30_n50_prueba_1'],
        ['', 2, 'metodo_b_n30_n50_prueba_2'],
    ]
    const metodoCTrials = [
        ['N° 8 al N° 200', 1, 'metodo_c_prueba_1'],
        ['', 2, 'metodo_c_prueba_2'],
    ]

    return (
        <div className="space-y-5">
            <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_420px] xl:items-start">
                <div className="pt-2 text-[13px] leading-tight text-black">
                    Procedimiento para la medición de vacíos
                </div>
                <div className="border-b border-black">
                    {tools.select('procedimiento_medicion_vacios', {
                        className: excelInputClass,
                        values: [
                            { label: 'Método A o Método B o Método C', value: '' },
                            { label: 'Método A', value: 'Metodo A' },
                            { label: 'Método B', value: 'Metodo B' },
                            { label: 'Método C', value: 'Metodo C' },
                        ],
                    })}
                </div>
                <table className={excelTableClass}>
                    <tbody>
                        <tr>
                            <td className={excelCellClass}>Volumen del cilindro de medida (ml)</td>
                            <td className={`${excelCellClass} p-0 w-[140px]`}>{tools.number('volumen_cilindro_medida_ml', { className: excelInputClass })}</td>
                        </tr>
                        <tr>
                            <td className={excelCellClass}>Masa del cilindro vacio (g)</td>
                            <td className={`${excelCellClass} p-0`}>{tools.number('masa_cilindro_vacio_g', { className: excelInputClass })}</td>
                        </tr>
                        <tr>
                            <td className={excelCellClass}>Gravedad especifica del agregado fino (Gs)</td>
                            <td className={`${excelCellClass} p-0`}>{tools.number('gravedad_especifica_agregado_fino_gs', { className: excelInputClass })}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="space-y-2">
                <p className="text-[13px] font-semibold text-black">MUESTRA DE PRUEBA</p>
                <div className="overflow-x-auto">
                    <table className={`${excelTableClass} min-w-[840px]`}>
                        <tbody>
                            <tr>
                                <th className={excelGroupTitleClass} colSpan={4}>Método de prueba A (Muestra graduada estándar)</th>
                            </tr>
                            <tr>
                                <th className={excelHeadClass}>Pasa el tamiz</th>
                                <th className={excelHeadClass}>Retenido en el tamiz</th>
                                <th className={excelHeadClass}>Masa (g)</th>
                                <th className={excelHeadClass}>Masa especificada (g)</th>
                            </tr>
                            {[
                                ['N° 8', 'N° 16', 'metodo_a_n8_n16_masa_g', '44 ± 0.2'],
                                ['N° 16', 'N° 30', 'metodo_a_n16_n30_masa_g', '57 ± 0.2'],
                                ['N° 30', 'N° 50', 'metodo_a_n30_n50_masa_g', '72 ± 0.2'],
                                ['N° 50', 'N° 100', 'metodo_a_n50_n100_masa_g', '17 ± 0.2'],
                            ].map(([pass, retained, path, expected]) => (
                                <tr key={String(path)}>
                                    <td className={`${excelCellClass} text-center`}>{pass}</td>
                                    <td className={`${excelCellClass} text-center`}>{retained}</td>
                                    <td className={`${excelCellClass} p-0`}>{tools.number(String(path), { className: excelBlueInputClass })}</td>
                                    <td className={`${excelCellClass} text-center`}>{expected}</td>
                                </tr>
                            ))}
                            <tr>
                                <td className={excelCellClass}>Total</td>
                                <td className={excelCellClass}></td>
                                <td className={`${excelCellClass} p-0`}>{tools.readonly('metodo_a_total_masa_g', { className: excelReadonlyInputClass })}</td>
                                <td className={`${excelCellClass} text-center`}>190</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="overflow-x-auto">
                    <table className={`${excelTableClass} min-w-[1080px]`}>
                        <tbody>
                            <tr>
                                <th className={excelGroupTitleClass} colSpan={6}>DETERMINACION DE LOS VACIOS</th>
                            </tr>
                            <tr>
                                <th className={excelHeadClass}>Muestra graduada estándar</th>
                                <th className={excelHeadClass}>N° Prueba</th>
                                <th className={excelHeadClass}>Masa agregado + cilindro (g)</th>
                                <th className={excelHeadClass}>Masa neta del agregado (g)</th>
                                <th className={excelHeadClass}>Vacío de la muestra sin compactar (%)</th>
                                <th className={excelHeadClass}>Angularidad promedio Us (%)</th>
                            </tr>
                            {metodoATrials.map(([label, trial, prefix], index) => (
                                <tr key={String(prefix)}>
                                    <td className={excelCellClass}>{label}</td>
                                    <td className={`${excelCellClass} text-center`}>{trial}</td>
                                    <td className={`${excelCellClass} p-0`}>{tools.number(`${prefix}_masa_agregado_cilindro_g`, { className: excelBlueInputClass })}</td>
                                    <td className={`${excelCellClass} p-0`}>{tools.readonly(`${prefix}_masa_neta_agregado_g`, { className: excelReadonlyInputClass })}</td>
                                    <td className={`${excelCellClass} p-0`}>{tools.readonly(`${prefix}_vacio_pct`, { className: excelReadonlyInputClass })}</td>
                                    <td className={`${excelCellClass} p-0`}>
                                        {index === metodoATrials.length - 1
                                            ? tools.readonly('metodo_a_angularidad_promedio_us_pct', { className: excelReadonlyInputClass })
                                            : <div className={excelReadonlySpacerClass} />}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className={`${excelTableClass} min-w-[840px]`}>
                    <tbody>
                        <tr>
                            <th className={excelGroupTitleClass} colSpan={4}>Método de prueba B (Fracciones de tamaño individual)</th>
                        </tr>
                        <tr>
                            <th className={excelHeadClass}>Pasa el tamiz</th>
                            <th className={excelHeadClass}>Retenido en el tamiz</th>
                            <th className={excelHeadClass}>Masa (g)</th>
                            <th className={excelHeadClass}>Verificación de Masa</th>
                        </tr>
                        {[
                            ['N° 8', 'N° 16', 'metodo_b_n8_n16_masa_g'],
                            ['N° 16', 'N° 30', 'metodo_b_n16_n30_masa_g'],
                            ['N° 30', 'N° 50', 'metodo_b_n30_n50_masa_g'],
                        ].map(([pass, retained, path]) => (
                            <tr key={String(path)}>
                                <td className={`${excelCellClass} text-center`}>{pass}</td>
                                <td className={`${excelCellClass} text-center`}>{retained}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.number(String(path), { className: excelBlueInputClass })}</td>
                                <td className={`${excelCellClass} text-center`}>190 ± 1.0</td>
                            </tr>
                        ))}
                        <tr>
                            <td className={excelCellClass}>Total</td>
                            <td className={excelCellClass}></td>
                            <td className={`${excelCellClass} p-0`}>{tools.readonly('metodo_b_total_masa_g', { className: excelReadonlyInputClass })}</td>
                            <td className={excelCellClass}></td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="overflow-x-auto">
                <table className={`${excelTableClass} min-w-[1120px]`}>
                    <tbody>
                        <tr>
                            <th className={excelGroupTitleClass} colSpan={6}>DETERMINACION DE LOS VACIOS</th>
                        </tr>
                        <tr>
                            <th className={excelHeadClass}>Fracciones de tamaño individual</th>
                            <th className={excelHeadClass}>N° Prueba</th>
                            <th className={excelHeadClass}>Masa agregado + cilindro (g)</th>
                            <th className={excelHeadClass}>Masa neta del agregado (g)</th>
                            <th className={excelHeadClass}>Vacío de la muestra sin compactar (%)</th>
                            <th className={excelHeadClass}>Angularidad promedio Um (%)</th>
                        </tr>
                        {metodoBTrials.map(([label, trial, prefix], index) => (
                            <tr key={String(prefix)}>
                                <td className={excelCellClass}>{label}</td>
                                <td className={`${excelCellClass} text-center`}>{trial}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.number(`${prefix}_masa_agregado_cilindro_g`, { className: excelBlueInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.readonly(`${prefix}_masa_neta_agregado_g`, { className: excelReadonlyInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.readonly(`${prefix}_vacio_pct`, { className: excelReadonlyInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>
                                    {index === metodoBTrials.length - 1
                                        ? tools.readonly('metodo_b_angularidad_promedio_um_pct', { className: excelReadonlyInputClass })
                                        : <div className={excelReadonlySpacerClass} />}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="overflow-x-auto">
                <table className={`${excelTableClass} min-w-[840px]`}>
                    <tbody>
                        <tr>
                            <th className={excelGroupTitleClass} colSpan={4}>Método de prueba C (Granulometría natural)</th>
                        </tr>
                        <tr>
                            <th className={excelHeadClass}>Pasa el tamiz</th>
                            <th className={excelHeadClass}>Retenido en el tamiz</th>
                            <th className={excelHeadClass}>Masa (g)</th>
                            <th className={excelHeadClass}>Verificación de Masa</th>
                        </tr>
                        <tr>
                            <td className={`${excelCellClass} text-center`}>N° 8</td>
                            <td className={`${excelCellClass} text-center`}>N° 200</td>
                            <td className={`${excelCellClass} p-0`}>{tools.number('metodo_c_n8_n200_masa_g', { className: excelBlueInputClass })}</td>
                            <td className={`${excelCellClass} text-center`}>190 ± 1.0</td>
                        </tr>
                        <tr>
                            <td className={excelCellClass}>Total</td>
                            <td className={excelCellClass}></td>
                            <td className={`${excelCellClass} p-0`}>{tools.readonly('metodo_c_total_masa_g', { className: excelReadonlyInputClass })}</td>
                            <td className={`${excelCellClass} text-center`}>190</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div className="overflow-x-auto">
                <table className={`${excelTableClass} min-w-[1120px]`}>
                    <tbody>
                        <tr>
                            <th className={excelGroupTitleClass} colSpan={6}>DETERMINACION DE LOS VACIOS</th>
                        </tr>
                        <tr>
                            <th className={excelHeadClass}>Granulometría natural</th>
                            <th className={excelHeadClass}>N° Prueba</th>
                            <th className={excelHeadClass}>Masa agregado + cilindro (g)</th>
                            <th className={excelHeadClass}>Masa neta del agregado (g)</th>
                            <th className={excelHeadClass}>Vacío de la muestra sin compactar (%)</th>
                            <th className={excelHeadClass}>Angularidad promedio UR (%)</th>
                        </tr>
                        {metodoCTrials.map(([label, trial, prefix], index) => (
                            <tr key={String(prefix)}>
                                <td className={excelCellClass}>{label}</td>
                                <td className={`${excelCellClass} text-center`}>{trial}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.number(`${prefix}_masa_agregado_cilindro_g`, { className: excelBlueInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.readonly(`${prefix}_masa_neta_agregado_g`, { className: excelReadonlyInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>{tools.readonly(`${prefix}_vacio_pct`, { className: excelReadonlyInputClass })}</td>
                                <td className={`${excelCellClass} p-0`}>
                                    {index === metodoCTrials.length - 1
                                        ? tools.readonly('metodo_c_angularidad_promedio_ur_pct', { className: excelReadonlyInputClass })
                                        : <div className={excelReadonlySpacerClass} />}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
                <table className={excelTableClass}>
                    <tbody>
                        <tr>
                            <th className={excelGroupTitleClass}>Nota:</th>
                        </tr>
                        <tr>
                            <td className="border border-black p-0">{tools.textarea('observaciones', { rows: 4, className: excelTextareaClass })}</td>
                        </tr>
                    </tbody>
                </table>

                <table className={excelTableClass}>
                    <tbody>
                        <tr>
                            <th className={excelTitleCellClass} colSpan={2}>Codigo equipos utilizados</th>
                        </tr>
                        <tr>
                            <td className={excelCellClass}>Horno</td>
                            <td className={`${excelCellClass} p-0`}>{tools.text('horno_codigo', { align: 'center', className: excelInputClass })}</td>
                        </tr>
                        <tr>
                            <td className={excelCellClass}>Balanza 0.1 g</td>
                            <td className={`${excelCellClass} p-0`}>{tools.text('balanza_01_codigo', { align: 'center', className: excelInputClass })}</td>
                        </tr>
                        <tr>
                            <td className={excelCellClass}>Tamiz especificado</td>
                            <td className={`${excelCellClass} p-0`}>{tools.text('tamiz_codigo', { align: 'center', className: excelInputClass })}</td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {renderApprovalBoxes(tools)}
        </div>
    )
}

export const SPECIAL_MODULES: ModuleConfig[] = [
    {
        slug: 'cont-mat-organica',
        apiSlug: 'cont-mat-organica',
        title: 'Contenido Materia Organica',
        historyTitle: 'Contenido Materia Organica',
        formatCode: 'F-LEM-P-AG-15.01',
        heading: 'ENSAYO DE MATERIA ORGANICA',
        standard: 'NORMA AASHTO T267',
        materialCode: 'AG',
        downloadLabel: 'CONTENIDO MATERIA ORGANICA',
        draftKey: 'cont_mat_organica_form_draft_v1',
        defaultState: () => ({
            ...createBaseState(),
            crisol_numero: '',
            peso_especimen_seco_crisol_g: null,
            peso_especimen_calcinado_g: null,
            peso_crisol_g: null,
            contenido_materia_organica_pct: null,
            balanza_0001_codigo: '',
            horno_codigo: '',
        }),
        derive: deriveContMatOrganica,
        renderBody: renderContMatOrganica,
    },
    {
        slug: 'terrones-fino-grueso',
        apiSlug: 'terrones-fino-grueso',
        title: 'Terrones Fino Grueso',
        historyTitle: 'Terrones Fino Grueso',
        formatCode: 'F-LEM-P-AG-30.02',
        heading: 'STANDARD TEST METHOD FOR CLAY LUMPS AND FRIABLE PARTICLES IN AGGREGATES',
        standard: 'ASTM C142/C142M - 17',
        materialCode: 'AG',
        downloadLabel: 'TERRONES FINO GRUESO',
        draftKey: 'terrones_fino_grueso_form_draft_v1',
        defaultState: () => ({
            ...createBaseState(),
            grueso_a_masa_antes_g: null,
            grueso_a_masa_seca_despues_g: null,
            grueso_a_masa_constante_g: null,
            grueso_a_perdida_g: null,
            grueso_a_pct: null,
            grueso_b_masa_antes_g: null,
            grueso_b_masa_seca_despues_g: null,
            grueso_b_masa_constante_g: null,
            grueso_b_perdida_g: null,
            grueso_b_pct: null,
            grueso_c_masa_antes_g: null,
            grueso_c_masa_seca_despues_g: null,
            grueso_c_masa_constante_g: null,
            grueso_c_perdida_g: null,
            grueso_c_pct: null,
            grueso_d_masa_antes_g: null,
            grueso_d_masa_seca_despues_g: null,
            grueso_d_masa_constante_g: null,
            grueso_d_perdida_g: null,
            grueso_d_pct: null,
            grueso_total_pct: null,
            fino_masa_antes_g: null,
            fino_masa_seca_despues_g: null,
            fino_masa_constante_g: null,
            fino_perdida_g: null,
            fino_pct: null,
            fino_total_pct: null,
            secado_horno: '',
            balanza_01_codigo: '',
            horno_codigo: '',
        }),
        derive: deriveTerrones,
        renderBody: renderTerrones,
    },
    {
        slug: 'azul-metileno',
        apiSlug: 'azul-metileno',
        title: 'Azul Metileno',
        historyTitle: 'Azul Metileno',
        formatCode: 'F-LEM-P-AG-29.01',
        heading: 'PROCEDIMIENTO DE ENSAYO PARA LA DETECCION CUALITATIVA DE ARCILLAS NOCIVAS EN AGREGADOS QUE UTILIZAN AZUL DE METILENO',
        standard: 'NORMA NTP 239.401',
        materialCode: 'AG',
        downloadLabel: 'AZUL DE METILENO',
        draftKey: 'azul_metileno_form_draft_v1',
        defaultState: () => ({
            ...createBaseState(),
            concentracion_solucion_mg_ml: 5,
            solucion_usada_ml: 10,
            material_seco_g: null,
            material_seco_constante_g: 10,
            valor_azul_metileno_mg_g: null,
            balanza_0001_codigo: '',
            horno_codigo: '',
        }),
        derive: deriveAzulMetileno,
        renderBody: renderAzulMetileno,
    },
    {
        slug: 'part-livianas',
        apiSlug: 'part-livianas',
        title: 'Particulas Livianas',
        historyTitle: 'Particulas Livianas',
        formatCode: 'F-LEM-P-AG-24.01',
        heading: 'METODO DE ENSAYO PARA DETERMINAR LAS PARTICULAS LIVIANAS EN LOS AGREGADOS',
        standard: 'NORMA NTP 400.023',
        materialCode: 'AG',
        downloadLabel: 'PARTICULAS LIVIANAS',
        draftKey: 'part_livianas_form_draft_v1',
        defaultState: () => ({
            ...createBaseState(),
            tamano_maximo_nominal: '',
            fino_masa_porcion_g: null,
            fino_masa_flotan_g: null,
            fino_particulas_livianas_pct: null,
            grueso_a_masa_porcion_g: null,
            grueso_a_masa_flotan_g: null,
            grueso_b_masa_porcion_g: null,
            grueso_b_masa_flotan_g: null,
            grueso_c_masa_porcion_g: null,
            grueso_c_masa_flotan_g: null,
            grueso_d_masa_porcion_g: null,
            grueso_d_masa_flotan_g: null,
            grueso_suma_masa_porcion_g: null,
            grueso_suma_masa_flotan_g: null,
            grueso_particulas_livianas_pct: null,
        }),
        derive: derivePartLivianas,
        renderBody: renderPartLivianas,
    },
    {
        slug: 'imp-organicas',
        apiSlug: 'imp-organicas',
        title: 'Impurezas Organicas',
        historyTitle: 'Impurezas Organicas',
        formatCode: 'F-LEM-P-AG-13.01',
        heading: 'METODO DE ENSAYO ESTANDAR PARA IMPURESAS ORGANICAS EN AGREGADO FINO',
        standard: 'NORMA ASTM C40',
        materialCode: 'AG',
        downloadLabel: 'IMPUREZAS ORGANICAS',
        draftKey: 'imp_organicas_form_draft_v1',
        defaultState: () => ({
            ...createBaseState(),
            tamano_particula: '',
            fecha_inicio_ensayo: '',
            fecha_fin_ensayo: '',
            temperatura_solucion_c: null,
            color_placa_organica: null,
            color_estandar_gardner: null,
        }),
        derive: deriveImpOrganicas,
        renderBody: renderImpOrganicas,
    },
    {
        slug: 'sul-magnesio',
        apiSlug: 'sul-magnesio',
        title: 'Sulfato de Magnesio',
        historyTitle: 'Sulfato de Magnesio',
        formatCode: 'F-LEM-P-AG-08.01',
        heading: 'DETERMINACION DE LA INALTERABILIDAD DE AGREGADOS POR MEDIO DE SULFATO DE SODIO O SULFATO DE MAGNESIO',
        standard: 'NTP 400.016:2020',
        materialCode: 'AG',
        downloadLabel: 'SULFATO DE MAGNESIO',
        draftKey: 'sul_magnesio_form_draft_v1',
        defaultState: () => ({
            ...createBaseState(),
            fino_rows: emptyRow(createSulMagFinoRow, 5),
            fino_total_pct: null,
            grueso_rows: emptyRow(createSulMagGruesoRow, 7),
            grueso_total_pct: null,
            cualitativo_rows: emptyRow(createSulMagCualitativoRow, 2),
            horno_codigo: '',
            balanza_01_codigo: '',
        }),
        derive: deriveSulMagnesio,
        renderBody: renderSulMagnesio,
    },
    {
        slug: 'angularidad',
        apiSlug: 'angularidad',
        title: 'Angularidad',
        historyTitle: 'Angularidad',
        formatCode: 'F-LEM-P-AG-37.01',
        heading: 'METODO DE PRUEBA ESTANDAR PARA EL CONTENIDO DE VACIO NO COMPACTADO DEL AGREGADO FINO',
        standard: 'ASTM C1252-17',
        materialCode: 'AG',
        downloadLabel: 'ANGULARIDAD',
        draftKey: 'angularidad_form_draft_v1',
        defaultState: () => ({
            ...createBaseState(),
            procedimiento_medicion_vacios: '',
            volumen_cilindro_medida_ml: null,
            masa_cilindro_vacio_g: null,
            gravedad_especifica_agregado_fino_gs: null,
            metodo_a_n8_n16_masa_g: null,
            metodo_a_n16_n30_masa_g: null,
            metodo_a_n30_n50_masa_g: null,
            metodo_a_n50_n100_masa_g: null,
            metodo_a_total_masa_g: null,
            metodo_a_prueba_1_masa_agregado_cilindro_g: null,
            metodo_a_prueba_1_masa_neta_agregado_g: null,
            metodo_a_prueba_1_vacio_pct: null,
            metodo_a_prueba_2_masa_agregado_cilindro_g: null,
            metodo_a_prueba_2_masa_neta_agregado_g: null,
            metodo_a_prueba_2_vacio_pct: null,
            metodo_a_angularidad_promedio_us_pct: null,
            metodo_b_n8_n16_masa_g: null,
            metodo_b_n16_n30_masa_g: null,
            metodo_b_n30_n50_masa_g: null,
            metodo_b_total_masa_g: null,
            metodo_b_n8_n16_prueba_1_masa_agregado_cilindro_g: null,
            metodo_b_n8_n16_prueba_1_masa_neta_agregado_g: null,
            metodo_b_n8_n16_prueba_1_vacio_pct: null,
            metodo_b_n8_n16_prueba_2_masa_agregado_cilindro_g: null,
            metodo_b_n8_n16_prueba_2_masa_neta_agregado_g: null,
            metodo_b_n8_n16_prueba_2_vacio_pct: null,
            metodo_b_n16_n30_prueba_1_masa_agregado_cilindro_g: null,
            metodo_b_n16_n30_prueba_1_masa_neta_agregado_g: null,
            metodo_b_n16_n30_prueba_1_vacio_pct: null,
            metodo_b_n16_n30_prueba_2_masa_agregado_cilindro_g: null,
            metodo_b_n16_n30_prueba_2_masa_neta_agregado_g: null,
            metodo_b_n16_n30_prueba_2_vacio_pct: null,
            metodo_b_n30_n50_prueba_1_masa_agregado_cilindro_g: null,
            metodo_b_n30_n50_prueba_1_masa_neta_agregado_g: null,
            metodo_b_n30_n50_prueba_1_vacio_pct: null,
            metodo_b_n30_n50_prueba_2_masa_agregado_cilindro_g: null,
            metodo_b_n30_n50_prueba_2_masa_neta_agregado_g: null,
            metodo_b_n30_n50_prueba_2_vacio_pct: null,
            metodo_b_angularidad_promedio_um_pct: null,
            metodo_c_n8_n200_masa_g: null,
            metodo_c_total_masa_g: null,
            metodo_c_prueba_1_masa_agregado_cilindro_g: null,
            metodo_c_prueba_1_masa_neta_agregado_g: null,
            metodo_c_prueba_1_vacio_pct: null,
            metodo_c_prueba_2_masa_agregado_cilindro_g: null,
            metodo_c_prueba_2_masa_neta_agregado_g: null,
            metodo_c_prueba_2_vacio_pct: null,
            metodo_c_angularidad_promedio_ur_pct: null,
            horno_codigo: '',
            balanza_01_codigo: '',
            tamiz_codigo: '',
        }),
        derive: deriveAngularidad,
        renderBody: renderAngularidad,
    },
]

export function getModuleConfigBySlug(slug: string): ModuleConfig | null {
    return SPECIAL_MODULES.find((module) => module.slug === slug) ?? null
}

export function resolveModuleFromPath(pathname: string, forcedSlug?: string | null): ModuleConfig | null {
    const normalizedForcedSlug = forcedSlug?.trim()
    if (normalizedForcedSlug) return getModuleConfigBySlug(normalizedForcedSlug)
    const cleanPath = pathname.replace(/\/+$/, '') || '/'
    if (cleanPath === '/') return SPECIAL_MODULES[0]
    const slug = cleanPath.replace(/^\/+/, '').split('/')[0]
    return getModuleConfigBySlug(slug)
}
