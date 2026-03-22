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
import { obtenerFranjasContiguas } from "../../algoritmoGenetico/utils/timeUtil";

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
    const salonesValidos: Salon[] = ctx.salones.filter((s) => {
      if (!s.activo) return false;
      if (gen.tipoSesion === "laboratorio") return s.esLaboratorio;
      return !s.esLaboratorio || s.habilitadoParaTeoría;
    });
    if (salonesValidos.length > 0) {
      salonId = elegirAleatorio(salonesValidos).id;
    }
  }

  // Franja ──────────────────────────────────────────────────
  let franjaId: string = gen.franjaId;
  let franjasExtra: string[] | undefined = gen.franjasExtra;

  if (!curso.franjaFija) {
    const disponibles: FranjaHoraria[] = ctx.franjas.filter((f) => {
      if (gen.tipoSesion === "teoria" && f.dia !== DIA_REPRESENTATIVO_LXV) return false;
      if (gen.tipoSesion === "laboratorio" && f.dia !== "martes" && f.dia !== "jueves") return false;
      if (curso.jornada === "manana" && f.jornada !== "manana") return false;
      if (curso.jornada === "tarde"  && f.jornada !== "tarde")  return false;
      return true;
    });

    if (disponibles.length > 0) {
      if (gen.tipoSesion === "laboratorio") {
        const noPeriodosLab = curso.noPeriodosLab ?? 2;
        const candidatos = disponibles.slice().sort(() => Math.random() - 0.5);
        let asignado = false;
        for (const f of candidatos) {
          const cn = obtenerFranjasContiguas(f.id, noPeriodosLab, ctx.franjas);
          if (cn && cn.length >= noPeriodosLab) {
            franjaId = cn[0].id;
            franjasExtra = cn.slice(1, noPeriodosLab).map(x => x.id);
            asignado = true;
            break;
          }
        }
        // Fallback: intentar con 2 periodos si no se encontró el número exacto
        if (!asignado) {
          for (const f of candidatos) {
            const c2 = obtenerFranjasContiguas(f.id, 2, ctx.franjas);
            if (c2) { franjaId = c2[0].id; franjasExtra = c2.slice(1).map(x => x.id); asignado = true; break; }
          }
        }
        if (!asignado) { franjaId = elegirAleatorio(disponibles).id; franjasExtra = undefined; }
      } else {
        franjaId = elegirAleatorio(disponibles).id;
        franjasExtra = undefined;
      }
    }
  }

  return { ...gen, docenteId, salonId, franjaId, franjasExtra };
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
  const tmpFranjasExtra = genes[i].franjasExtra;

  genes[i].docenteId = genes[j].docenteId;
  genes[i].salonId = genes[j].salonId;
  genes[i].franjaId = genes[j].franjaId;
  genes[i].franjasExtra = genes[j].franjasExtra;

  genes[j].docenteId = tmpDocente;
  genes[j].salonId = tmpSalon;
  genes[j].franjaId = tmpFranja;
  genes[j].franjasExtra = tmpFranjasExtra;

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