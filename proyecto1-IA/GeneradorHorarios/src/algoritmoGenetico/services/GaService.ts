// ============================================================
// services/gaService.ts
// Servicio que orquesta el flujo completo:
//   BD → ContextoGA → ejecutarGA() → guardar resultado → reportes
//
// Este es el archivo que tu controlador/endpoint llama.
// ============================================================

import type { ConfiguracionGA, ResultadoEjecucion, ResultadoGeneracion } from '../types/Genetic.types';
import type { ConfiguracionHorario } from '../types/Domain.types';
import { cargarContexto, guardarSolucion } from '../mapperSequelize/MapperSequelize';
import { ejecutarGA } from '../genetic/Engine';
import { Calendario, Conflicto, Curso, Docente, Laboratorio, Periodo, Salon, Seccion, Solucion } from '../../models';
import EstadisticaSolucion from '../../models/EstadisticaSolucion';

// ─────────────────────────────────────────────────────────────
// CONFIGURACIÓN POR DEFECTO
// El usuario puede sobreescribir cualquier valor desde la UI
// ─────────────────────────────────────────────────────────────

export const CONFIG_HORARIO_DEFAULT: ConfiguracionHorario = {
  duracionPeriodoMinutos: 50,
  horaInicioManana: "07:00",
  horaFinManana: "13:00",
  horaInicioTarde: "13:40",
  horaFinTarde: "21:10",
  diasActivos: ["lunes", "martes", "miercoles", "jueves", "viernes"],
};

export const CONFIG_GA_DEFAULT: ConfiguracionGA = {
  tamanioPoblacion: 100,
  maxGeneraciones: 500,
  fitnesObjetivo: 9800,      // ~98% del score máximo → horario casi perfecto
  tasaMutacion: 0.05,
  tasaCruce: 0.8,
  tamanioTorneo: 3,
  elitismo: 2,
  metodoSeleccion: "torneo",
  metodoCruce: "un_punto",
  metodoMutacion: "intercambio",
};
/*
export const CONFIG_GA_DEFAULT: ConfiguracionGA = {
  tamanioPoblacion:  200,   // era 100 — más diversidad
  maxGeneraciones:   1000,  // era 500 — más tiempo
  fitnesObjetivo:    10000, // sin conflictos = BASE_SCORE exacto
  tasaMutacion:      0.15,  // era 0.05 — más exploración
  tasaCruce:         0.8,
  tamanioTorneo:     5,     // era 3 — más presión selectiva
  elitismo:          5,     // era 2 — preservar más buenos
  metodoSeleccion:   'torneo',
  metodoCruce:       'un_punto',
  metodoMutacion:    'intercambio',
};
*/

// ─────────────────────────────────────────────────────────────
// SERVICIO PRINCIPAL
// ─────────────────────────────────────────────────────────────

export interface OpcionesEjecucion {
  configHorario?: Partial<ConfiguracionHorario>;
  configGA?: Partial<ConfiguracionGA>;
  /** Callback en tiempo real para la gráfica del frontend */
  onGeneracion?: (stats: ResultadoGeneracion) => void;
  /** Si true, guarda el resultado en la BD automáticamente */
  guardarEnBD?: boolean;
}

export interface ResultadoServicio extends ResultadoEjecucion {
  solucionId?: number; // ID en BD si se guardó
}

/**
 * Ejecuta el ciclo completo del GA:
 *  1. Carga el contexto desde PostgreSQL
 *  2. Corre el algoritmo genético
 *  3. Opcionalmente guarda la solución en la BD
 *  4. Retorna el resultado con todos los reportes
 */
export async function ejecutarHorarioGA(
  opciones: OpcionesEjecucion = {},
): Promise<ResultadoServicio> {

  const configHorario: ConfiguracionHorario = {
    ...CONFIG_HORARIO_DEFAULT,
    ...opciones.configHorario,
  };

  const configGA: ConfiguracionGA = {
    ...CONFIG_GA_DEFAULT,
    ...opciones.configGA,
  };

  // ── 1. Contexto desde BD ───────────────────────────────────
  console.time('[gaService] carga');
  const ctx = await cargarContexto(configHorario);
  console.timeEnd('[gaService] carga');

  if (ctx.cursos.length === 0) {
    throw new Error('No hay cursos activos en la base de datos.');
  }

  if (ctx.docentes.length === 0) {
    throw new Error('No hay docentes activos en la base de datos.');
  }

  if (ctx.salones.length === 0) {
    throw new Error('No hay salones activos en la base de datos.');
  }

  // ── DEBUG FITNESS ──────────────────────────────────────────
  // Log temporal para diagnosticar fitness=0. Eliminar luego.
  {
    const { generarCromosoma } = await import('../genetic/Population');
    const { evaluarFitness }   = await import('../genetic/Fitness');
    const { detectarConflictos } = await import('../utils/validators');
    const cromo = generarCromosoma(ctx);
    evaluarFitness(cromo, ctx);
    const conflictos = detectarConflictos(cromo.genes, ctx);
    const porTipo = conflictos.reduce((acc, c) => {
      acc[c.tipo] = (acc[c.tipo] ?? 0) + 1; return acc;
    }, {} as Record<string, number>);
    const penalizacion = conflictos.reduce((acc, c) => {
      const pesos: Record<string, number> = {
        docente_doble: 100, salon_doble: 100, semestre_traslape: 80,
        docente_fuera_horario: 60, salon_jornada: 50, curso_jornada: 50,
      };
      return acc + (pesos[c.tipo] ?? 10);
    }, 0);
    console.log('\n====== FITNESS DEBUG ======');
    console.log(`  Ctx: ${ctx.cursos.length} cursos | ${ctx.docentes.length} docentes | ${ctx.salones.length} salones | ${ctx.franjas.length} franjas`);
    console.log(`  Genes del crom: ${cromo.genes.length}`);
    console.log(`  Conflictos por tipo:`, porTipo);
    console.log(`  Penalizacion total: ${penalizacion}`);
    console.log(`  Fitness resultado: ${cromo.fitness}`);
    console.log(`  Docentes horaEntrada sample:`, ctx.docentes.slice(0, 3).map(d => `${d.nombre}: ${d.horaEntrada}-${d.horaSalida}`));
    console.log('===========================\n');
  }
  // ── FIN DEBUG ──────────────────────────────────────────────

  // ── 2. Ejecutar GA ─────────────────────────────────────────
  console.time('[gaService] GA');
  const resultado = await ejecutarGA(configGA, ctx, opciones.onGeneracion);
  console.timeEnd('[gaService] GA');

  // ── 3. Persistir si se solicitó ────────────────────────────
  let solucionId: number | undefined;
  if (opciones.guardarEnBD) {
    solucionId = await guardarSolucion(
      resultado.mejorCromosoma,
      resultado.generacionesEjecutadas,
      ctx,
      resultado,
    );
  }

  console.info(
    `[gaService] Listo | fitness: ${resultado.mejorCromosoma.fitness} | ` +
    `conflictos: ${resultado.listaConflictos.length} | ` +
    `continuidad: ${resultado.porcentajeCursosContinuos}% | ` +
    `tiempo: ${resultado.tiempoEjecucionMs.toFixed(0)}ms`,
  );

  console.log('done!');

  return { ...resultado, solucionId };
}

export const ultimaSolucion = async () => {
  const sol = await Solucion.findOne({
    include: [
      {
        model: Calendario,
        as: 'calendarios',
        include: [
          {
            model: Seccion,
            as: 'seccion',
            include: [{ model: Curso, as: 'curso' }],
          },
          {
            model: Laboratorio,
            as: 'laboratorio',
            include: [
              {
                model: Seccion,
                as: 'seccion',
                include: [{ model: Curso, as: 'curso' }],
              },
            ],
          },
          { model: Docente, as: 'docente' },
          { model: Salon,   as: 'salon'   },
          { model: Periodo, as: 'periodo' },
        ],
      },
      { model: EstadisticaSolucion, as: 'estadistica' },
      { model: Conflicto,           as: 'conflictos'  },
    ],
    order: [['id', 'DESC']],
  });

  if (!sol) return null;

  // Mapear calendarios a formato denormalizado
  const calendario = (sol.get('calendarios') as any[]).map((cal: any) => {
    const seccion     = cal.seccion    as any | null;
    const laboratorio = cal.laboratorio as any | null;
    const docente     = cal.docente    as any | null;
    const salon       = cal.salon      as any | null;
    const periodo     = cal.periodo    as any | null;

    // Resolver curso según tipo
    const cursoObj = seccion?.curso ?? laboratorio?.seccion?.curso ?? null;

    return {
      id:               cal.id,
      tipo_asignacion:  cal.tipo_asignacion,
      dia:              cal.dia,
      curso:            cursoObj?.nombre         ?? null,
      codigo_curso:     cursoObj?.codigo         ?? null,
      carrera:          cursoObj?.carrera        ?? null,
      semestre:         cursoObj?.semestre       ?? null,
      seccion:          seccion?.letra           ?? null,
      laboratorio:      laboratorio?.seccion?.letra ?? null,
      docente:          docente?.nombre          ?? null,
      registro_docente: docente?.registro        ?? null,
      salon:            salon?.nombre            ?? null,
      hora_inicio:      periodo?.hora_inicio     ?? null,
      hora_fin:         periodo?.hora_fin        ?? null,
    };
  });

  const estadRaw = sol.get('estadistica') as any;
  const estadistica = estadRaw
    ? {
        tiempo_ejecucion:             estadRaw.tiempo_ejecucion,
        generaciones_ejecutadas:      estadRaw.generaciones_ejecutadas,
        cantidad_conflictos:          estadRaw.cantidad_conflictos,
        memoria_usada_bytes:          estadRaw.memoria_usada_bytes,
        porcentaje_cursos_continuos:  estadRaw.porcentaje_cursos_continuos,
      }
    : null;

  const conflictos = ((sol.get('conflictos') as any[]) ?? []).map((c: any) => ({
    tipo:        c.tipo,
    descripcion: c.descripcion,
  }));

  return {
    solucion: {
      id:             sol.id,
      generacion:     sol.generacion,
      aptitud:        sol.aptitud,
      fecha_creacion: sol.fecha_creacion,
    },
    total:       calendario.length,
    calendario,
    estadistica,
    conflictos,
  };
}

export const obtenerSolucionPorId = async (id: number) => {
  const sol = await Solucion.findOne({
    include: [
      {
        model: Calendario,
        as: 'calendarios',
        include: [
          {
            model: Seccion,
            as: 'seccion',
            include: [{ model: Curso, as: 'curso' }],
          },
          {
            model: Laboratorio,
            as: 'laboratorio',
            include: [
              {
                model: Seccion,
                as: 'seccion',
                include: [{ model: Curso, as: 'curso' }],
              },
            ],
          },
          { model: Docente, as: 'docente' },
          { model: Salon,   as: 'salon'   },
          { model: Periodo, as: 'periodo' },
        ],
      },
      { model: EstadisticaSolucion, as: 'estadistica' },
      { model: Conflicto,           as: 'conflictos'  },
    ],
    where: { id: id },
  });

  if (!sol) return null;

  // Mapear calendarios a formato denormalizado
  const calendario = (sol.get('calendarios') as any[]).map((cal: any) => {
    const seccion     = cal.seccion    as any | null;
    const laboratorio = cal.laboratorio as any | null;
    const docente     = cal.docente    as any | null;
    const salon       = cal.salon      as any | null;
    const periodo     = cal.periodo    as any | null;

    // Resolver curso según tipo
    const cursoObj = seccion?.curso ?? laboratorio?.seccion?.curso ?? null;

    return {
      id:               cal.id,
      tipo_asignacion:  cal.tipo_asignacion,
      dia:              cal.dia,
      curso:            cursoObj?.nombre         ?? null,
      codigo_curso:     cursoObj?.codigo         ?? null,
      carrera:          cursoObj?.carrera        ?? null,
      semestre:         cursoObj?.semestre       ?? null,
      seccion:          seccion?.letra           ?? null,
      laboratorio:      laboratorio?.seccion?.letra ?? null,
      docente:          docente?.nombre          ?? null,
      registro_docente: docente?.registro        ?? null,
      salon:            salon?.nombre            ?? null,
      hora_inicio:      periodo?.hora_inicio     ?? null,
      hora_fin:         periodo?.hora_fin        ?? null,
    };
  });

  const estadRaw = sol.get('estadistica') as any;
  const estadistica = estadRaw
    ? {
        tiempo_ejecucion:             estadRaw.tiempo_ejecucion,
        generaciones_ejecutadas:      estadRaw.generaciones_ejecutadas,
        cantidad_conflictos:          estadRaw.cantidad_conflictos,
        memoria_usada_bytes:          estadRaw.memoria_usada_bytes,
        porcentaje_cursos_continuos:  estadRaw.porcentaje_cursos_continuos,
      }
    : null;

  const conflictos = ((sol.get('conflictos') as any[]) ?? []).map((c: any) => ({
    tipo:        c.tipo,
    descripcion: c.descripcion,
  }));

  return {
    solucion: {
      id:             sol.id,
      generacion:     sol.generacion,
      aptitud:        sol.aptitud,
      fecha_creacion: sol.fecha_creacion,
    },
    total:       calendario.length,
    calendario,
    estadistica,
    conflictos,
  };
}