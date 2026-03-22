// ============================================================
// genetic/fitness.ts
// Función de aptitud (fitness function).
//
// Filosofía de diseño:
//   score = BASE - Σ(penalizaciones) + Σ(premios)
//
// Un horario perfecto (sin conflictos, con cursos consecutivos
// y salones adecuados) obtiene el score BASE completo.
// Cada conflicto descuenta un peso proporcional a su gravedad.
// ============================================================

import type { Cromosoma, Gen, ContextoGA } from "../types/Genetic.types";
import { detectarConflictos } from "../utils/validators";
import { horaAMinutos } from "../../algoritmoGenetico/utils/timeUtil";

// ─────────────────────────────────────────────────────────────
// PESOS DE PENALIZACIÓN (ajustables)
// ─────────────────────────────────────────────────────────────

const PESOS = {
  // Restricciones DURAS (penalización alta — deben evitarse siempre)
  docente_doble: 100,
  salon_doble: 100,
  semestre_traslape: 80,
  docente_fuera_horario: 60,
  salon_jornada: 50,
  curso_jornada: 50,

  // Restricciones de asignación prefijada (penalización por incumplimiento)
  asignacion_docente_incumplida: 80,
  asignacion_salon_incumplida: 80,
  asignacion_horario_incumplida: 80,

  // Premios (bonificaciones por soluciones de calidad)
  cursos_consecutivos: 10,           // par de cursos del mismo semestre consecutivos
  salon_capacidad_adecuada: 5,       // salón con capacidad ≥ estudiantes inscritos

  // Premios por cumplir asignaciones prefijadas
  asignacion_docente_cumplida: 10,   // docente asignado correcto (por gen)
  asignacion_salon_cumplida: 10,     // primera sección con salón correcto
  asignacion_salon_extra: 5,         // secciones adicionales con salón correcto
  asignacion_horario_cumplida: 10,   // primera sección con hora correcta
  asignacion_horario_extra: 5,       // secciones adicionales con hora correcta

  // Premios por coherencia dentro del curso
  mismo_docente_teoria_lab: 10,      // teoría y lab del mismo curso los da el mismo docente
  lab_periodos_correctos: 5,         // todos los períodos del lab en un mismo día (sin split M/J)
};
/*
const PESOS = {
  docente_doble:         1000,  // era 100 — subir 10x
  salon_doble:           1000,  // era 100 — subir 10x
  semestre_traslape:      500,  // era 80
  docente_fuera_horario:  200,  // era 60
  salon_jornada:          200,  // era 50
  curso_jornada:          200,  // era 50
  cursos_consecutivos:     10,
  salon_capacidad_adecuada: 5,
};
*/

const BASE_SCORE = 10_000;

// ─────────────────────────────────────────────────────────────
// PREMIOS
// ─────────────────────────────────────────────────────────────

/**
 * Premio por cursos del mismo semestre y carrera en horarios consecutivos.
 * Aplica especialmente para días de laboratorio (requerimiento del proyecto).
 */
function calcularPremioConsecutivos(genes: Gen[], ctx: ContextoGA): number {
  let premio = 0;

  // Agrupar genes por carrera+semestre+día
  const grupos = new Map<string, Gen[]>();
  for (const gen of genes) {
    const curso = ctx.indiceCursos.get(gen.cursoId);
    if (!curso) continue;
    const franja = ctx.indiceFranjas.get(gen.franjaId);
    if (!franja) continue;
    const clave = `${curso.carrera}|${curso.semestre}|${franja.dia}`;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave)!.push(gen);
  }

  for (const [, grupoGenes] of grupos) {
    // Ordenar por hora de inicio
    const ordenados = [...grupoGenes].sort((a, b) => {
      const fa = ctx.indiceFranjas.get(a.franjaId);
      const fb = ctx.indiceFranjas.get(b.franjaId);
      if (!fa || !fb) return 0;
      return horaAMinutos(fa.horaInicio) - horaAMinutos(fb.horaInicio);
    });

    // Contar pares consecutivos (franja contigua)
    for (let i = 0; i < ordenados.length - 1; i++) {
      const fa = ctx.indiceFranjas.get(ordenados[i].franjaId);
      const fb = ctx.indiceFranjas.get(ordenados[i + 1].franjaId);
      if (!fa || !fb) continue;
      const finA = horaAMinutos(fa.horaFin);
      const inicioB = horaAMinutos(fb.horaInicio);
      if (finA === inicioB) {
        premio += PESOS.cursos_consecutivos;
      }
    }
  }

  return premio;
}

/**
 * Premio por salón con capacidad adecuada para el número de estudiantes.
 * Si no hay datos de estudiantes, se ignora.
 */
function calcularPremioCapacidad(genes: Gen[], ctx: ContextoGA): number {
  let premio = 0;
  for (const gen of genes) {
    if (!gen.salonId) continue;
    const curso = ctx.indiceCursos.get(gen.cursoId);
    const salon = ctx.indiceSalones.get(gen.salonId);
    if (!curso || !salon) continue;
    if (curso.estudiantesInscritos == null || salon.capacidad == null) continue;
    // Premio si la capacidad es suficiente
    if (salon.capacidad >= curso.estudiantesInscritos) {
      premio += PESOS.salon_capacidad_adecuada;
    }
  }
  return premio;
}

// ─────────────────────────────────────────────────────────────
// PENALIZACIONES / BONOS POR ASIGNACIONES PREFIJADAS
// ─────────────────────────────────────────────────────────────

/**
 * Evalúa las 3 restricciones de asignación prefijada (docente, salón, horario)
 * en una sola pasada sobre los genes.
 * Retorna un valor NETO (positivo = premios superan penalizaciones).
 *
 * Diseño O(n) con Maps precalculados:
 *  - Agrupa los genes de teoría por cursoId y sección UNA sola vez.
 *  - Luego itera solo sobre los cursos que tienen asignaciones.
 */
function calcularScoreAsignaciones(genes: Gen[], ctx: ContextoGA): number {
  const { asignacionDocente, asignacionSalon, asignacionHorario } = ctx;
  const sinAsignaciones =
    asignacionDocente.size === 0 &&
    asignacionSalon.size === 0 &&
    asignacionHorario.size === 0;
  if (sinAsignaciones) return 0;

  let score = 0;

  // Pre-agrupar por cursoId para eficiencia (O(n))
  const genesPorCurso = new Map<string, Gen[]>();
  for (const gen of genes) {
    let lista = genesPorCurso.get(gen.cursoId);
    if (!lista) { lista = []; genesPorCurso.set(gen.cursoId, lista); }
    lista.push(gen);
  }

  // ── ASIGNACION_DOCENTE ─────────────────────────────────────
  // Regla: si existe una asignación de docente para un curso, CADA gen de ese
  // curso debe usar uno de los docentes asignados.
  // +10 por gen que cumple, -80 por gen que incumple.
  for (const [cursoId, docentesAsignados] of asignacionDocente) {
    const docenteSet = new Set(docentesAsignados);
    const gensCurso = genesPorCurso.get(cursoId);
    if (!gensCurso) continue;
    for (const gen of gensCurso) {
      if (gen.docenteId == null) continue;
      if (docenteSet.has(gen.docenteId)) {
        score += PESOS.asignacion_docente_cumplida;
      } else {
        score -= PESOS.asignacion_docente_incumplida;
      }
    }
  }

  // ── ASIGNACION_SALON ───────────────────────────────────────
  // Regla: el curso debe estar en el salón asignado.
  // Secciones múltiples: con que UNA esté en el salón correcto no se penaliza al resto.
  // +10 primera sección correcta, +5 por cada sección adicional en el mismo salón.
  // -80 × nSecciones si NINGUNA sección usa el salón correcto.
  for (const [cursoId, salonAsignado] of asignacionSalon) {
    const gensCurso = genesPorCurso.get(cursoId);
    if (!gensCurso) continue;
    // Solo teoría (la asignación de salón aplica a la clase teórica)
    const secciones = new Map<string, Gen>();
    for (const g of gensCurso) {
      if (g.tipoSesion === 'teoria' && !secciones.has(g.seccion)) {
        secciones.set(g.seccion, g);
      }
    }
    if (secciones.size === 0) continue;

    let cumplidas = 0;
    for (const g of secciones.values()) {
      if (g.salonId === salonAsignado) cumplidas++;
    }

    if (cumplidas === 0) {
      score -= PESOS.asignacion_salon_incumplida * secciones.size;
    } else {
      score += PESOS.asignacion_salon_cumplida;
      if (cumplidas > 1) score += PESOS.asignacion_salon_extra * (cumplidas - 1);
    }
  }

  // ── ASIGNACION_HORARIO ─────────────────────────────────────
  // Regla: el curso debe impartirse en la hora (horaInicio) asignada.
  // Puede cambiar de salón pero no de franja horaria.
  // Misma lógica que salón: una sección cumple → sin penalización global.
  for (const [cursoId, horaAsignada] of asignacionHorario) {
    const gensCurso = genesPorCurso.get(cursoId);
    if (!gensCurso) continue;
    const secciones = new Map<string, Gen>();
    for (const g of gensCurso) {
      if (g.tipoSesion === 'teoria' && !secciones.has(g.seccion)) {
        secciones.set(g.seccion, g);
      }
    }
    if (secciones.size === 0) continue;

    let cumplidas = 0;
    for (const g of secciones.values()) {
      const franja = ctx.indiceFranjas.get(g.franjaId);
      if (franja?.horaInicio === horaAsignada) cumplidas++;
    }

    if (cumplidas === 0) {
      score -= PESOS.asignacion_horario_incumplida * secciones.size;
    } else {
      score += PESOS.asignacion_horario_cumplida;
      if (cumplidas > 1) score += PESOS.asignacion_horario_extra * (cumplidas - 1);
    }
  }

  return score;
}

// ─────────────────────────────────────────────────────────────
// PREMIOS POR COHERENCIA DOCENTE Y PERIODOS DE LAB
// ─────────────────────────────────────────────────────────────

/**
 * Calcula en una sola pasada:
 *   +10 si teoría y lab de la misma sección los imparte el mismo docente.
 *   +5  si el gen de lab tiene exactamente `noPeriodosLab` periodos contiguos.
 */
function calcularPremioCoherenciaSeccion(genes: Gen[], ctx: ContextoGA): number {
  let premio = 0;

  // Agrupar por cursoId|seccion
  const porSeccion = new Map<string, { teoria?: Gen; lab?: Gen }>();
  for (const gen of genes) {
    const clave = `${gen.cursoId}|${gen.seccion}`;
    let entry = porSeccion.get(clave);
    if (!entry) { entry = {}; porSeccion.set(clave, entry); }
    if (gen.tipoSesion === 'teoria') entry.teoria = gen;
    else entry.lab = gen;
  }

  for (const { teoria, lab } of porSeccion.values()) {
    // +10 mismo docente en teoría y lab
    if (
      teoria && lab &&
      teoria.docenteId != null && lab.docenteId != null &&
      teoria.docenteId === lab.docenteId
    ) {
      premio += PESOS.mismo_docente_teoria_lab;
    }

    // +5 lab tiene todos los períodos juntos en el mismo día (sin split M/J)
    if (lab) {
      const curso = ctx.indiceCursos.get(lab.cursoId);
      const expectedPeriods = curso?.noPeriodosLab ?? 2;
      const todasFranjas = [lab.franjaId, ...(lab.franjasExtra ?? [])];
      const actualPeriods = todasFranjas.length;
      if (actualPeriods === expectedPeriods) {
        const dias = new Set(todasFranjas.map(fid => ctx.indiceFranjas.get(fid)?.dia));
        if (dias.size === 1) {
          premio += PESOS.lab_periodos_correctos;
        }
      }
    }
  }

  return premio;
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL DE FITNESS
// ─────────────────────────────────────────────────────────────

/**
 * Calcula y asigna el fitness a un cromosoma.
 * Modifica `cromosoma.fitness` in-place y lo devuelve.
 */
export function evaluarFitness(cromosoma: Cromosoma, ctx: ContextoGA): Cromosoma {
  const conflictos = detectarConflictos(cromosoma.genes, ctx);

  // Suma de penalizaciones por conflictos duros
  const penalizacion = conflictos.reduce((acc, c) => {
    return acc + (PESOS[c.tipo] ?? 10);
  }, 0);

  // Suma de premios estándar
  const premioConsecutivos = calcularPremioConsecutivos(cromosoma.genes, ctx);
  const premioCapacidad    = calcularPremioCapacidad(cromosoma.genes, ctx);

  // Score neto de asignaciones prefijadas (puede ser positivo o negativo)
  const scoreAsignaciones  = calcularScoreAsignaciones(cromosoma.genes, ctx);

  // Premios de coherencia (mismo docente teoría+lab, periodos correctos)
  const premioCoherencia   = calcularPremioCoherenciaSeccion(cromosoma.genes, ctx);

  cromosoma.fitness = Math.max(
    0,
    BASE_SCORE
      - penalizacion
      + premioConsecutivos
      + premioCapacidad
      + scoreAsignaciones
      + premioCoherencia,
  );

  return cromosoma;
}

/**
 * Evalúa toda la población in-place.
 */
export function evaluarPoblacion(
  poblacion: Cromosoma[],
  ctx: ContextoGA
): Cromosoma[] {
  for (const cromosoma of poblacion) {
    evaluarFitness(cromosoma, ctx);
  }
  return poblacion;
}

/**
 * Expone el BASE_SCORE para que el engine sepa cuándo se alcanzó el óptimo.
 */
export const FITNESS_OPTIMO = BASE_SCORE;

/**
 * Cuenta cuántos conflictos tiene un cromosoma (para reportes).
 */
export function contarConflictos(cromosoma: Cromosoma, ctx: ContextoGA): number {
  return detectarConflictos(cromosoma.genes, ctx).length;
}

/**
 * Calcula el porcentaje de cursos del mismo semestre en horarios consecutivos.
 * Usado en reporte D del proyecto.
 */
export function calcularPorcentajeContinuidad(
  genes: Gen[],
  ctx: ContextoGA
): number {
  // Agrupar por carrera+semestre
  const grupos = new Map<string, Gen[]>();
  for (const gen of genes) {
    const curso = ctx.indiceCursos.get(gen.cursoId);
    if (!curso) continue;
    const clave = `${curso.carrera}|${curso.semestre}`;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave)!.push(gen);
  }

  let totalPares = 0;
  let paresConsecutivos = 0;

  for (const [, grupoGenes] of grupos) {
    const porDia = new Map<string, Gen[]>();
    for (const gen of grupoGenes) {
      const franja = ctx.indiceFranjas.get(gen.franjaId);
      if (!franja) continue;
      if (!porDia.has(franja.dia)) porDia.set(franja.dia, []);
      porDia.get(franja.dia)!.push(gen);
    }

    for (const [, diaGenes] of porDia) {
      const ordenados = [...diaGenes].sort((a, b) => {
        const fa = ctx.indiceFranjas.get(a.franjaId);
        const fb = ctx.indiceFranjas.get(b.franjaId);
        if (!fa || !fb) return 0;
        return horaAMinutos(fa.horaInicio) - horaAMinutos(fb.horaInicio);
      });

      for (let i = 0; i < ordenados.length - 1; i++) {
        totalPares++;
        const fa = ctx.indiceFranjas.get(ordenados[i].franjaId);
        const fb = ctx.indiceFranjas.get(ordenados[i + 1].franjaId);
        if (fa && fb && horaAMinutos(fa.horaFin) === horaAMinutos(fb.horaInicio)) {
          paresConsecutivos++;
        }
      }
    }
  }

  if (totalPares === 0) return 100;
  return Math.round((paresConsecutivos / totalPares) * 100);
}