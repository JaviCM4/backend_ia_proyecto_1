// ============================================================
// GaJobManager.ts
// Gestiona jobs del GA en background.
// El controller lanza el job y devuelve el jobId de inmediato.
// El cliente hace polling a GET /estado/:jobId para ver el progreso.
// ============================================================

import { randomUUID } from 'crypto';
import type { ResultadoGeneracion, ResultadoEjecucion } from '../types/Genetic.types';
import { ejecutarHorarioGA, type OpcionesEjecucion } from '../services/GaService';

// ─────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────

export type EstadoJob = 'pendiente' | 'corriendo' | 'completado' | 'error';

export interface JobGA {
  jobId: string;
  estado: EstadoJob;
  iniciadoEn: Date;
  finalizadoEn?: Date;
  /** Historial de generaciones emitidas en tiempo real */
  historialTiempoReal: ResultadoGeneracion[];
  /** Resultado completo al terminar */
  resultado?: ResultadoEjecucion & { solucionId?: number };
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// STORE EN MEMORIA
// Para producción considera Redis o una tabla de Jobs en la BD.
// ─────────────────────────────────────────────────────────────

const jobs = new Map<string, JobGA>();

/** Limpia jobs viejos (más de 1 hora) para evitar fugas de memoria. */
function limpiarJobsViejos() {
  const unaHoraAtras = Date.now() - 60 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.iniciadoEn.getTime() < unaHoraAtras) {
      jobs.delete(id);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// API PÚBLICA
// ─────────────────────────────────────────────────────────────

/**
 * Lanza el GA en background y devuelve el jobId de inmediato.
 * No espera a que el GA termine — eso sería el problema original.
 */
export function iniciarJob(opciones: OpcionesEjecucion = {}): string {
  limpiarJobsViejos();

  const jobId = randomUUID();

  const job: JobGA = {
    jobId,
    estado: 'pendiente',
    iniciadoEn: new Date(),
    historialTiempoReal: [],
  };
  jobs.set(jobId, job);

  // Lanzar el GA de forma asíncrona — sin await
  setImmediate(() => {
    job.estado = 'corriendo';

    ejecutarHorarioGA({
      ...opciones,
      onGeneracion: (stats) => {
        job.historialTiempoReal.push(stats);
        // Mantener sólo las últimas 200 generaciones en memoria
        if (job.historialTiempoReal.length > 200) {
          job.historialTiempoReal.shift();
        }
      },
    })
      .then((resultado) => {
        job.estado = 'completado';
        job.resultado = resultado;
        job.finalizadoEn = new Date();
      })
      .catch((err: unknown) => {
        job.estado = 'error';
        job.error = err instanceof Error ? err.message : String(err);
        job.finalizadoEn = new Date();
      });
  });

  return jobId;
}

/**
 * Devuelve el estado actual de un job.
 * Retorna null si el jobId no existe (o ya fue limpiado).
 */
export function estadoJob(jobId: string): JobGA | null {
  return jobs.get(jobId) ?? null;
}

/**
 * Cancela un job. En esta implementación solo marca el estado;
 * el GA seguirá corriendo hasta terminar su generación actual.
 * Para cancelación real necesitarías un AbortController en el GA.
 */
export function cancelarJob(jobId: string): boolean {
  const job = jobs.get(jobId);
  if (!job || job.estado === 'completado' || job.estado === 'error') {
    return false;
  }
  job.estado = 'error';
  job.error = 'Cancelado por el usuario';
  job.finalizadoEn = new Date();
  return true;
}