// ============================================================
// db/mapperSequelize.ts
// Versión del mapper usando los modelos Sequelize existentes.
// Reemplaza a mapper.ts (que usaba pg directo).
//
// Ventajas sobre la versión raw:
//   - Usa los modelos ya definidos (sin queries SQL a mano)
//   - Los includes de Sequelize hacen los JOINs automáticamente
//   - Tipado fuerte gracias a los InferAttributes de cada modelo
// ============================================================

import {
  Curso,
  Docente,
  Salon,
  Seccion,
  Laboratorio,
  Periodo,
  AsignacionDocente,
  AsignacionHorario,
  AsignacionSalon,
  Solucion,
  Calendario,
  Conflicto,
  EstadisticaSolucion,
} from '../../models';

import type {
  Curso as CursoGA,
  Docente as DocenteGA,
  Salon as SalonGA,
  FranjaHoraria,
  Jornada,
  DiaSemana,
  ConfiguracionHorario,
  ConflictoPersistencia,
} from '../types/Domain.types';

import type { ContextoGA, Cromosoma, ResultadoEjecucion } from '../types/Genetic.types';
import { generarFranjas, horaAMinutos } from '../utils/timeUtil';
import { construirContexto } from '../genetic/Engine';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/** "07:00:00" → "07:00"  (Sequelize devuelve TIME como string HH:MM:SS) */
function toHHMM(t: string | null | undefined): string {
  if (!t) return '07:00';
  return t.slice(0, 5);
}

/** solo_tarde boolean → Jornada del GA */
function jornada(soloTarde: boolean): Jornada {
  return soloTarde ? 'tarde' : 'ambas';
}



// ─────────────────────────────────────────────────────────────
// CARGA DE DOCENTES
// ─────────────────────────────────────────────────────────────

async function cargarDocentes(): Promise<DocenteGA[]> {
  //const rows = await Docente.findAll({ order: [['nombre', 'ASC']] });

  const idsDocentes = await AsignacionDocente.findAll({
    attributes: ['docente_id'],
    group: ['docente_id'],
  });

  const rows = await Docente.findAll({
    where: { registro: idsDocentes.map((d) => d.docente_id) },
    order: [['nombre', 'ASC']],
  });

  return rows.map((r) => ({
    id: r.registro,
    nombre: r.nombre,
    registroPersonal: r.registro,
    horaEntrada: toHHMM(r.hora_entrada),
    horaSalida: toHHMM(r.hora_salida),
    cursosQuePuedeImpartir: [],   // se llena más abajo con AsignacionDocente
    activo: true,
  }));
}

// ─────────────────────────────────────────────────────────────
// CARGA DE SALONES
// ─────────────────────────────────────────────────────────────

async function cargarSalones(): Promise<SalonGA[]> {
  // tipo_salon es un ENUM directo en el modelo — sin include necesario
  const rows = await Salon.findAll({ order: [['nombre', 'ASC']] });

  return rows.map((r) => ({
    id: String(r.id),
    nombre: r.nombre,
    capacidad: r.capacidad,
    esLaboratorio: r.tipo_salon === TipoSalonEnum.LABORATORIO,
    habilitadoParaTeoría: r.habilitado_teorica ?? true,
    jornada: jornada(r.solo_tarde ?? false),
    activo: true,
  }));
}

// ─────────────────────────────────────────────────────────────
// CARGA DE FRANJAS HORARIAS
// Producto cartesiano Día × Periodo de la BD.
// Fallback: genera desde config si las tablas están vacías.
// ─────────────────────────────────────────────────────────────


async function cargarFranjas(
  config: ConfiguracionHorario,
): Promise<{ franjas: FranjaHoraria[]; periodos: InstanceType<typeof Periodo>[] }> {
  // Siempre genera las franjas desde el config recibido.
  // La tabla periodo es solo un destino de persistencia, no la fuente de verdad.
  const franjas = generarFranjas(config);
  return { franjas, periodos: [] };
}

// ─────────────────────────────────────────────────────────────
// CARGA DE CURSOS
// Necesita secciones, laboratorios y las asignaciones fijas.
// ─────────────────────────────────────────────────────────────

async function cargarCursos(
  franjas: FranjaHoraria[],
  periodos: InstanceType<typeof Periodo>[],
  asignacionesHorario: InstanceType<typeof AsignacionHorario>[],
  asignacionesSalon: InstanceType<typeof AsignacionSalon>[],
): Promise<CursoGA[]> {

  // Traemos cursos con carrera + secciones + laboratorios de una sola query

  const idsCursosConAsignacion = await AsignacionDocente.findAll({
    attributes: ['curso_id'],
    group: ['curso_id'],
  });

  const rows = await Curso.findAll({
    include: [
      {
        model: Seccion, as: 'secciones',
        include: [{ model: Laboratorio, as: 'laboratorios' }],
      },
    ],
    where: { id: idsCursosConAsignacion.map((a) => a.curso_id) },
    order: [['semestre', 'ASC'], ['nombre', 'ASC']],
  });

  // Mapa rápido cursoId → salonFijo
  const salonFijoMap = new Map<number, number>();
  for (const a of asignacionesSalon) salonFijoMap.set(a.id_curso, a.id_salon);

  // Mapa seccionId → periodoId (de asignacion_horario)
  const horarioFijoMap = new Map<number, number>();
  for (const a of asignacionesHorario) horarioFijoMap.set(a.curso_id, a.periodo_id);

  return rows.map((r) => {
    const secciones: any[] = (r as any).secciones ?? [];

    // ¿Tiene laboratorio? (al menos una sección tiene laboratorios)
    const tieneLabatorio = secciones.some(
      (s: any) => (s.laboratorios ?? []).length > 0,
    );

    // noPeriodosLab: tomamos el valor del primer laboratorio encontrado
    let noPeriodosLab: number | undefined;
    for (const s of secciones) {
      const labs: any[] = (s as any).laboratorios ?? [];
      for (const lab of labs) {
        if (lab.no_periodos != null && lab.no_periodos > 0) {
          noPeriodosLab = lab.no_periodos;
          break;
        }
      }
      if (noPeriodosLab != null) break;
    }

    const noPeriodos: number | undefined =
      r.no_periodos != null && r.no_periodos > 0 ? r.no_periodos : undefined;

    // Máximo de estudiantes entre secciones
    const maxEstudiantes = secciones.length > 0
      ? Math.max(...secciones.map((s: any) => s.estudiantes_asignados ?? 0))
      : undefined;

    // Franja fija: buscamos el horario fijo del curso directamente
    let franjaFija: string | undefined;
    {
      const periodoFijoId = horarioFijoMap.get(r.id!);
      if (periodoFijoId) {
        const periodo = periodos.find((p) => p.id === periodoFijoId);
        if (periodo) {
          const horaInicio = toHHMM(periodo.hora_inicio);
          // Buscamos la franja con esa hora (cualquier día; el usuario ajusta)
          franjaFija = franjas.find((f) => f.horaInicio === horaInicio)?.id;
        }
      }
    }

    return {
      id: String(r.id),
      nombre: r.nombre,
      codigo: r.codigo,
      carrera: r.carrera ?? 'Sin carrera',
      semestre: r.semestre ?? 1,
      secciones: secciones.length || 1,
      tipo: r.es_obligatorio ? 'obligatorio' : 'optativo',
      tieneLabatorio,
      noPeriodos,
      noPeriodosLab,
      estudiantesInscritos: maxEstudiantes || undefined,
      jornada: jornada(r.solo_tarde ?? false),
      salonFijo: salonFijoMap.has(r.id!)
        ? String(salonFijoMap.get(r.id!))
        : undefined,
      franjaFija,
      sinSalon: !(r.necesita_salon ?? false),
      docenteFijo: undefined,  // se resuelve en la función principal
      activo: true,
    } satisfies CursoGA;
  });
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────

/**
 * Carga el ContextoGA completo desde Sequelize.
 * Úsala en lugar de cargarContextoDesdeDB() del mapper anterior.
 */
export async function cargarContexto(
  config: ConfiguracionHorario,
): Promise<ContextoGA> {

  // Cargas paralelas que no dependen entre sí
  const [
    docentes,
    salones,
    { franjas, periodos },
    asignacionesDocente,
    asignacionesHorario,
    asignacionesSalon,
    periodosRows,
  ] = await Promise.all([
    cargarDocentes(),
    cargarSalones(),
    cargarFranjas(config),
    AsignacionDocente.findAll(),
    AsignacionHorario.findAll(),
    AsignacionSalon.findAll(),
    Periodo.findAll(),
  ]);

  // Cursos necesita periodos + asignaciones (disponibles ya)
  const cursos = await cargarCursos(
    franjas,
    periodos,
    asignacionesHorario,
    asignacionesSalon,
  );

  // ── Resolver relaciones Docente ↔ Curso ──────────────────
  // asignacion_docente.curso_lab_id → seccion.id → curso.id
  // Necesitamos el mapa seccionId → cursoId
  // AsignacionDocente ahora tiene curso_id directo (no via seccion)
  const relaciones: Array<{ docenteId: string; cursoId: string }> = [];
  const docentesPorCurso = new Map<string, Set<string>>();
  const docentesPorId = new Map(docentes.map((d) => [d.id, d]));
  const cursosPorId = new Map(cursos.map((c) => [c.id, c]));
  const relacionesVistas = new Set<string>();

  for (const asig of asignacionesDocente) {
    const cursoIdStr = String(asig.curso_id);
    const docenteIdStr = asig.docente_id;
    const claveRelacion = `${docenteIdStr}|${cursoIdStr}`;

    if (!relacionesVistas.has(claveRelacion)) {
      relaciones.push({ docenteId: docenteIdStr, cursoId: cursoIdStr });
      relacionesVistas.add(claveRelacion);
    }

    // Actualizar cursosQuePuedeImpartir en el objeto docente
    const docente = docentesPorId.get(docenteIdStr);
    if (docente && !docente.cursosQuePuedeImpartir.includes(cursoIdStr)) {
      docente.cursosQuePuedeImpartir.push(cursoIdStr);
    }

    // Acumular docentes por curso para detectar docente fijo
    if (!docentesPorCurso.has(cursoIdStr)) docentesPorCurso.set(cursoIdStr, new Set());
    docentesPorCurso.get(cursoIdStr)!.add(docenteIdStr);
  }

  // Si un curso tiene exactamente UN docente posible → marcarlo como fijo
  for (const [cursoId, docSet] of docentesPorCurso) {
    if (docSet.size === 1) {
      const curso = cursosPorId.get(cursoId);
      if (curso) curso.docenteFijo = [...docSet][0];
    }
  }

  // ── Construir mapas de asignaciones prefijadas ───────────

  // asignacionDocente: cursoId → [docenteIds]  (misma info que mapaCursoDocentes pero
  // construida directamente de la tabla para evitar depender del orden de procesamiento)
  const asignacionDocente = new Map<string, string[]>();
  for (const asig of asignacionesDocente) {
    const cId = String(asig.curso_id);
    if (!asignacionDocente.has(cId)) asignacionDocente.set(cId, []);
    const lista = asignacionDocente.get(cId)!;
    if (!lista.includes(asig.docente_id)) lista.push(asig.docente_id);
  }

  // asignacionSalon: cursoId → salonId (string)
  const asignacionSalon = new Map<string, string>();
  for (const asig of asignacionesSalon) {
    asignacionSalon.set(String(asig.id_curso), String(asig.id_salon));
  }

  // asignacionHorario: cursoId → horaInicio ("07:00")
  // Necesita la tabla Periodo para convertir periodo_id → hora
  const periodoHoraMap = new Map<number, string>(
    periodosRows.map((p) => [p.id!, toHHMM(p.hora_inicio)]),
  );
  const asignacionHorario = new Map<string, string>();
  for (const asig of asignacionesHorario) {
    const hora = periodoHoraMap.get(asig.periodo_id);
    if (hora) asignacionHorario.set(String(asig.curso_id), hora);
  }

  const ctx = construirContexto(cursos, docentes, salones, franjas, relaciones, {
    docente:  asignacionDocente,
    salon:    asignacionSalon,
    horario:  asignacionHorario,
  });

  console.info(
    `[mapper] Contexto listo → ${cursos.length} cursos | ` +
    `${docentes.length} docentes | ${salones.length} salones | ` +
    `${franjas.length} franjas`,
  );

  return ctx;
}

// ─────────────────────────────────────────────────────────────
// GUARDAR RESULTADO EN BD (usando modelos Sequelize)
// ─────────────────────────────────────────────────────────────

import sequelize from '../../database/connection';
import { DiaEnum, TipoAsignacionEnum, TipoSalonEnum } from '../../types/enums';
import { DIAS_POR_ENUM } from './diasEnum';

// ─────────────────────────────────────────────────────────────
// HELPERS DE MAPEO ENUM
// ─────────────────────────────────────────────────────────────

/**
 * Convierte DiaSemana del GA → DiaEnum de la BD.
 *
 * Lógica del esquema universitario:
 *   LXV = días de clase teórica  (lunes, miercoles, viernes)
 *   M   = día de laboratorio     (martes)
 *   J   = día de laboratorio     (jueves)
 */
function diaSemanaAEnum(dia: DiaSemana, tipoSesion: 'teoria' | 'laboratorio'): DiaEnum {
  if (tipoSesion === 'teoria') return DiaEnum.LXV;
  if (dia === 'martes') return DiaEnum.M;
  if (dia === 'jueves') return DiaEnum.J;
  // Fallback: si un laboratorio cae en otro día, usamos M
  return DiaEnum.M;
}

// ─────────────────────────────────────────────────────────────
// TIPO DEL REGISTRO A INSERTAR EN CALENDARIO
// ─────────────────────────────────────────────────────────────

type CalendarioInput = {
  solucion_id: number;
  laboratorio_id: number | null;
  seccion_id: number | null;
  tipo_asignacion: TipoAsignacionEnum;
  docente_id: string | null;
  salon_id: number | null;
  dia: DiaEnum;
  periodo_id: number;
};


/**
 * Persiste el mejor cromosoma en las tablas solucion + calendario.
 * Usa una transacción para garantizar consistencia.
 */
export async function guardarSolucion(
  cromosoma: Cromosoma,
  generacion: number,
  ctx: ContextoGA,
  resultado: ResultadoEjecucion,
): Promise<number> {

  return await sequelize.transaction(async (t) => {

    // ── 0. Limpiar resultados anteriores ────────────────────
    // Una sola sentencia con CASCADE para que PostgreSQL no falle por FK
    /*
    await sequelize.query(
      'TRUNCATE "calendario", "solucion", "periodo" RESTART IDENTITY CASCADE',
      { transaction: t },
    );
    */

    // ── 1. Crear registro en solucion ────────────────────────
    const solucion = await Solucion.create(
      { generacion, aptitud: cromosoma.fitness },
      { transaction: t },
    );

    // ── 2. Cargar lookups necesarios (fuera del loop) ────────
    const seccionesRows: InstanceType<typeof Seccion>[] = await Seccion.findAll({ transaction: t });

    // Insertar los periodos del contexto actual
    const horasUnicas = new Map<string, string>(); // horaInicio → horaFin
    for (const f of ctx.franjas) {
      if (!horasUnicas.has(f.horaInicio)) horasUnicas.set(f.horaInicio, f.horaFin);
    }
    const periodosNuevos = await Periodo.bulkCreate(
      [...horasUnicas.entries()].map(([horaInicio, horaFin]) => ({ hora_inicio: horaInicio, hora_fin: horaFin })),
      { transaction: t, returning: true },
    );
    console.info(`[guardarSolucion] Periodos insertados: ${periodosNuevos.length} | ejemplo id: ${periodosNuevos[0]?.id}`);

    // periodoId rápido: "HH:MM" → id numérico
    const periodoMap = new Map<string, number>(
      periodosNuevos.map((p) => [toHHMM(p.hora_inicio), p.id!]),
    );

    // seccionId rápido: "cursoId-letra" → id numérico
    const secMap = new Map<string, number>(
      seccionesRows.map((s: InstanceType<typeof Seccion>) => [
        `${s.curso_id}-${s.letra.trim()}`,
        s.id!,
      ]),
    );

    // laboratorioId rápido: seccionId → laboratorio.id
    const labRows = await Laboratorio.findAll({ transaction: t });
    const labMap = new Map<number, number>(
      labRows.map((l) => [l.seccion_id, l.id!]),
    );

    // ── 3. Construir registros ───────────────────────────────
    const registros: CalendarioInput[] = [];

    for (const gen of cromosoma.genes) {
      const franja = ctx.indiceFranjas.get(gen.franjaId);
      if (!franja) continue;

      const periodoId = periodoMap.get(franja.horaInicio);
      if (!periodoId) continue;

      // seccion_id desde cursoId + letra de sección
      const seccionKey = `${gen.cursoId}-${gen.seccion}`;
      const seccionId = secMap.get(seccionKey) ?? null;

      // laboratorio_id si aplica (sin N+1 queries)
      const laboratorioId = (gen.tipoSesion === 'laboratorio' && seccionId != null)
        ? (labMap.get(seccionId) ?? null)
        : null;

      registros.push({
        solucion_id: solucion.id!,
        laboratorio_id: laboratorioId,
        seccion_id: gen.tipoSesion === 'teoria' ? seccionId : null,
        tipo_asignacion: gen.tipoSesion === 'teoria'
          ? TipoAsignacionEnum.CLASE
          : TipoAsignacionEnum.LABORATORIO,
        docente_id: gen.docenteId ?? null,
        salon_id: gen.salonId ? Number(gen.salonId) : null,
        dia: diaSemanaAEnum(franja.dia, gen.tipoSesion),
        periodo_id: periodoId,
      });

      // Persistir también los periodos del lab que van en franjasExtra
      // (cada período contiguo es una entrada separada en el calendario)
      if (gen.franjasExtra && gen.franjasExtra.length > 0) {
        for (const extraId of gen.franjasExtra) {
          const franjaExtra = ctx.indiceFranjas.get(extraId);
          if (!franjaExtra) continue;
          const periodoExtraId = periodoMap.get(franjaExtra.horaInicio);
          if (!periodoExtraId) continue;
          registros.push({
            solucion_id: solucion.id!,
            laboratorio_id: laboratorioId,
            seccion_id: null,
            tipo_asignacion: TipoAsignacionEnum.LABORATORIO,
            docente_id: gen.docenteId ?? null,
            salon_id: gen.salonId ? Number(gen.salonId) : null,
            dia: diaSemanaAEnum(franjaExtra.dia, gen.tipoSesion),
            periodo_id: periodoExtraId,
          });
        }
      }

    }

    // bulkCreate es mucho más rápido que N inserts individuales
    await Calendario.bulkCreate(registros, { transaction: t });

    //guardar conflictos
    await Conflicto.bulkCreate(
      resultado.listaConflictos.map((c) => ({
        solucion_id: solucion.id!,
        tipo: c.tipo,
        descripcion: c.descripcion,
        //genes_involucrados: JSON.stringify(c.genesInvolucrados),
      })),
      { transaction: t },
    );

    //guardar estadistica solucion
    await EstadisticaSolucion.create(
      {
        solucion_id: solucion.id!,
        tiempo_ejecucion: `${resultado.tiempoEjecucionMs.toFixed(2)} ms`,
        generaciones_ejecutadas: resultado.generacionesEjecutadas,
        cantidad_conflictos: resultado.listaConflictos.length,
        memoria_usada_bytes: `${resultado.memoriaUsadaBytes} bytes`,
        porcentaje_cursos_continuos: `${resultado.porcentajeCursosContinuos.toFixed(2)}%`,
      },
      { transaction: t },
    );

    console.info(
      `[mapper] Solución ${solucion.id} guardada | ` +
      `${registros.length} entradas en calendario`,
    );

    return solucion.id!;
  });
}