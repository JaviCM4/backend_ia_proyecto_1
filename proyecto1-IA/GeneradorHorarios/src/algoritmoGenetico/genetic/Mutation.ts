// ============================================================
// genetic/mutation.ts
// Métodos de mutación.
//
// Implementados:
//   1. Intercambio (swap)     — intercambia asignaciones entre dos genes
//   2. Random Resetting       — reemplaza los valores de un gen aleatoriamente
//
// La mutación mantiene la integridad del gen:
//   cursoId y tipoSesion NUNCA cambian.
//   Solo mutan: docenteId, salonId, franjaId.
// ============================================================

import type { Cromosoma, Gen, ContextoGA } from "../types/Genetic.types";
import type { Salon, FranjaHoraria } from "../../algoritmoGenetico/types/Domain.types";

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function elegirAleatorio<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function indiceAleatorio(max: number): number {
  return Math.floor(Math.random() * max);
}

const DIA_REPRESENTATIVO_LXV = "lunes";

/**
 * Genera un nuevo valor aleatorio para un gen respetando
 * las restricciones de jornada, tipo de sesión y fijaciones.
 */
function regenerarGen(gen: Gen, ctx: ContextoGA): Gen {
  const curso = ctx.indiceCursos.get(gen.cursoId);
  if (!curso) return gen;

  // Docente ─────────────────────────────────────────────────
  let docenteId: string | null = gen.docenteId; // mantener si está fijo
  if (!curso.docenteFijo && !curso.sinSalon) {
    const posibles = ctx.mapaCursoDocentes.get(curso.id) ?? [];
    const activos = posibles.filter((id) => ctx.docentesActivos.has(id));
    if (activos.length > 0) {
      docenteId = elegirAleatorio(activos);
    }
  }

  // Salón ───────────────────────────────────────────────────
  let salonId: string | null = gen.salonId;
  if (!curso.salonFijo && !curso.sinSalon) {
    let salonesValidos: Salon[] = ctx.salones.filter((s) => {
      if (!s.activo) return false;
      if (gen.tipoSesion === "laboratorio") return s.esLaboratorio;
      return !s.esLaboratorio || s.habilitadoParaTeoría;
    });
    // Filtrar por jornada del docente (evita salon_jornada)
    if (docenteId) {
      const d = ctx.indiceDocentes.get(docenteId);
      if (d) {
        const jornada = d.horaEntrada >= "13:40" ? "tarde" : d.horaSalida <= "13:00" ? "manana" : "ambas";
        if (jornada !== "ambas") {
          const filt = salonesValidos.filter(s => s.jornada === jornada || s.jornada === "ambas");
          if (filt.length > 0) salonesValidos = filt;
        }
      }
    }
    if (salonesValidos.length > 0) {
      salonId = elegirAleatorio(salonesValidos).id;
    }
  }

  // Franja ──────────────────────────────────────────────────
  let franjaId: string = gen.franjaId;

  if (!curso.franjaFija) {
    let disponibles: FranjaHoraria[] = ctx.franjas.filter((f) => {
      if (gen.tipoSesion === "teoria" && f.dia !== DIA_REPRESENTATIVO_LXV) return false;
      if (gen.tipoSesion === "laboratorio" && f.dia !== "martes" && f.dia !== "jueves") return false;
      if (curso.jornada === "manana" && f.jornada !== "manana") return false;
      if (curso.jornada === "tarde"  && f.jornada !== "tarde")  return false;
      return true;
    });
    // Filtrar por horario contractual del docente (evita docente_fuera_horario)
    if (docenteId) {
      const d = ctx.indiceDocentes.get(docenteId);
      if (d) {
        const filt = disponibles.filter(f => f.horaInicio >= d.horaEntrada && f.horaFin <= d.horaSalida);
        if (filt.length > 0) disponibles = filt;
      }
    }

    // Cada gen (incluidos labs) tiene una sola franja asignada.
    // Los períodos de lab son genes separados — no se necesita franjasExtra.
    if (disponibles.length > 0) {
      franjaId = elegirAleatorio(disponibles).id;
    }
  }

  return { ...gen, docenteId, salonId, franjaId, franjasExtra: undefined };
}

// ─────────────────────────────────────────────────────────────
// SINCRONIZACIÓN DE SECCIÓN
// Garantiza que todos los genes de la misma (cursoId|seccion)
// tengan el mismo docente. O(n) con un solo Map.
// NB: no sincroniza salón—teoría y lab usan aulas distintas.
// ─────────────────────────────────────────────────────────────

function sincronizarSecciones(genes: Gen[]): void {
  // Paso 1: encontrar docente representativo por sección
  const docentePorSeccion = new Map<string, string | null>();
  for (const gen of genes) {
    const k = `${gen.cursoId}|${gen.seccion}`;
    if (!docentePorSeccion.has(k)) {
      docentePorSeccion.set(k, gen.docenteId);
    } else if (docentePorSeccion.get(k) === null && gen.docenteId !== null) {
      // Actualizar si antes era null y ahora encontramos uno no-null
      docentePorSeccion.set(k, gen.docenteId);
    }
  }
  // Paso 2: aplicar a todos los genes de la sección
  for (const gen of genes) {
    const k = `${gen.cursoId}|${gen.seccion}`;
    gen.docenteId = docentePorSeccion.get(k) ?? null;
  }
}

// ─────────────────────────────────────────────────────────────
// MÉTODO 1: INTERCAMBIO (Swap Mutation)
//
// Elige dos genes al azar y les intercambia docenteId, salonId
// y franjaId. Es especialmente útil para resolver conflictos de
// docente-doble o salón-doble redistribuyendo asignaciones.
// ─────────────────────────────────────────────────────────────

export function mutacionIntercambio(cromosoma: Cromosoma): Cromosoma {
  const genes = cromosoma.genes.map((g) => ({ ...g }));
  if (genes.length < 2) return { ...cromosoma, genes };

  const i = indiceAleatorio(genes.length);
  let j = indiceAleatorio(genes.length);
  while (j === i) j = indiceAleatorio(genes.length);

  // Intercambiar solo valores de asignación, no la identidad del gen
  const tmpDocente = genes[i].docenteId;
  const tmpSalon = genes[i].salonId;
  const tmpFranja = genes[i].franjaId;

  genes[i].docenteId = genes[j].docenteId;
  genes[i].salonId = genes[j].salonId;
  genes[i].franjaId = genes[j].franjaId;

  genes[j].docenteId = tmpDocente;
  genes[j].salonId = tmpSalon;
  genes[j].franjaId = tmpFranja;

  // Propagar docente a todos los gens de las secciones afectadas
  sincronizarSecciones(genes);

  return { ...cromosoma, genes };
}

// ─────────────────────────────────────────────────────────────
// MÉTODO 2: RANDOM RESETTING
//
// Elige uno o más genes al azar y les asigna valores totalmente
// nuevos respetando las restricciones. Favorece la exploración
// cuando la población converge prematuramente.
// ─────────────────────────────────────────────────────────────

export function mutacionRandomResetting(
  cromosoma: Cromosoma,
  ctx: ContextoGA,
  fraccion: number = 0.05  // qué fracción de genes mutar (5% por defecto)
): Cromosoma {
  const genes = cromosoma.genes.map((g) => ({ ...g }));
  const cantidad = Math.max(1, Math.round(genes.length * fraccion));

  // Elegir índices únicos al azar
  const indices = new Set<number>();
  while (indices.size < Math.min(cantidad, genes.length)) {
    indices.add(indiceAleatorio(genes.length));
  }

  for (const idx of indices) {
    genes[idx] = regenerarGen(genes[idx], ctx);
  }

  // Propagar docente a todos los gens de las secciones modificadas
  sincronizarSecciones(genes);

  return { ...cromosoma, genes };
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN UNIFICADA
// ─────────────────────────────────────────────────────────────

export function mutar(
  cromosoma: Cromosoma,
  metodo: "intercambio" | "random_resetting",
  tasaMutacion: number,
  ctx: ContextoGA
): Cromosoma {
  if (Math.random() > tasaMutacion) return cromosoma;

  switch (metodo) {
    case "intercambio":
      return mutacionIntercambio(cromosoma);
    case "random_resetting":
      return mutacionRandomResetting(cromosoma, ctx);
    default:
      return mutacionIntercambio(cromosoma);
  }
}