import { v4 as uuidv4 } from "uuid";
import type { Cromosoma, Gen, ContextoGA } from "../types/Genetic.types";
import type { Curso, Salon, FranjaHoraria } from "../../algoritmoGenetico/types/Domain.types";
import { obtenerFranjasContiguas } from "../../algoritmoGenetico/utils/timeUtil";

// ─────────────────────────────────────────────────────────────
// HELPERS INTERNOS
// ─────────────────────────────────────────────────────────────

/** Elige un elemento aleatorio de un array */
function elegirAleatorio<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function diaCanonicoTeoria(franjas: FranjaHoraria[]): string | null {
  const prioridad = ["lunes", "miercoles", "viernes"] as const;
  for (const dia of prioridad) {
    if (franjas.some((f) => f.dia === dia)) return dia;
  }
  return franjas.length > 0 ? franjas[0].dia : null;
}

/**
 * Filtra las franjas disponibles para un curso dado su jornada
 * y las restricciones del salón y docente.
 */
function franjasDisponiblesParaCurso(
  curso: Curso,
  franjas: FranjaHoraria[],
  tipoSesion: "teoria" | "laboratorio"
): FranjaHoraria[] {
  const diaTeoria = tipoSesion === "teoria" ? diaCanonicoTeoria(franjas) : null;

  return franjas.filter((f) => {
    if (tipoSesion === "teoria" && diaTeoria && f.dia !== diaTeoria) return false;
    if (tipoSesion === "laboratorio" && f.dia !== "martes" && f.dia !== "jueves") return false;
    if (curso.jornada === "manana" && f.jornada !== "manana") return false;
    if (curso.jornada === "tarde" && f.jornada !== "tarde") return false;
    return true;
  });
}

/**
 * Filtra los salones válidos para un curso.
 */
function salonesDisponiblesParaCurso(
  curso: Curso,
  tipoSesion: "teoria" | "laboratorio",
  salones: Salon[]
): Salon[] {
  return salones.filter((s) => {
    if (!s.activo) return false;
    // Si el curso tiene salón fijo, solo ese
    if (curso.salonFijo) return s.id === curso.salonFijo;
    // Para laboratorios solo salones de laboratorio
    if (tipoSesion === "laboratorio") return s.esLaboratorio;
    // Para teoría: salones normales O laboratorios habilitados para teoría
    if (tipoSesion === "teoria") return !s.esLaboratorio || s.habilitadoParaTeoría;
    return true;
  });
}

// ─────────────────────────────────────────────────────────────
// GENERACIÓN DE UN GEN (una asignación curso-sección)
// ─────────────────────────────────────────────────────────────

function generarGen(
  curso: Curso,
  seccion: string,
  tipoSesion: "teoria" | "laboratorio",
  ctx: ContextoGA
): Gen {
  const { salones, franjas, mapaCursoDocentes, docentesActivos } = ctx;

  // 1. Elegir docente ──────────────────────────────────────────
  let docenteId: string | null = null;
  if (!curso.sinSalon) {
    if (curso.docenteFijo) {
      docenteId = curso.docenteFijo;
    } else {
      const posibles = mapaCursoDocentes.get(curso.id) ?? [];
      const activos = posibles.filter((id) => docentesActivos.has(id));
      docenteId = activos.length > 0 ? elegirAleatorio(activos) : null;
    }
  }

  // 2. Elegir salón ────────────────────────────────────────────
  let salonId: string | null = null;
  if (!curso.sinSalon) {
    const salonesValidos = salonesDisponiblesParaCurso(curso, tipoSesion, salones);
    salonId = salonesValidos.length > 0
      ? elegirAleatorio(salonesValidos).id
      : null;
  }

  // 3. Elegir franja ───────────────────────────────────────────
  let franjaId: string;
  let franjasExtra: string[] | undefined;

  if (curso.franjaFija) {
    franjaId = curso.franjaFija;
  } else {
    const disponibles = franjasDisponiblesParaCurso(curso, franjas, tipoSesion);
    if (disponibles.length === 0) {
      // Fallback: cualquier franja
      franjaId = elegirAleatorio(franjas).id;
    } else if (tipoSesion === "laboratorio") {
      // Laboratorio: intentamos 3 periodos contiguos, si no, 2
      let contiguas = null;
      const intentos = disponibles.slice().sort(() => Math.random() - 0.5);
      for (const f of intentos) {
        contiguas = obtenerFranjasContiguas(f.id, 3, franjas);
        if (contiguas) break;
        contiguas = obtenerFranjasContiguas(f.id, 2, franjas);
        if (contiguas) break;
      }
      if (contiguas && contiguas.length > 1) {
        franjaId = contiguas[0].id;
        franjasExtra = contiguas.slice(1).map((f) => f.id);
      } else {
        franjaId = elegirAleatorio(disponibles).id;
      }
    } else {
      franjaId = elegirAleatorio(disponibles).id;
    }
  }

  return {
    cursoId: curso.id,
    seccion,
    docenteId,
    salonId,
    franjaId,
    tipoSesion,
    franjasExtra,
  };
}

// ─────────────────────────────────────────────────────────────
// GENERACIÓN DE UN CROMOSOMA SIN TRASLAPES INICIALES
//
// En vez de asignar salón y franja aleatoriamente (lo que genera
// muchos traslapes desde el inicio), usamos un enfoque constructivo:
//   1. Mezclar los cursos aleatoriamente
//   2. Para cada curso, elegir la primera franja+salón disponible
//
// Esto garantiza población inicial sin traslapes de salón,
// dándole al GA un punto de partida mucho mejor.
// ─────────────────────────────────────────────────────────────

export function generarCromosoma(ctx: ContextoGA): Cromosoma {
  const genes: Gen[] = [];
  const letras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  // Rastrear ocupación: "grupoDia|horaInicio|salonId" → ocupado
  // grupoDia: LXV para teoría, M/J para laboratorio
  const ocupado = new Set<string>();

  function claveOcupacion(franjaId: string, salonId: string, tipoSesion: "teoria" | "laboratorio"): string {
    const franja = ctx.indiceFranjas.get(franjaId);
    if (!franja) return `${franjaId}|${salonId}`;
    const grupoDia = tipoSesion === "teoria" ? "LXV"
      : franja.dia === "martes" ? "M" : "J";
    return `${grupoDia}|${franja.horaInicio}|${salonId}`;
  }

  function elegirFranjaSalonLibre(
    curso: Curso,
    tipoSesion: "teoria" | "laboratorio",
  ): { franjaId: string; salonId: string | null } | null {
    const franjasDisp = franjasDisponiblesParaCurso(curso, ctx.franjas, tipoSesion);
    const salonesDisp = salonesDisponiblesParaCurso(curso, tipoSesion, ctx.salones);

    // Mezclar para variedad entre cromosomas
    const franjasShuf = franjasDisp.slice().sort(() => Math.random() - 0.5);
    const salonesShuf = salonesDisp.slice().sort(() => Math.random() - 0.5);

    for (const franja of franjasShuf) {
      for (const salon of salonesShuf) {
        const clave = claveOcupacion(franja.id, salon.id, tipoSesion);
        if (!ocupado.has(clave)) {
          ocupado.add(clave);
          return { franjaId: franja.id, salonId: salon.id };
        }
      }
    }
    // Fallback: si no hay slot libre, asignar sin restricción (el GA corregirá)
    const f = franjasShuf[0] ?? ctx.franjas[0];
    const s = salonesShuf[0] ?? null;
    return { franjaId: f?.id ?? ctx.franjas[0].id, salonId: s?.id ?? null };
  }

  /**
   * Para laboratorios: busca noPeriodos franjas contiguas libres en el mismo día
   * (M o J) y el mismo salón, registrando todas como ocupadas.
   * Retorna franjasExtra (las adicionales más allá de la primera).
   */
  function elegirSlotLabContiguo(
    curso: Curso,
    noPeriodosLab: number,
  ): { franjaId: string; salonId: string | null; franjasExtra: string[] } | null {
    const franjasDisp = franjasDisponiblesParaCurso(curso, ctx.franjas, "laboratorio");
    const salonesDisp = salonesDisponiblesParaCurso(curso, "laboratorio", ctx.salones);

    const franjasShuf = franjasDisp.slice().sort(() => Math.random() - 0.5);
    const salonesShuf = salonesDisp.slice().sort(() => Math.random() - 0.5);

    for (const franja of franjasShuf) {
      const contiguas = obtenerFranjasContiguas(franja.id, noPeriodosLab, ctx.franjas);
      if (!contiguas || contiguas.length < noPeriodosLab) continue;

      for (const salon of salonesShuf) {
        // Verificar que TODAS las franjas contiguas están libres para ese salón
        const allFree = contiguas.every((f) => !ocupado.has(claveOcupacion(f.id, salon.id, "laboratorio")));
        if (allFree) {
          // Marcar todas como ocupadas
          for (const f of contiguas) {
            ocupado.add(claveOcupacion(f.id, salon.id, "laboratorio"));
          }
          return {
            franjaId: contiguas[0].id,
            salonId: salon.id,
            franjasExtra: contiguas.slice(1).map((f) => f.id),
          };
        }
      }
    }

    // Fallback: slot simple sin franjasExtra
    const simple = elegirFranjaSalonLibre(curso, "laboratorio");
    if (simple) return { franjaId: simple.franjaId, salonId: simple.salonId, franjasExtra: [] };
    return null;
  }

  /**
   * Dado un salonId fijo, elige una franja libre para ese salón/tipo.
   * Registra la ocupación. Retorna null solo si no hay ninguna franja disponible
   * (el fallback garantiza que siempre hay al menos una opción).
   */
  function elegirFranjaLibreParaSalon(
    curso: Curso,
    tipoSesion: "teoria" | "laboratorio",
    salonId: string,
  ): string | null {
    const franjasDisp = franjasDisponiblesParaCurso(curso, ctx.franjas, tipoSesion);
    const franjasShuf = franjasDisp.slice().sort(() => Math.random() - 0.5);
    for (const franja of franjasShuf) {
      const clave = claveOcupacion(franja.id, salonId, tipoSesion);
      if (!ocupado.has(clave)) {
        ocupado.add(clave);
        return franja.id;
      }
    }
    // No hay slot libre: devolver la primera franja disponible (sin marcar ocupada)
    // El GA resolverá el conflicto mediante mutación.
    return franjasShuf[0]?.id ?? null;
  }

  // Mezclar cursos para variedad entre cromosomas de la población
  const cursosActivos = ctx.cursos.filter((c) => c.activo)
    .slice().sort(() => Math.random() - 0.5);

  for (const curso of cursosActivos) {
    const numSecciones = Math.max(1, curso.secciones);
    const noPeriodos    = curso.noPeriodos    ?? 1;
    const noPeriodosLab = curso.noPeriodosLab ?? 2;

    for (let s = 0; s < numSecciones; s++) {
      const seccion = letras[s] ?? `S${s}`;

      // ── Docente: elegir UNA VEZ para toda la sección ───────
      let docenteId: string | null = null;
      if (!curso.sinSalon) {
        if (curso.docenteFijo) {
          docenteId = curso.docenteFijo;
        } else {
          const posibles = ctx.mapaCursoDocentes.get(curso.id) ?? [];
          const activos = posibles.filter((id) => ctx.docentesActivos.has(id));
          docenteId = activos.length > 0 ? elegirAleatorio(activos) : null;
        }
      }

      // ── Genes de teoría: noPeriodos con el MISMO salón ────
      const teoriaGens: Gen[] = [];

      if (curso.franjaFija) {
        // Franja fija del curso → solo 1 gen de teoría
        const salonesDisp = salonesDisponiblesParaCurso(curso, "teoria", ctx.salones);
        const salonId = salonesDisp.length > 0 ? elegirAleatorio(salonesDisp).id : null;
        teoriaGens.push({
          cursoId: curso.id, seccion, docenteId,
          salonId: curso.sinSalon ? null : salonId,
          franjaId: curso.franjaFija, tipoSesion: "teoria",
        });
      } else {
        // Elegir salón de teoría UNA VEZ para toda la sección
        let teoriaSalonId: string | null = null;
        if (!curso.sinSalon) {
          const salonesDisp = salonesDisponiblesParaCurso(curso, "teoria", ctx.salones);
          const salonesShuf = salonesDisp.slice().sort(() => Math.random() - 0.5);
          // Preferir salón que tenga al menos 1 franja libre disponible
          for (const salon of salonesShuf) {
            const franjasDisp = franjasDisponiblesParaCurso(curso, ctx.franjas, "teoria");
            const tieneLibre = franjasDisp.some(
              (f) => !ocupado.has(claveOcupacion(f.id, salon.id, "teoria"))
            );
            if (tieneLibre) { teoriaSalonId = salon.id; break; }
          }
          if (!teoriaSalonId) teoriaSalonId = salonesShuf[0]?.id ?? null;
        }

        // Crear noPeriodos genes con diferente franja pero mismo salón
        for (let p = 0; p < noPeriodos; p++) {
          const franjaId = teoriaSalonId
            ? elegirFranjaLibreParaSalon(curso, "teoria", teoriaSalonId)
            : (franjasDisponiblesParaCurso(curso, ctx.franjas, "teoria")[0]?.id ?? null);
          if (franjaId) {
            teoriaGens.push({
              cursoId: curso.id, seccion, docenteId,
              salonId: curso.sinSalon ? null : teoriaSalonId,
              franjaId, tipoSesion: "teoria",
            });
          }
        }
      }

      // ── Gen de laboratorio: noPeriodosLab periodos contiguos ──
      const labGens: Gen[] = [];
      if (curso.tieneLabatorio) {
        const slotLab = elegirSlotLabContiguo(curso, noPeriodosLab);
        if (slotLab) {
          labGens.push({
            cursoId: curso.id, seccion, docenteId,
            salonId: curso.sinSalon ? null : slotLab.salonId,
            franjaId: slotLab.franjaId,
            franjasExtra: slotLab.franjasExtra.length > 0 ? slotLab.franjasExtra : undefined,
            tipoSesion: "laboratorio",
          });
        }
      }

      // ── Sync docente: si uno tiene docente y el otro no, propagar ──
      // Cubre el caso donde docenteId fue null pero el lab resolvió uno distinto.
      const todosGens = [...teoriaGens, ...labGens];
      const docenteResuelto = todosGens.find(g => g.docenteId !== null)?.docenteId ?? null;
      if (docenteResuelto !== docenteId) {
        for (const g of todosGens) g.docenteId = docenteResuelto;
      }

      genes.push(...todosGens);
    }
  }

  return {
    id: uuidv4(),
    genes,
    fitness: 0,
  };
}

// ─────────────────────────────────────────────────────────────
// GENERACIÓN DE LA POBLACIÓN INICIAL
// ─────────────────────────────────────────────────────────────

/**
 * Genera `tamanio` cromosomas aleatorios.
 * La evaluación del fitness se hace en una pasada separada
 * por el motor principal para poder paralelizarla si se desea.
 */
export function generarPoblacionInicial(
  tamanio: number,
  ctx: ContextoGA
): Cromosoma[] {
  const poblacion: Cromosoma[] = [];
  for (let i = 0; i < tamanio; i++) {
    poblacion.push(generarCromosoma(ctx));
  }
  return poblacion;
}