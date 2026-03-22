// ============================================================
// utils/timeUtils.ts
// Generación de franjas horarias y utilidades de tiempo
// ============================================================

import type { FranjaHoraria, DiaSemana, Jornada, ConfiguracionHorario } from "../types/Domain.types";

/**
 * Convierte "07:00" → minutos desde medianoche (420)
 */
export function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Convierte minutos desde medianoche → "07:00"
 */
export function minutosAHora(minutos: number): string {
  const h = Math.floor(minutos / 60).toString().padStart(2, "0");
  const m = (minutos % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Determina si una hora pertenece a mañana o tarde según la config.
 */
export function determinarJornada(
  hora: string,
  config: ConfiguracionHorario
): Jornada {
  const min = horaAMinutos(hora);
  const inicioTarde = horaAMinutos(config.horaInicioTarde);
  return min >= inicioTarde ? "tarde" : "manana";
}

/**
 * Genera TODAS las franjas horarias posibles según la configuración.
 * Una franja = un bloque de `duracionPeriodoMinutos` en un día.
 *
 * Ejemplo con 50 min, 07:00–13:00 mañana y 13:40–21:10 tarde:
 *   lunes-07:00, lunes-07:50, lunes-08:40, ...
 */
export function generarFranjas(config: ConfiguracionHorario): FranjaHoraria[] {
  const franjas: FranjaHoraria[] = [];
  const duracion = config.duracionPeriodoMinutos;

  for (const dia of config.diasActivos) {
    // Jornada mañana
    let cursor = horaAMinutos(config.horaInicioManana);
    const finManana = horaAMinutos(config.horaFinManana);
    while (cursor + duracion <= finManana) {
      const inicio = minutosAHora(cursor);
      const fin = minutosAHora(cursor + duracion);
      franjas.push({
        id: `${dia}-${inicio}`,
        dia,
        horaInicio: inicio,
        horaFin: fin,
        jornada: "manana",
      });
      cursor += duracion;
    }

    // Jornada tarde
    cursor = horaAMinutos(config.horaInicioTarde);
    const finTarde = horaAMinutos(config.horaFinTarde);
    while (cursor + duracion <= finTarde) {
      const inicio = minutosAHora(cursor);
      const fin = minutosAHora(cursor + duracion);
      franjas.push({
        id: `${dia}-${inicio}`,
        dia,
        horaInicio: inicio,
        horaFin: fin,
        jornada: "tarde",
      });
      cursor += duracion;
    }
  }

  return franjas;
}

/**
 * Dado un array de franjas y una franja base, devuelve las N siguientes
 * contiguas del mismo día (para laboratorios de 2–3 periodos).
 */
export function obtenerFranjasContiguas(
  franjaBaseId: string,
  cantidad: number,
  todasLasFranjas: FranjaHoraria[]
): FranjaHoraria[] | null {
  const base = todasLasFranjas.find((f) => f.id === franjaBaseId);
  if (!base) return null;

  const result: FranjaHoraria[] = [base];
  const delDia = todasLasFranjas
    .filter((f) => f.dia === base.dia)
    .sort((a, b) => horaAMinutos(a.horaInicio) - horaAMinutos(b.horaInicio));

  const idxBase = delDia.findIndex((f) => f.id === franjaBaseId);
  for (let i = 1; i < cantidad; i++) {
    const siguiente = delDia[idxBase + i];
    if (!siguiente) return null; // no hay suficientes franjas contiguas
    result.push(siguiente);
  }
  return result;
}

/**
 * Verifica si una franja está dentro del horario contratado de un docente.
 */
export function franjaEnHorarioDocente(
  franja: FranjaHoraria,
  horaEntrada: string,
  horaSalida: string
): boolean {
  const inicio = horaAMinutos(franja.horaInicio);
  const fin = horaAMinutos(franja.horaFin);
  const entrada = horaAMinutos(horaEntrada);
  const salida = horaAMinutos(horaSalida);
  return inicio >= entrada && fin <= salida;
}

/**
 * Verifica si dos franjas se solapan (misma hora en el mismo día).
 */
export function franjasSeSolapan(a: FranjaHoraria, b: FranjaHoraria): boolean {
  if (a.dia !== b.dia) return false;
  const aInicio = horaAMinutos(a.horaInicio);
  const aFin = horaAMinutos(a.horaFin);
  const bInicio = horaAMinutos(b.horaInicio);
  const bFin = horaAMinutos(b.horaFin);
  return aInicio < bFin && bInicio < aFin;
}

/**
 * Retorna el índice de una franja dentro del día (para calcular continuidad).
 */
export function indiceFranjaEnDia(
  franjaId: string,
  todasLasFranjas: FranjaHoraria[]
): number {
  const franja = todasLasFranjas.find((f) => f.id === franjaId);
  if (!franja) return -1;
  const delDia = todasLasFranjas
    .filter((f) => f.dia === franja.dia)
    .sort((a, b) => horaAMinutos(a.horaInicio) - horaAMinutos(b.horaInicio));
  return delDia.findIndex((f) => f.id === franjaId);
}