// ============================================================
// genetic/selection.ts
// Métodos de selección de padres.
//
// Implementados:
//   1. Torneo  — recomendado como principal
//   2. Ruleta  — método alternativo
// ============================================================

import type { Cromosoma, Poblacion } from "../types/Genetic.types";

// ─────────────────────────────────────────────────────────────
// MÉTODO 1: SELECCIÓN POR TORNEO
//
// Se eligen K cromosomas al azar de la población y el que tenga
// mayor fitness gana. Es robusto y eficiente.
//
// Ventajas sobre ruleta:
//   - No se distorsiona cuando hay valores de fitness muy dispares
//   - Presión selectiva controlable con el parámetro K
// ─────────────────────────────────────────────────────────────

/**
 * Selecciona UN padre usando torneo de tamaño K.
 */
export function seleccionTorneo(
  poblacion: Poblacion,
  tamaniTorneo: number = 3
): Cromosoma {
  const participantes: Cromosoma[] = [];
  for (let i = 0; i < tamaniTorneo; i++) {
    const idx = Math.floor(Math.random() * poblacion.length);
    participantes.push(poblacion[idx]);
  }
  // Gana el de mayor fitness
  return participantes.reduce((mejor, actual) =>
    actual.fitness > mejor.fitness ? actual : mejor
  );
}

/**
 * Selecciona `cantidad` padres usando torneo.
 * Usado por el engine para obtener todos los padres de una generación.
 */
export function seleccionarPadresTorneo(
  poblacion: Poblacion,
  cantidad: number,
  tamaniTorneo: number = 3
): Cromosoma[] {
  const padres: Cromosoma[] = [];
  for (let i = 0; i < cantidad; i++) {
    padres.push(seleccionTorneo(poblacion, tamaniTorneo));
  }
  return padres;
}

// ─────────────────────────────────────────────────────────────
// MÉTODO 2: SELECCIÓN POR RULETA (Roulette Wheel / Fitness Proportionate)
//
// La probabilidad de selección de cada individuo es proporcional
// a su fitness. Individuos con fitness muy alto dominan la selección.
//
// Nota: si todos tienen fitness 0, se elige aleatoriamente.
// ─────────────────────────────────────────────────────────────

/**
 * Selecciona UN padre usando ruleta proporcional al fitness.
 */
export function seleccionRuleta(poblacion: Poblacion): Cromosoma {
  const totalFitness = poblacion.reduce((sum, c) => sum + c.fitness, 0);

  if (totalFitness === 0) {
    // Si todos tienen fitness 0, selección uniforme
    return poblacion[Math.floor(Math.random() * poblacion.length)];
  }

  let punto = Math.random() * totalFitness;
  for (const cromosoma of poblacion) {
    punto -= cromosoma.fitness;
    if (punto <= 0) return cromosoma;
  }
  // Fallback (por precisión floating point)
  return poblacion[poblacion.length - 1];
}

/**
 * Selecciona `cantidad` padres usando ruleta.
 */
export function seleccionarPadresRuleta(
  poblacion: Poblacion,
  cantidad: number
): Cromosoma[] {
  const padres: Cromosoma[] = [];
  for (let i = 0; i < cantidad; i++) {
    padres.push(seleccionRuleta(poblacion));
  }
  return padres;
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN UNIFICADA
// El engine llama a esta función según el método elegido.
// ─────────────────────────────────────────────────────────────

export function seleccionarPadres(
  poblacion: Poblacion,
  cantidad: number,
  metodo: "torneo" | "ruleta",
  tamaniTorneo: number = 3
): Cromosoma[] {
  if (metodo === "torneo") {
    return seleccionarPadresTorneo(poblacion, cantidad, tamaniTorneo);
  }
  return seleccionarPadresRuleta(poblacion, cantidad);
}