// ============================================================
// genetic/engine.ts
// Motor principal del algoritmo genético.
//
// Orquesta el loop completo:
//   generación inicial → evaluación → selección → cruce
//   → mutación → nueva generación → repetir
//
// Emite eventos en tiempo real para la UI (gráfica de fitness).
// ============================================================

import type {
  Cromosoma,
  Poblacion,
  ConfiguracionGA,
  ContextoGA,
  ResultadoGeneracion,
  ResultadoEjecucion,
} from "../types/Genetic.types";

import { generarPoblacionInicial } from "../genetic/Population";
import { evaluarPoblacion, contarConflictos, calcularPorcentajeContinuidad, FITNESS_OPTIMO } from "../genetic/Fitness";
import { seleccionarPadres } from "../genetic/Selection";
import { cruzar } from "./Crossover";
import { mutar } from "../genetic/Mutation";
import { detectarConflictos } from "../utils/validators";
import { ConflictoPersistencia } from "../types/Domain.types";

// ─────────────────────────────────────────────────────────────
// TIPO DE CALLBACK PARA TIEMPO REAL
// El frontend puede suscribirse para actualizar la gráfica.
// ─────────────────────────────────────────────────────────────

export type OnGeneracionCallback = (resultado: ResultadoGeneracion) => void;

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function ordenarPoblacion(poblacion: Poblacion): Poblacion {
  return [...poblacion].sort((a, b) => b.fitness - a.fitness);
}

function estadisticasGeneracion(
  generacion: number,
  poblacion: Poblacion,
  ctx: ContextoGA
): ResultadoGeneracion {
  const fitnesses = poblacion.map((c) => c.fitness);
  const mejor = Math.max(...fitnesses);
  const peor = Math.min(...fitnesses);
  const promedio = fitnesses.reduce((a, b) => a + b, 0) / fitnesses.length;
  const mejorCromosoma = poblacion.find((c) => c.fitness === mejor)!;
  const conflictos = contarConflictos(mejorCromosoma, ctx);

  return { generacion, mejorFitness: mejor, fitnesPromedio: promedio, peorFitness: peor, conflictos };
}

// ─────────────────────────────────────────────────────────────
// ELITISMO
// Copia los N mejores cromosomas directamente a la siguiente
// generación sin modificación. Preserva la mejor solución.
// ─────────────────────────────────────────────────────────────

function aplicarElitismo(
  poblacionOrdenada: Poblacion,
  cantidad: number
): Cromosoma[] {
  return poblacionOrdenada.slice(0, cantidad).map((c) => ({
    ...c,
    genes: c.genes.map((g) => ({ ...g })),
  }));
}

// ─────────────────────────────────────────────────────────────
// LOOP PRINCIPAL
// ─────────────────────────────────────────────────────────────

export async function ejecutarGA(
  config: ConfiguracionGA,
  ctx: ContextoGA,
  onGeneracion?: OnGeneracionCallback
): Promise<ResultadoEjecucion> {
  const tiempoInicio = performance.now();
  const memoriaInicio = process.memoryUsage().heapUsed;
  const historial: ResultadoGeneracion[] = [];
  const listaConflictos: ConflictoPersistencia[] = [];


  // ── 1. Población inicial ───────────────────────────────────
  let poblacion = generarPoblacionInicial(config.tamanioPoblacion, ctx);
  evaluarPoblacion(poblacion, ctx);

  let mejorCromosoma = ordenarPoblacion(poblacion)[0];
  let generacionActual = 0;

  // ── 2. Loop evolutivo ──────────────────────────────────────
  while (generacionActual < config.maxGeneraciones) {
    generacionActual++;

    // Ordenar de mayor a menor fitness
    const ordenada = ordenarPoblacion(poblacion);
    mejorCromosoma = ordenada[0];

    // Registrar estadísticas y emitir al frontend
    const stats = estadisticasGeneracion(generacionActual, ordenada, ctx);
    historial.push(stats);
    onGeneracion?.(stats);

    // Criterio de parada por fitness objetivo
    if (
      config.fitnesObjetivo !== undefined &&
      mejorCromosoma.fitness >= config.fitnesObjetivo
    ) {
      break;
    }

    // ── 3. Elitismo ─────────────────────────────────────────
    const nuevaPoblacion: Cromosoma[] = aplicarElitismo(ordenada, config.elitismo);

    // ── 4. Llenar el resto de la nueva generación ───────────
    while (nuevaPoblacion.length < config.tamanioPoblacion) {
      // Selección
      const [padreA, padreB] = seleccionarPadres(
        poblacion,
        2,
        config.metodoSeleccion,
        config.tamanioTorneo
      );

      // Cruce
      const [hijo1, hijo2] = cruzar(padreA, padreB, config.metodoCruce, config.tasaCruce);

      // Mutación
      const hijoMutado1 = mutar(hijo1, config.metodoMutacion, config.tasaMutacion, ctx);
      const hijoMutado2 = mutar(hijo2, config.metodoMutacion, config.tasaMutacion, ctx);

      nuevaPoblacion.push(hijoMutado1);
      if (nuevaPoblacion.length < config.tamanioPoblacion) {
        nuevaPoblacion.push(hijoMutado2);
      }
    }

    // ── 5. Evaluar nueva generación ─────────────────────────
    evaluarPoblacion(nuevaPoblacion, ctx);
    poblacion = nuevaPoblacion;

    // Pequeña pausa para no bloquear el event loop de Node
    // y permitir que la UI reciba los eventos en tiempo real
    if (generacionActual % 10 === 0) {
      await new Promise((r) => setImmediate(r));
    }
  }

  // ── 6. Resultado final ─────────────────────────────────────
  const tiempoFin = performance.now();
  const memoriaFin = process.memoryUsage().heapUsed;

  // Construir lista de conflictos legible para el reporte A
  const conflictosFinales = detectarConflictos(mejorCromosoma.genes, ctx);
  for (const c of conflictosFinales) {
    listaConflictos.push({
      solucion_id: 0,
      tipo: c.tipo,
      descripcion: c.descripcion,
      //genes_involucrados: JSON.stringify(c.genesInvolucrados),
    });
  }

  return {
    mejorCromosoma,
    historial,
    tiempoEjecucionMs: tiempoFin - tiempoInicio,
    generacionesEjecutadas: generacionActual,
    memoriaUsadaBytes: Math.max(0, memoriaFin - memoriaInicio),
    porcentajeCursosContinuos: calcularPorcentajeContinuidad(mejorCromosoma.genes, ctx),
    listaConflictos,
  };
}

// ─────────────────────────────────────────────────────────────
// UTILIDADES DE CONTEXTO
// ─────────────────────────────────────────────────────────────

/**
 * Construye el ContextoGA a partir de los datos ya cargados.
 * Precalcula los mapas docente↔curso para O(1) en el GA.
 */
export function construirContexto(
  cursos: ContextoGA["cursos"],
  docentes: ContextoGA["docentes"],
  salones: ContextoGA["salones"],
  franjas: ContextoGA["franjas"],
  relaciones: Array<{ docenteId: string; cursoId: string }>,
  asignaciones?: {
    docente?: Map<string, string[]>;
    salon?: Map<string, string>;
    horario?: Map<string, string>;
  }
): ContextoGA {
  const mapaDocenteCursos = new Map<string, Set<string>>();
  const mapaCursoDocentesSet = new Map<string, Set<string>>();

  for (const rel of relaciones) {
    // docente → cursos
    if (!mapaDocenteCursos.has(rel.docenteId)) {
      mapaDocenteCursos.set(rel.docenteId, new Set());
    }
    mapaDocenteCursos.get(rel.docenteId)!.add(rel.cursoId);

    // curso → docentes
    if (!mapaCursoDocentesSet.has(rel.cursoId)) {
      mapaCursoDocentesSet.set(rel.cursoId, new Set());
    }
    mapaCursoDocentesSet.get(rel.cursoId)!.add(rel.docenteId);
  }

  // Respetar docenteFijo: si un curso tiene docenteFijo, sobrescribir
  for (const curso of cursos) {
    if (curso.docenteFijo) {
      mapaCursoDocentesSet.set(curso.id, new Set([curso.docenteFijo]));
    }
  }

  const mapaCursoDocentes = new Map<string, string[]>();
  for (const [cursoId, docentesSet] of mapaCursoDocentesSet) {
    mapaCursoDocentes.set(cursoId, [...docentesSet]);
  }

  const indiceCursos = new Map(cursos.map((curso) => [curso.id, curso]));
  const indiceDocentes = new Map(docentes.map((docente) => [docente.id, docente]));
  const indiceSalones = new Map(salones.map((salon) => [salon.id, salon]));
  const indiceFranjas = new Map(franjas.map((franja) => [franja.id, franja]));
  const docentesActivos = new Set(docentes.filter((docente) => docente.activo).map((docente) => docente.id));

  return {
    cursos,
    docentes,
    salones,
    franjas,
    indiceCursos,
    indiceDocentes,
    indiceSalones,
    indiceFranjas,
    docentesActivos,
    mapaDocenteCursos,
    mapaCursoDocentes,
    asignacionDocente: asignaciones?.docente ?? new Map(),
    asignacionSalon:   asignaciones?.salon   ?? new Map(),
    asignacionHorario: asignaciones?.horario ?? new Map(),
  };
}