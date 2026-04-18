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
// REPARADOR DE CROMOSOMAS
//
// Garantiza que todos los genes tengan docenteId y salonId
// cuando el curso lo requiere. Se ejecuta O(n genes) después
// de cada cruce+mutación para mantener la integridad antes
// de evaluar el fitness.
//
// Cuando docenteId es null:
//   1. Busca docentes válidos para ese curso en mapaCursoDocentes
//   2. Prefiere los que sean compatibles con la franja horaria asignada
//   3. Fallback: cualquier docente activo del curso
//
// Después sincroniza que todos los genes de la misma
// (cursoId|seccion) usen el mismo docente.
// ─────────────────────────────────────────────────────────────

function repararCromosoma(cromosoma: Cromosoma, ctx: ContextoGA): Cromosoma {
  const genes = cromosoma.genes.map(g => ({ ...g }));

  // ── 0. Quitar genes huérfanos ───────────────────────────────
  // Un gen es huérfano cuando su cursoId ya no existe en el contexto
  // (puede ocurrir tras cruce entre cromosomas de versiones distintas).
  {
    let i = genes.length;
    while (i--) {
      if (!ctx.indiceCursos.has(genes[i].cursoId)) genes.splice(i, 1);
    }
  }

  // ── 0b. Completar genes faltantes por sección ───────────────
  // Garantiza que cada (cursoId|seccion) tenga exactamente
  // noPeriodos genes de teoría y noPeriodosLab genes de lab.
  // Los genes nuevos llegan vacíos (null docente/salon) y se
  // rellenan en los Pasos 1-3 a continuación.
  {
    const conteo = new Map<string, number>();
    const secPorCurso = new Map<string, Set<string>>();
    for (const g of genes) {
      const k = `${g.cursoId}|${g.seccion}|${g.tipoSesion}`;
      conteo.set(k, (conteo.get(k) ?? 0) + 1);
      let ss = secPorCurso.get(g.cursoId);
      if (!ss) { ss = new Set(); secPorCurso.set(g.cursoId, ss); }
      ss.add(g.seccion);
    }
    const franjaT = ctx.franjas.find(f => f.dia === 'lunes')  ?? ctx.franjas[0];
    const franjaL = ctx.franjas.find(f => f.dia === 'martes') ?? ctx.franjas[0];
    for (const [cursoId, secs] of secPorCurso) {
      const curso = ctx.indiceCursos.get(cursoId);
      if (!curso) continue;
      const nT = curso.noPeriodos    ?? 1;
      const nL = curso.noPeriodosLab ?? 2;
      for (const seccion of secs) {
        const actT = conteo.get(`${cursoId}|${seccion}|teoria`)       ?? 0;
        const actL = conteo.get(`${cursoId}|${seccion}|laboratorio`) ?? 0;
        for (let i = actT; i < nT; i++)
          genes.push({ cursoId, seccion, docenteId: null, salonId: null,
            franjaId: franjaT?.id ?? '', tipoSesion: 'teoria' });
        if (curso.tieneLabatorio)
          for (let i = actL; i < nL; i++)
            genes.push({ cursoId, seccion, docenteId: null, salonId: null,
              franjaId: franjaL?.id ?? '', tipoSesion: 'laboratorio' });
      }
    }
  }

  // ── 1. Rellenar docenteId nulo ──────────────────────────────
  for (const gen of genes) {
    if (gen.docenteId !== null) continue;
    const curso = ctx.indiceCursos.get(gen.cursoId);
    if (!curso || curso.sinSalon) continue;

    const candidatos = (ctx.mapaCursoDocentes.get(gen.cursoId) ?? [])
      .filter(id => ctx.docentesActivos.has(id));
    if (candidatos.length === 0) continue;

    // Preferir docente compatible con la franja actual
    const franja = ctx.indiceFranjas.get(gen.franjaId);
    const compatibles = franja
      ? candidatos.filter(id => {
          const d = ctx.indiceDocentes.get(id);
          return d ? franja.horaInicio >= d.horaEntrada && franja.horaFin <= d.horaSalida : false;
        })
      : [];
    const pool = compatibles.length > 0 ? compatibles : candidatos;
    gen.docenteId = pool[Math.floor(Math.random() * pool.length)];
  }

  // ── 2. Sincronizar docente en la sección ───────────────────
  // Todos los genes de la misma (cursoId|seccion) deben tener
  // el mismo docente. Primero encontramos el representativo
  // y luego lo propagamos.
  const docentePorSeccion = new Map<string, string | null>();
  for (const gen of genes) {
    const k = `${gen.cursoId}|${gen.seccion}`;
    const actual = docentePorSeccion.get(k);
    if (actual === undefined || (actual === null && gen.docenteId !== null)) {
      docentePorSeccion.set(k, gen.docenteId);
    }
  }
  for (const gen of genes) {
    const k = `${gen.cursoId}|${gen.seccion}`;
    const d = docentePorSeccion.get(k);
    if (d !== undefined) gen.docenteId = d;
  }

  // ── 3. Rellenar salonId nulo ────────────────────────────────
  for (const gen of genes) {
    if (gen.salonId !== null) continue;
    const curso = ctx.indiceCursos.get(gen.cursoId);
    if (!curso || curso.sinSalon) continue;

    let candidatos = ctx.salones.filter(s => {
      if (!s.activo) return false;
      if (gen.tipoSesion === 'laboratorio') return s.esLaboratorio;
      return !s.esLaboratorio || s.habilitadoParaTeoría;
    });
    // Filtrar por jornada del docente
    if (gen.docenteId) {
      const d = ctx.indiceDocentes.get(gen.docenteId);
      if (d) {
        const jDoc = d.horaEntrada >= '13:40' ? 'tarde' : d.horaSalida <= '13:00' ? 'manana' : 'ambas';
        if (jDoc !== 'ambas') {
          const filt = candidatos.filter(s => s.jornada === jDoc || s.jornada === 'ambas');
          if (filt.length > 0) candidatos = filt;
        }
      }
    }
    if (candidatos.length > 0) {
      gen.salonId = candidatos[Math.floor(Math.random() * candidatos.length)].id;
    }
  }

  return { ...cromosoma, genes };
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
  // Reparar integridad estructural: solo rellena nulls y genes faltantes.
  // NO cambia docentes/salones incorrectos (non-null), así la población
  // inicial sigue siendo aleatoria con muchos conflictos reales.
  poblacion = poblacion.map(c => repararCromosoma(c, ctx));
  evaluarPoblacion(poblacion, ctx);

  let mejorCromosoma = ordenarPoblacion(poblacion)[0];
  let generacionActual = 0;

  // ── Control de estancamiento ───────────────────────────────
  // Si el mejor fitness no mejora en UMBRAL generaciones:
  //   - Se reinyectan individuos frescos (diversidad)
  //   - Se duplica temporalmente la tasa de mutación
  // Pasadas otras UMBRAL generaciones sin mejora → reset total.
  const UMBRAL_ESTANCAMIENTO = 200;    // generaciones sin mejora → primer escape
  const UMBRAL_RESET          = 500;   // generaciones sin mejora → reinicio parcial
  const FRACCION_REINYECCION  = 0.30;  // % de población a reemplazar con individuos frescos
  let generacionesSinMejora = 0;
  let mejorFitnessHistorico = mejorCromosoma.fitness;
  let tasaMutacionActual = config.tasaMutacion;

  while (generacionActual < config.maxGeneraciones) {
    generacionActual++;

    // Ordenar de mayor a menor fitness
    const ordenada = ordenarPoblacion(poblacion);
    mejorCromosoma = ordenada[0];

    // ── Detección y escape de estancamiento ─────────────────
    if (mejorCromosoma.fitness > mejorFitnessHistorico) {
      mejorFitnessHistorico = mejorCromosoma.fitness;
      generacionesSinMejora = 0;
      tasaMutacionActual = config.tasaMutacion; // restaurar tasa normal
    } else {
      generacionesSinMejora++;
    }

    if (generacionesSinMejora === UMBRAL_ESTANCAMIENTO) {
      // Primer escape: reinyectar individuos frescos + boost de mutación
      tasaMutacionActual = Math.min(config.tasaMutacion * 3, 0.5);
      const nReinyectar = Math.floor(config.tamanioPoblacion * FRACCION_REINYECCION);
      const frescos = generarPoblacionInicial(nReinyectar, ctx)
        .map(c => repararCromosoma(c, ctx));
      evaluarPoblacion(frescos, ctx);
      // Reemplazar los peores con los frescos
      const nuevaOrdenada = [...ordenada];
      for (let k = 0; k < frescos.length; k++) {
        nuevaOrdenada[nuevaOrdenada.length - 1 - k] = frescos[k];
      }
      poblacion = nuevaOrdenada;
      console.log(`[GA] Estancamiento en gen ${generacionActual} → reinyectando ${nReinyectar} individuos, mutación×3`);
    } else if (generacionesSinMejora === UMBRAL_RESET) {
      // Segundo escape: reinicio parcial — conservar solo el élite, regenerar el resto
      tasaMutacionActual = config.tasaMutacion;
      generacionesSinMejora = 0;
      const eliteSize = Math.max(config.elitismo, Math.floor(config.tamanioPoblacion * 0.10));
      const elite = ordenada.slice(0, eliteSize);
      const restantes = generarPoblacionInicial(config.tamanioPoblacion - eliteSize, ctx)
        .map(c => repararCromosoma(c, ctx));
      evaluarPoblacion(restantes, ctx);
      poblacion = [...elite, ...restantes];
      console.log(`[GA] Reset parcial en gen ${generacionActual} → conservando ${eliteSize} élite`);
    }
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

      // Mutación + reparación de integridad (docente, salón, sincronía de sección)
      const hijoMutado1 = repararCromosoma(mutar(hijo1, config.metodoMutacion, tasaMutacionActual, ctx), ctx);
      const hijoMutado2 = repararCromosoma(mutar(hijo2, config.metodoMutacion, tasaMutacionActual, ctx), ctx);

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