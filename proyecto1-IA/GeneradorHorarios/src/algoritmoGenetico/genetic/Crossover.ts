// ============================================================
// genetic/crossover.ts
// Métodos de cruce (crossover) entre dos cromosomas padres.
//
// Implementados:
//   1. Cruce en un punto   — punto de corte aleatorio
//   2. Cruce multipunto    — dos puntos de corte
//   3. Máscara aleatoria   — gen a gen, de cuál padre heredar
//
// Todos preservan la estructura del cromosoma:
//   - Mismo número de genes
//   - IDs de cursoId y tipoSesion NO se mezclan (posición fija)
//   - Lo que varía: docenteId, salonId, franjaId
// ============================================================

import { v4 as uuidv4 } from "uuid";
import type { Cromosoma, Gen } from "../types/Genetic.types";

// ─────────────────────────────────────────────────────────────
// HELPER: Clonar un gen con valores del padre B en posición i
// ─────────────────────────────────────────────────────────────

/**
 * Crea un nuevo gen tomando la estructura de `base` pero
 * los valores de asignación (docente, salón, franja) de `donante`.
 * Esto garantiza que cursoId y seccion nunca se pierdan.
 */
function combinarGenes(base: Gen, donante: Gen): Gen {
  return {
    ...base,
    docenteId: donante.docenteId,
    salonId: donante.salonId,
    franjaId: donante.franjaId,
    franjasExtra: donante.franjasExtra,
  };
}

// ─────────────────────────────────────────────────────────────
// MÉTODO 1: CRUCE EN UN PUNTO
//
// Se elige un punto de corte aleatorio.
// Hijo1 = [genes de A hasta el corte] + [genes de B desde el corte]
// Hijo2 = [genes de B hasta el corte] + [genes de A desde el corte]
// ─────────────────────────────────────────────────────────────

export function cruceUnPunto(
  padreA: Cromosoma,
  padreB: Cromosoma
): [Cromosoma, Cromosoma] {
  const n = padreA.genes.length;
  const puntoCorte = 1 + Math.floor(Math.random() * (n - 1)); // [1, n-1]

  const genesHijo1: Gen[] = [
    ...padreA.genes.slice(0, puntoCorte),
    ...padreB.genes.slice(puntoCorte).map((g, i) =>
      combinarGenes(padreA.genes[puntoCorte + i], g)
    ),
  ];

  const genesHijo2: Gen[] = [
    ...padreB.genes.slice(0, puntoCorte),
    ...padreA.genes.slice(puntoCorte).map((g, i) =>
      combinarGenes(padreB.genes[puntoCorte + i], g)
    ),
  ];

  return [
    { id: uuidv4(), genes: genesHijo1, fitness: 0 },
    { id: uuidv4(), genes: genesHijo2, fitness: 0 },
  ];
}


// ─────────────────────────────────────────────────────────────
// MÉTODO 2: CRUCE MULTIPUNTO (dos puntos)
//
// Se eligen dos puntos de corte p1 < p2.
// Hijo1 = [A:0..p1] + [B:p1..p2] + [A:p2..n]
// Hijo2 = [B:0..p1] + [A:p1..p2] + [B:p2..n]
// ─────────────────────────────────────────────────────────────

export function cruceMultipunto(
  padreA: Cromosoma,
  padreB: Cromosoma
): [Cromosoma, Cromosoma] {
  const n = padreA.genes.length;

  let p1 = Math.floor(Math.random() * (n - 1));
  let p2 = Math.floor(Math.random() * (n - 1));
  if (p1 > p2) [p1, p2] = [p2, p1];
  if (p1 === p2) p2 = Math.min(p2 + 1, n - 1);

  const buildHijo = (
    principal: Cromosoma,
    alternativo: Cromosoma
  ): Gen[] =>
    principal.genes.map((g, i) => {
      const usarAlternativo = i >= p1 && i < p2;
      return usarAlternativo
        ? combinarGenes(g, alternativo.genes[i])
        : { ...g };
    });

  return [
    { id: uuidv4(), genes: buildHijo(padreA, padreB), fitness: 0 },
    { id: uuidv4(), genes: buildHijo(padreB, padreA), fitness: 0 },
  ];
}

// ─────────────────────────────────────────────────────────────
// MÉTODO 3: MÁSCARA ALEATORIA (Binomial Uniform Crossover)
//
// Para cada posición i, se lanza una moneda.
// Si cara → Hijo1[i] = A[i], Hijo2[i] = B[i]
// Si cruz → Hijo1[i] = B[i], Hijo2[i] = A[i]
//
// Ventaja: mayor exploración del espacio de soluciones.
// ─────────────────────────────────────────────────────────────

export function cruceMascaraAleatoria(
  padreA: Cromosoma,
  padreB: Cromosoma
): [Cromosoma, Cromosoma] {
  const genesHijo1: Gen[] = [];
  const genesHijo2: Gen[] = [];

  for (let i = 0; i < padreA.genes.length; i++) {
    if (Math.random() < 0.5) {
      genesHijo1.push({ ...padreA.genes[i] });
      genesHijo2.push(combinarGenes(padreB.genes[i], padreA.genes[i]));
    } else {
      genesHijo1.push(combinarGenes(padreA.genes[i], padreB.genes[i]));
      genesHijo2.push({ ...padreB.genes[i] });
    }
  }

  return [
    { id: uuidv4(), genes: genesHijo1, fitness: 0 },
    { id: uuidv4(), genes: genesHijo2, fitness: 0 },
  ];
}

// ─────────────────────────────────────────────────────────────
// FUNCIÓN UNIFICADA
// ─────────────────────────────────────────────────────────────

export function cruzar(
  padreA: Cromosoma,
  padreB: Cromosoma,
  metodo: "un_punto" | "multipunto" | "mascara_aleatoria",
  tasaCruce: number = 0.8
): [Cromosoma, Cromosoma] {
  // Si no se aplica cruce, los hijos son copias de los padres
  if (Math.random() > tasaCruce) {
    return [
      { ...padreA, id: uuidv4(), genes: padreA.genes.map((g) => ({ ...g })) },
      { ...padreB, id: uuidv4(), genes: padreB.genes.map((g) => ({ ...g })) },
    ];
  }

  switch (metodo) {
    case "un_punto":
      return cruceUnPunto(padreA, padreB);
    case "multipunto":
      return cruceMultipunto(padreA, padreB);
    case "mascara_aleatoria":
      return cruceMascaraAleatoria(padreA, padreB);
    default:
      return cruceUnPunto(padreA, padreB);
  }
}