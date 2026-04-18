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
    | "docente_doble"            // docente en dos cursos a la vez
    | "salon_doble"              // salón ocupado dos veces a la misma hora
    | "semestre_traslape"        // mismo semestre/carrera a la misma hora (obligatorio)
    | "docente_fuera_horario"    // docente asignado fuera de su horario contratado
    | "salon_jornada"            // salón usado en jornada no permitida
    | "curso_jornada"            // curso asignado en jornada no permitida
    | "docente_no_asignado"      // docente no tiene asignación para ese curso
    | "salon_incorrecto"         // salón distinto al fijo definido para el curso
    | "lab_periodos_no_contiguos"; // períodos de lab no son contiguos ni en días M/J correctos
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

    // Obtener el curso UNA vez por gen (disponible en todo el bloque)
    const curso = ctx.indiceCursos.get(gen.cursoId);

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
    } // fin for franjaIds

    // ── 5. Docente no habilitado para el curso ──────────────────────
    // (evaluado 1 vez por gen, no por franja)
    if (gen.docenteId && curso) {
      const docentesHabilitados = ctx.mapaCursoDocentes.get(gen.cursoId) ?? [];
      if (docentesHabilitados.length > 0 && !docentesHabilitados.includes(gen.docenteId)) {
        const docente = ctx.indiceDocentes.get(gen.docenteId);
        conflictos.push({
          tipo: "docente_no_asignado",
          descripcion: `Docente ${docente?.nombre ?? gen.docenteId} no tiene asignación para el curso ${curso.nombre}`,
          genesInvolucrados: [i],
        });
      }
    }

    // ── 6. Salón incorrecto (curso tiene salón fijo) ────────────────
    if (gen.salonId && curso?.salonFijo && gen.salonId !== curso.salonFijo) {
      const salon = ctx.indiceSalones.get(gen.salonId);
      const salonFijo = ctx.indiceSalones.get(curso.salonFijo);
      conflictos.push({
        tipo: "salon_incorrecto",
        descripcion: `Curso ${curso.nombre} debe estar en salón ${salonFijo?.nombre ?? curso.salonFijo} pero está en ${salon?.nombre ?? gen.salonId}`,
        genesInvolucrados: [i],
      });
    }
  } // fin for genes

  // ── 7. Períodos de lab no contiguos ──────────────────────────────
  // Agrupa genes de lab por (cursoId|seccion) y verifica que los
  // noPeriodosLab períodos queden juntos (mismo día M o J).
  {
    const labPorSeccion = new Map<string, { gens: Gen[]; idxs: number[] }>();
    for (let i = 0; i < genes.length; i++) {
      const gen = genes[i];
      if (gen.tipoSesion !== 'laboratorio') continue;
      const k = `${gen.cursoId}|${gen.seccion}`;
      let entry = labPorSeccion.get(k);
      if (!entry) { entry = { gens: [], idxs: [] }; labPorSeccion.set(k, entry); }
      entry.gens.push(gen); entry.idxs.push(i);
    }
    for (const [, { gens: labGens, idxs }] of labPorSeccion) {
      if (labGens.length <= 1) continue;
      const curso = ctx.indiceCursos.get(labGens[0].cursoId);
      if (!curso) continue;
      const esperados = curso.noPeriodosLab ?? 2;
      if (labGens.length !== esperados) continue; // conteo ya se verifica en repararCromosoma

      const franjas = labGens
        .map(g => ctx.indiceFranjas.get(g.franjaId))
        .filter(Boolean) as import('../types/Domain.types').FranjaHoraria[];
      const dias = new Set(franjas.map(f => f.dia));

      // Conflicto si mezcla días que no son M/J
      const diasInvalidos = [...dias].filter(d => d !== 'martes' && d !== 'jueves');
      if (diasInvalidos.length > 0) {
        conflictos.push({
          tipo: 'lab_periodos_no_contiguos',
          descripcion: `Lab ${curso.nombre} sección ${labGens[0].seccion} tiene períodos en día incorrecto: ${diasInvalidos.join(', ')}`,
          genesInvolucrados: [idxs[0]],
        });
        continue;
      }

      // Si todos en mismo día, verificar que sean contiguos
      if (dias.size === 1) {
        const ordenadas = franjas.slice().sort((a, b) =>
          a.horaInicio.localeCompare(b.horaInicio));
        let contiguos = true;
        for (let i = 0; i < ordenadas.length - 1; i++) {
          if (ordenadas[i].horaFin !== ordenadas[i + 1].horaInicio) {
            contiguos = false; break;
          }
        }
        if (!contiguos) {
          conflictos.push({
            tipo: 'lab_periodos_no_contiguos',
            descripcion: `Lab ${curso.nombre} sección ${labGens[0].seccion} tiene ${esperados} períodos en el mismo día pero no son contiguos`,
            genesInvolucrados: [idxs[0]],
          });
        }
      }
      // Si está en 2 días (M+J) con nPer=3: validar que al menos un día tiene 2 contiguos
      else if (dias.size === 2 && esperados === 3) {
        const porDia = new Map<string, typeof franjas>();
        for (const f of franjas) {
          let arr = porDia.get(f.dia); if (!arr) { arr = []; porDia.set(f.dia, arr); } arr.push(f);
        }
        let tieneContiguo = false;
        for (const [, fsDia] of porDia) {
          if (fsDia.length >= 2) {
            const ord = fsDia.slice().sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
            if (ord[0].horaFin === ord[1].horaInicio) { tieneContiguo = true; break; }
          }
        }
        if (!tieneContiguo) {
          conflictos.push({
            tipo: 'lab_periodos_no_contiguos',
            descripcion: `Lab ${curso.nombre} sección ${labGens[0].seccion} split M/J pero ningún par es contiguo`,
            genesInvolucrados: [idxs[0]],
          });
        }
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