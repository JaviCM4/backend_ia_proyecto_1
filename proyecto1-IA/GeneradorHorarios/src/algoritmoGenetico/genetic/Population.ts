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

  /** Filtra franjas dentro del horario contractual del docente (evita docente_fuera_horario). */
  function filtrarFranjasPorDocente(franjas: FranjaHoraria[], dId: string | null): FranjaHoraria[] {
    if (!dId) return franjas;
    const d = ctx.indiceDocentes.get(dId);
    if (!d) return franjas;
    const f = franjas.filter(fr => fr.horaInicio >= d.horaEntrada && fr.horaFin <= d.horaSalida);
    return f.length > 0 ? f : franjas;
  }

  /** Filtra salones compatibles con la jornada efectiva del docente (evita salon_jornada). */
  function filtrarSalonesPorDocente(salones: Salon[], dId: string | null): Salon[] {
    if (!dId) return salones;
    const d = ctx.indiceDocentes.get(dId);
    if (!d) return salones;
    const jornada = d.horaEntrada >= "13:40" ? "tarde" : d.horaSalida <= "13:00" ? "manana" : "ambas";
    if (jornada === "ambas") return salones;
    const f = salones.filter(s => s.jornada === jornada || s.jornada === "ambas");
    return f.length > 0 ? f : salones;
  }

  function elegirFranjaSalonLibre(
    curso: Curso,
    tipoSesion: "teoria" | "laboratorio",
    dId?: string | null,
  ): { franjaId: string; salonId: string | null } | null {
    let franjasDisp = franjasDisponiblesParaCurso(curso, ctx.franjas, tipoSesion);
    franjasDisp = filtrarFranjasPorDocente(franjasDisp, dId ?? null);
    let salonesDisp = salonesDisponiblesParaCurso(curso, tipoSesion, ctx.salones);
    salonesDisp = filtrarSalonesPorDocente(salonesDisp, dId ?? null);

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
   * (M o J) filtrando opcionalmente a un día específico.
   * Devuelve null si no encuentra (sin fallback).
   */
  function elegirSlotLabContiguo(
    curso: Curso,
    n: number,
    diaForzado?: "martes" | "jueves",
    dId?: string | null,
  ): { franjaId: string; salonId: string | null; franjasExtra: string[] } | null {
    let franjasBase = diaForzado
      ? ctx.franjas.filter((f) => {
          if (f.dia !== diaForzado) return false;
          if (curso.jornada === "manana" && f.jornada !== "manana") return false;
          if (curso.jornada === "tarde"  && f.jornada !== "tarde")  return false;
          return true;
        })
      : franjasDisponiblesParaCurso(curso, ctx.franjas, "laboratorio");
    franjasBase = filtrarFranjasPorDocente(franjasBase, dId ?? null);

    let salonesDisp = salonesDisponiblesParaCurso(curso, "laboratorio", ctx.salones);
    salonesDisp = filtrarSalonesPorDocente(salonesDisp, dId ?? null);
    const franjasShuf = franjasBase.slice().sort(() => Math.random() - 0.5);
    const salonesShuf = salonesDisp.slice().sort(() => Math.random() - 0.5);

    for (const franja of franjasShuf) {
      const contiguas = obtenerFranjasContiguas(franja.id, n, ctx.franjas);
      if (!contiguas || contiguas.length < n) continue;
      for (const salon of salonesShuf) {
        const allFree = contiguas.every((f) => !ocupado.has(claveOcupacion(f.id, salon.id, "laboratorio")));
        if (allFree) {
          for (const f of contiguas) ocupado.add(claveOcupacion(f.id, salon.id, "laboratorio"));
          return {
            franjaId: contiguas[0].id,
            salonId: salon.id,
            franjasExtra: contiguas.slice(1).map((f) => f.id),
          };
        }
      }
    }
    return null; // Sin fallback — elegirGenLab gestiona los casos
  }

  /**
   * Elige UNA franja libre (sin contigüidad) en un día específico.
   * Registra la ocupación y devuelve franjasExtra vacío.
   */
  function elegirSimpleEnDia(
    curso: Curso,
    dia: "martes" | "jueves",
    dId?: string | null,
  ): { franjaId: string; salonId: string | null } | null {
    let franjasDelDia = ctx.franjas.filter((f) => {
      if (f.dia !== dia) return false;
      if (curso.jornada === "manana" && f.jornada !== "manana") return false;
      if (curso.jornada === "tarde"  && f.jornada !== "tarde")  return false;
      return true;
    });
    franjasDelDia = filtrarFranjasPorDocente(franjasDelDia, dId ?? null);
    let salonesDisp = salonesDisponiblesParaCurso(curso, "laboratorio", ctx.salones);
    salonesDisp = filtrarSalonesPorDocente(salonesDisp, dId ?? null);
    const franjasShuf = franjasDelDia.slice().sort(() => Math.random() - 0.5);
    const salonesShuf = salonesDisp.slice().sort(() => Math.random() - 0.5);
    for (const franja of franjasShuf) {
      for (const salon of salonesShuf) {
        const clave = claveOcupacion(franja.id, salon.id, "laboratorio");
        if (!ocupado.has(clave)) {
          ocupado.add(clave);
          return { franjaId: franja.id, salonId: salon.id };
        }
      }
    }
    // Fallback sin verificar ocupación (el GA corregirá)
    const f = franjasShuf[0];
    const s = salonesShuf[0] ?? null;
    return f ? { franjaId: f.id, salonId: s?.id ?? null } : null;
  }

  /**
   * Genera SIEMPRE EXACTAMENTE 1 gen de lab por sección con las
   * franjasExtra correctas para cubrir noPeriodosLab períodos.
   *
   * Estrategia por caso:
   *   1 período → gen simple
   *   2 períodos → intenta 2 contiguos mismo día; si no, toma 1M + 1J
   *   3 períodos → intenta 3 juntos (+5 bonus en fitness);
   *                si no, toma 2M+1J o 1M+2J (split — permitido)
   */
  function elegirGenLab(
    curso: Curso,
    docenteId: string | null,
    seccion: string,
  ): Gen | null {
    const nPer = curso.noPeriodosLab ?? 2;
    const sinSalon = curso.sinSalon ?? false;

    const mkGen = (franjaId: string, salonId: string | null, franjasExtra?: string[]): Gen => ({
      cursoId: curso.id, seccion, docenteId,
      salonId: sinSalon ? null : salonId,
      franjaId, tipoSesion: "laboratorio" as const,
      ...(franjasExtra && franjasExtra.length > 0 ? { franjasExtra } : {}),
    });

    // ── 1 período ─────────────────────────────────────────────
    if (nPer <= 1) {
      const s = elegirFranjaSalonLibre(curso, "laboratorio", docenteId);
      return s ? mkGen(s.franjaId, s.salonId) : null;
    }

    // ── 2 períodos ────────────────────────────────────────────
    if (nPer === 2) {
      const s2 = elegirSlotLabContiguo(curso, 2, undefined, docenteId);
      if (s2) return mkGen(s2.franjaId, s2.salonId, s2.franjasExtra);
      const [diaA, diaB]: ["martes"|"jueves","martes"|"jueves"] =
        Math.random() < 0.5 ? ["martes","jueves"] : ["jueves","martes"];
      const sA = elegirSimpleEnDia(curso, diaA, docenteId);
      const sB = elegirSimpleEnDia(curso, diaB, docenteId);
      if (sA && sB) return mkGen(sA.franjaId, sA.salonId, [sB.franjaId]);
      const s = sA ?? sB;
      return s ? mkGen(s.franjaId, s.salonId) : null;
    }

    // ── 3 períodos ────────────────────────────────────────────
    if (nPer === 3) {
      const s3 = elegirSlotLabContiguo(curso, 3, undefined, docenteId);
      if (s3 && s3.franjasExtra.length === 2) {
        return mkGen(s3.franjaId, s3.salonId, s3.franjasExtra);
      }
      const [diaA, diaB]: ["martes"|"jueves","martes"|"jueves"] =
        Math.random() < 0.5 ? ["martes","jueves"] : ["jueves","martes"];
      const slot2A = elegirSlotLabContiguo(curso, 2, diaA, docenteId);
      if (slot2A) {
        const slot1B = elegirSimpleEnDia(curso, diaB, docenteId);
        if (slot1B) return mkGen(slot2A.franjaId, slot2A.salonId, [...slot2A.franjasExtra, slot1B.franjaId]);
      }
      const slot2B = elegirSlotLabContiguo(curso, 2, diaB, docenteId);
      if (slot2B) {
        const slot1A = elegirSimpleEnDia(curso, diaA, docenteId);
        if (slot1A) return mkGen(slot2B.franjaId, slot2B.salonId, [...slot2B.franjasExtra, slot1A.franjaId]);
      }
      const sA = elegirSimpleEnDia(curso, diaA, docenteId);
      const sB = elegirSimpleEnDia(curso, diaB, docenteId);
      const sC = elegirSimpleEnDia(curso, Math.random() < 0.5 ? diaA : diaB, docenteId);
      const anchors = [sA, sB, sC].filter(Boolean) as Array<{franjaId:string; salonId:string|null}>;
      if (anchors.length > 0) {
        return mkGen(anchors[0].franjaId, anchors[0].salonId,
          anchors.slice(1).map(a => a.franjaId));
      }
      return null;
    }

    // ── > 3 períodos: intento contiguos, si no, simples ───────
    const sN = elegirSlotLabContiguo(curso, nPer, undefined, docenteId);
    if (sN) return mkGen(sN.franjaId, sN.salonId, sN.franjasExtra);
    const sSimple = elegirFranjaSalonLibre(curso, "laboratorio", docenteId);
    return sSimple ? mkGen(sSimple.franjaId, sSimple.salonId) : null;
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
    dId?: string | null,
  ): string | null {
    let franjasDisp = franjasDisponiblesParaCurso(curso, ctx.franjas, tipoSesion);
    franjasDisp = filtrarFranjasPorDocente(franjasDisp, dId ?? null);
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
          let salonesDisp = salonesDisponiblesParaCurso(curso, "teoria", ctx.salones);
          salonesDisp = filtrarSalonesPorDocente(salonesDisp, docenteId);
          const salonesShuf = salonesDisp.slice().sort(() => Math.random() - 0.5);
          // Preferir salón que tenga al menos 1 franja libre disponible
          for (const salon of salonesShuf) {
            let franjasDisp = franjasDisponiblesParaCurso(curso, ctx.franjas, "teoria");
            franjasDisp = filtrarFranjasPorDocente(franjasDisp, docenteId);
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
            ? elegirFranjaLibreParaSalon(curso, "teoria", teoriaSalonId, docenteId)
            : (filtrarFranjasPorDocente(franjasDisponiblesParaCurso(curso, ctx.franjas, "teoria"), docenteId)[0]?.id ?? null);
          if (franjaId) {
            teoriaGens.push({
              cursoId: curso.id, seccion, docenteId,
              salonId: curso.sinSalon ? null : teoriaSalonId,
              franjaId, tipoSesion: "teoria",
            });
          }
        }
      }

      // ── Gen de laboratorio: siempre 1 gen con franjasExtra ──
      const labGens: Gen[] = [];
      if (curso.tieneLabatorio) {
        const genLab = elegirGenLab(curso, docenteId, seccion);
        if (genLab) labGens.push(genLab);
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