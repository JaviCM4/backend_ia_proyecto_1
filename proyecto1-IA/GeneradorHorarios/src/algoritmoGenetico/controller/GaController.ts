// ============================================================
// GaController.ts
// ============================================================

import { Request, Response } from 'express';
import { iniciarJob, estadoJob, cancelarJob } from './Gajobmanager';
import { ejecutarHorarioGA, ultimaSolucion, obtenerSolucionPorId } from '../services/GaService';


export const ejecutarGa = async (req: Request, res: Response) => {
    try {
        const resultado = await ejecutarHorarioGA({
            configGA: req.body.configGA,
            configHorario: req.body.configHorario,
            guardarEnBD: true,
            //onGeneracion: (stats) => io.emit('generacion', stats),
        });

        res.json({ solucionId: resultado.solucionId, ...resultado });
    } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Error desconocido' });
    }

}

/**
 * POST /ejecutar
 * Lanza el GA en background y responde de inmediato con { jobId }.
 * El cliente usará ese jobId para hacer polling a GET /estado/:jobId.
 */
export const ejecutar = (req: Request, res: Response) => {
  try {
    const jobId = iniciarJob({
      configGA: req.body.configGA,
      configHorario: req.body.configHorario,
      guardarEnBD: true,
    });

    res.status(202).json({ jobId });
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
};

/**
 * GET /estado/:jobId
 * Devuelve el estado actual del job.
 *
 * Respuesta mientras corre:
 *   { jobId, estado: 'corriendo', generacionActual, mejorFitness, historialTiempoReal }
 *
 * Respuesta al completar:
 *   { jobId, estado: 'completado', resultado: { solucionId, ... } }
 *
 * Respuesta en error:
 *   { jobId, estado: 'error', error: '...' }
 */
export const obtenerEstado = (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = estadoJob(jobId.toString());

  if (!job) {
    res.status(404).json({ error: 'Job no encontrado o expirado' });
    return;
  }

  const ultimaGeneracion =
    job.historialTiempoReal[job.historialTiempoReal.length - 1];

  res.json({
    jobId: job.jobId,
    estado: job.estado,
    iniciadoEn: job.iniciadoEn,
    finalizadoEn: job.finalizadoEn,
    // Progreso en tiempo real (sólo útil mientras estado === 'corriendo')
    generacionActual: ultimaGeneracion?.generacion ?? 0,
    mejorFitness: ultimaGeneracion?.mejorFitness ?? null,
    fitnesPromedio: ultimaGeneracion?.fitnesPromedio ?? null,
    conflictos: ultimaGeneracion?.conflictos ?? null,
    // Historial completo (últimas 200 generaciones) para la gráfica
    historialTiempoReal: job.historialTiempoReal,
    // Resultado final (sólo cuando estado === 'completado')
    resultado:
      job.estado === 'completado'
        ? {
            solucionId: job.resultado?.solucionId,
            generacionesEjecutadas: job.resultado?.generacionesEjecutadas,
            tiempoEjecucionMs: job.resultado?.tiempoEjecucionMs,
            porcentajeCursosContinuos: job.resultado?.porcentajeCursosContinuos,
            listaConflictos: job.resultado?.listaConflictos,
            mejorFitness: job.resultado?.mejorCromosoma.fitness,
          }
        : null,
    error: job.error ?? null,
  });
};

/**
 * DELETE /cancelar/:jobId
 * Marca el job como cancelado.
 */
export const cancelar = (req: Request, res: Response) => {
  const { jobId } = req.params;
  const cancelado = cancelarJob(jobId.toString());

  if (!cancelado) {
    res.status(404).json({ error: 'Job no encontrado, ya terminó, o ya fue cancelado' });
    return;
  }

  res.json({ jobId, cancelado: true });
};

export const obtenerUltimaSolucion = async (req: Request, res: Response) => {
    try {
        const resultado = await ultimaSolucion();
        res.json(resultado);
    } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Error desconocido' });
    }
}

export const solucionPorId = async (req: Request, res: Response) => {
    const { id } = req.params;
    try {
        const resultado = await obtenerSolucionPorId(parseInt(id.toString()));
        if (!resultado) {
            res.status(404).json({ error: 'Solución no encontrada' });
            return;
        }
        res.json(resultado);
    } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Error desconocido' });
    }
}
  