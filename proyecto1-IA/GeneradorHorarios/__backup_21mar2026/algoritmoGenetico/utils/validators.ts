// ============================================================
// utils/validators.ts
// Funciones de validación de conflictos para un horario.
// Usadas tanto por el fitness como por la edición manual.
// ============================================================

import type { Gen } from "../types/Genetic.types";
import type { ContextoGA } from "../types/Genetic.types";
import { franjasSeSolapan, franjaEnHorarioDocente } from "../utils/timeUtil";

function claveDiaPersistencia(
  dia: string,
  tipoSesion: "teoria" | "laboratorio"
): "LXV" | "M" | "J" {
  if (tipoSesion === "teoria") return "LXV";
  if (dia === "martes") return "M";
  if (dia === "jueves") return "J";
  return "M";
}

export interface Conflicto {
  tipo:
    | "docente_doble"        // docente en dos cursos a la vez
    | "salon_doble"          // salón ocupado dos veces a la misma hora
    | "semestre_traslape"    // mismo semestre/carrera a la misma hora (obligatorio)
    | "docente_fuera_horario"// docente asignado fuera de su horario contratado
    | "salon_jornada"        // salón usado en jornada no permitida
    | "curso_jornada";       // curso asignado en jornada no permitida
  descripcion: string;
  genesInvolucrados: [number, number] | [number]; // índices en el cromosoma
}

/**
 * Detecta TODOS los conflictos en un arreglo de genes.
 * Retorna la lista completa de conflictos encontrados.
 */
export function detectarConflictos(
  genes: Gen[],
  ctx: ContextoGA
): Conflicto[] {
  const conflictos: Conflicto[] = [];

  // Mapas auxiliares para detección rápida O(n) en vez de O(n²) naive
  // docente+franja → índice del gen que ya usa esa combinación
  const ocupacionDocente = new Map<string, number>();
  // salon+franja → índice
  const ocupacionSalon = new Map<string, number>();
  // semestre+carrera+franja → índice (solo obligatorios, una sección)
  const ocupacionSemestre = new Map<string, number>();

  for (let i = 0; i < genes.length; i++) {
    const gen = genes[i];
    if (!ctx.indiceFranjas.has(gen.franjaId)) continue;

    // Todas las franjas que ocupa este gen (incluye laboratorios multi-periodo)
    const franjaIds = [gen.franjaId, ...(gen.franjasExtra ?? [])];

    for (const fid of franjaIds) {
      const f = ctx.indiceFranjas.get(fid);
      if (!f) continue;
      //const bloquePersistido = `${claveDiaPersistencia(f.dia, gen.tipoSesion)}|${f.horaInicio}`;
      const grupoDia =
        gen.tipoSesion === 'teoria'
          ? 'LXV'
          : f.dia === 'martes' ? 'M' : 'J';
      const bloquePersistido = `${grupoDia}|${f.horaInicio}`;

      // ── 1. Conflicto: docente doble ────────────────────────────────
      if (gen.docenteId) {
        const claveDocente = `${gen.docenteId}|${bloquePersistido}`;
        if (ocupacionDocente.has(claveDocente)) {
          const otro = ocupacionDocente.get(claveDocente)!;
          conflictos.push({
            tipo: "docente_doble",
            descripcion: `Docente ${gen.docenteId} tiene dos cursos en franja ${fid}`,
            genesInvolucrados: [otro, i],
          });
        } else {
          ocupacionDocente.set(claveDocente, i);
        }

        // ── 1b. Docente fuera de su horario contratado ─────────────
        const docente = ctx.indiceDocentes.get(gen.docenteId);
        if (docente && !franjaEnHorarioDocente(f, docente.horaEntrada, docente.horaSalida)) {
          conflictos.push({
            tipo: "docente_fuera_horario",
            descripcion: `Docente ${docente.nombre} asignado fuera de su contrato en franja ${fid}`,
            genesInvolucrados: [i],
          });
        }
      }

      // ── 2. Conflicto: salón doble ──────────────────────────────────
      if (gen.salonId) {
        const claveSalon = `${gen.salonId}|${bloquePersistido}`;
        if (ocupacionSalon.has(claveSalon)) {
          const otro = ocupacionSalon.get(claveSalon)!;
          conflictos.push({
            tipo: "salon_doble",
            descripcion: `Salón ${gen.salonId} usado dos veces en franja ${fid}`,
            genesInvolucrados: [otro, i],
          });
        } else {
          ocupacionSalon.set(claveSalon, i);
        }

        // ── 2b. Salón en jornada no permitida ──────────────────────
        const salon = ctx.indiceSalones.get(gen.salonId);
        if (salon && salon.jornada !== "ambas" && salon.jornada !== f.jornada) {
          conflictos.push({
            tipo: "salon_jornada",
            descripcion: `Salón ${salon.nombre} no está habilitado para la jornada ${f.jornada}`,
            genesInvolucrados: [i],
          });
        }

        // ── 2c. Laboratorio en curso teórico sin permiso ───────────
        if (salon?.esLaboratorio && gen.tipoSesion === "teoria" && !salon.habilitadoParaTeoría) {
          conflictos.push({
            tipo: "salon_jornada",
            descripcion: `Salón laboratorio ${salon.nombre} no está habilitado para clases teóricas`,
            genesInvolucrados: [i],
          });
        }
      }

      // ── 3. Conflicto: mismo semestre/carrera (obligatorios) ────────
      const curso = ctx.indiceCursos.get(gen.cursoId);
      if (curso && curso.tipo === "obligatorio") {
        const claveSemestre = `${curso.carrera}|${curso.semestre}|${bloquePersistido}`;
        if (ocupacionSemestre.has(claveSemestre)) {
          // Solo es conflicto si NO son secciones distintas del mismo curso
          const otroIdx = ocupacionSemestre.get(claveSemestre)!;
          const otroGen = genes[otroIdx];
          const mismoCurso = otroGen.cursoId === gen.cursoId;
          if (!mismoCurso) {
            conflictos.push({
              tipo: "semestre_traslape",
              descripcion: `Cursos obligatorios del semestre ${curso.semestre} (${curso.carrera}) se solapan en franja ${fid}`,
              genesInvolucrados: [otroIdx, i],
            });
          }
        } else {
          ocupacionSemestre.set(claveSemestre, i);
        }
      }

      // ── 4. Conflicto: curso en jornada no permitida ────────────────
      if (curso && curso.jornada !== "ambas" && curso.jornada !== f.jornada) {
        conflictos.push({
          tipo: "curso_jornada",
          descripcion: `Curso ${curso.nombre} asignado en jornada ${f.jornada} pero solo permite ${curso.jornada}`,
          genesInvolucrados: [i],
        });
      }
    }
  }

  return conflictos;
}

/**
 * Retorna true si el cromosoma no tiene ningún conflicto.
 */
export function esValido(genes: Gen[], ctx: ContextoGA): boolean {
  return detectarConflictos(genes, ctx).length === 0;
}