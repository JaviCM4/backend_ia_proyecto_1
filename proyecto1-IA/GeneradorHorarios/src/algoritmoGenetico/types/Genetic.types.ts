// ============================================================
// genetic.types.ts
// Tipos propios del algoritmo genético
// ============================================================

// ─────────────────────────────────────────────────────────────
// GEN
// La unidad mínima del cromosoma.
// Representa la asignación completa de UNA sección de UN curso:
//   "El curso Mate1 sección A → docente Juan → salón S1 → lunes 07:00"
// ─────────────────────────────────────────────────────────────
export interface Gen {
  cursoId: string;
  seccion: string;           // "A", "B", "C" …
  docenteId: string | null;  // null solo si sinSalon=true y no hay docente
  salonId: string | null;    // null cuando sinSalon=true (deportes, prácticas)
  franjaId: string;          // ID de la franja horaria asignada
  tipoSesion: "teoria" | "laboratorio";

  // Para laboratorios de 2–3 periodos seguidos guardamos las franjas extra
  franjasExtra?: string[];   // IDs de franjas adicionales contiguas
}

// ─────────────────────────────────────────────────────────────
// CROMOSOMA
// Una solución completa: el horario entero de la División.
// Es un arreglo ordenado de genes, uno por cada (curso × sección).
// ─────────────────────────────────────────────────────────────
export interface Cromosoma {
  id: string;          // UUID para identificar al individuo
  genes: Gen[];
  fitness: number;     // calculado por la función de aptitud
}

// ─────────────────────────────────────────────────────────────
// POBLACIÓN
// Conjunto de cromosomas en una generación.
// ─────────────────────────────────────────────────────────────
export type Poblacion = Cromosoma[];

// ─────────────────────────────────────────────────────────────
// CONFIGURACIÓN DEL ALGORITMO GENÉTICO
// Todos los parámetros ajustables desde la UI
// ─────────────────────────────────────────────────────────────
export interface ConfiguracionGA {
  tamanioPoblacion: number;          // cantidad de cromosomas (ej: 100)
  maxGeneraciones: number;           // criterio de parada por iteraciones
  fitnesObjetivo?: number;           // criterio de parada por aptitud
  tasaMutacion: number;              // 0.0 – 1.0  (ej: 0.05)
  tasaCruce: number;                 // 0.0 – 1.0  (ej: 0.8)
  tamanioTorneo: number;             // para selección por torneo (ej: 3–5)
  elitismo: number;                  // cuántos mejores pasan directos (ej: 2)

  // Métodos elegidos por el usuario
  metodoSeleccion: "torneo" | "ruleta";
  metodoCruce: "un_punto" | "multipunto" | "mascara_aleatoria";
  metodoMutacion: "intercambio" | "random_resetting";
}

// ─────────────────────────────────────────────────────────────
// RESULTADO DE UNA EJECUCIÓN
// Para los reportes y la gráfica de aptitud en tiempo real
// ─────────────────────────────────────────────────────────────
export interface ResultadoGeneracion {
  generacion: number;
  mejorFitness: number;
  fitnesPromedio: number;
  peorFitness: number;
  conflictos: number;
}

export interface ResultadoEjecucion {
  mejorCromosoma: Cromosoma;
  historial: ResultadoGeneracion[];
  tiempoEjecucionMs: number;
  generacionesEjecutadas: number;
  memoriaUsadaBytes: number;
  porcentajeCursosContinuos: number;  // reporte D del proyecto
  listaConflictos: ConflictoPersistencia[];          // reporte A del proyecto
}

// ─────────────────────────────────────────────────────────────
// CONTEXTO DEL GA
// Todo lo que el algoritmo necesita para operar.
// Se construye una vez y se pasa a todas las funciones.
// ─────────────────────────────────────────────────────────────
import type { Curso, Docente, Salon, FranjaHoraria, ConflictoPersistencia } from "./Domain.types";

export interface ContextoGA {
  cursos: Curso[];
  docentes: Docente[];
  salones: Salon[];
  franjas: FranjaHoraria[];
  // Índices rápidos por id para evitar búsquedas lineales repetidas
  indiceCursos: Map<string, Curso>;
  indiceDocentes: Map<string, Docente>;
  indiceSalones: Map<string, Salon>;
  indiceFranjas: Map<string, FranjaHoraria>;
  // Docentes activos precalculados para filtros frecuentes
  docentesActivos: Set<string>;
  // Mapa rápido docente → set de cursoIds que puede impartir
  mapaDocenteCursos: Map<string, Set<string>>;
  // Mapa rápido curso → docentes posibles
  mapaCursoDocentes: Map<string, string[]>;

  // Restricciones de asignación prefijadas (desde la BD)
  asignacionDocente: Map<string, string[]>; // cursoId → [docenteIds asignados]
  asignacionSalon: Map<string, string>;     // cursoId → salonId asignado
  asignacionHorario: Map<string, string>;   // cursoId → horaInicio asignada ("07:00")
}