// ============================================================
// domain.types.ts
// Modelos de dominio: las entidades reales del problema
// ============================================================

/** Jornada en la que puede operar un curso o salón */
export type Jornada = "manana" | "tarde" | "ambas";

/** Días hábiles de la semana */
export type DiaSemana = "lunes" | "martes" | "miercoles" | "jueves" | "viernes" | "sabado";

/** Tipo de curso */
export type TipoCurso = "obligatorio" | "optativo";

/** Tipo de sesión que ocupa el curso */
export type TipoSesion = "teoria" | "laboratorio";

// ─────────────────────────────────────────────────────────────
// FRANJA HORARIA
// Representa un bloque de tiempo en un día específico.
// Cada periodo dura 50 minutos por defecto (configurable).
// ─────────────────────────────────────────────────────────────
export interface FranjaHoraria {
  id: string;              // "lunes-07:00"
  dia: DiaSemana;
  horaInicio: string;      // "07:00"
  horaFin: string;         // "07:50"
  jornada: Jornada;        // si pertenece a mañana o tarde
}

// ─────────────────────────────────────────────────────────────
// SALÓN
// ─────────────────────────────────────────────────────────────
export interface Salon {
  id: string;
  nombre: string;
  capacidad?: number;          // opcional — si no se da, el GA puede asignar libremente
  esLaboratorio: boolean;
  habilitadoParaTeoría: boolean; // laboratorio que puede usarse para clases teóricas
  jornada: Jornada;             // "manana" | "tarde" | "ambas"
  activo: boolean;              // si se incluye en la generación del horario
}

// ─────────────────────────────────────────────────────────────
// DOCENTE
// ─────────────────────────────────────────────────────────────
export interface Docente {
  id: string;
  nombre: string;
  registroPersonal: string;
  horaEntrada: string;   // "07:00"
  horaSalida: string;    // "13:00"
  cursosQuePuedeImpartir: string[]; // array de Course IDs
  activo: boolean;       // si se incluye en la generación del horario
}

// ─────────────────────────────────────────────────────────────
// CURSO
// ─────────────────────────────────────────────────────────────
export interface Curso {
  id: string;
  nombre: string;
  codigo: string;
  carrera: string;
  semestre: number;          // 1–10
  secciones: number;         // cuántas secciones paralelas existen (default 1)
  tipo: TipoCurso;
  tieneLabatorio: boolean;
  estudiantesInscritos?: number;   // opcional
  jornada: Jornada;                // en qué jornada se puede impartir

  // Fijaciones opcionales (restricciones duras del usuario)
  docenteFijo?: string;            // ID del docente que DEBE impartirlo (si solo hay uno posible)
  salonFijo?: string;              // ID del salón específico
  franjaFija?: string;             // ID de franja horaria fija (ej: primer ingreso)
  sinSalon?: boolean;              // cursos como deportes/prácticas (tienen horario pero no salón)

  noPeriodos?: number;           // periodos de teoría por semana (de Curso.no_periodos)
  noPeriodosLab?: number;         // periodos de lab por sesión (de Laboratorio.no_periodos)

  activo: boolean;
}

// ─────────────────────────────────────────────────────────────
// RELACIÓN DOCENTE ↔ CURSO
// Se carga desde el CSV "relacion_docente_curso.csv"
// ─────────────────────────────────────────────────────────────
export interface RelacionDocenteCurso {
  docenteId: string;
  cursoId: string;
}

// ─────────────────────────────────────────────────────────────
// CONFIGURACIÓN GLOBAL DEL HORARIO
// Parámetros que el usuario puede ajustar desde la interfaz
// ─────────────────────────────────────────────────────────────
export interface ConfiguracionHorario {
  duracionPeriodoMinutos: number;   // 50 por defecto
  horaInicioManana: string;         // "07:00"
  horaFinManana: string;            // "13:00"
  horaInicioTarde: string;          // "13:40" o "14:30"
  horaFinTarde: string;             // "21:10" o "22:00"
  diasActivos: DiaSemana[];
}


// ─────────────────────────────────────────────────────────────
// Conflictos
// ─────────────────────────────────────────────────────────────

export type ConflictoPersistencia = {
  solucion_id: number;
  tipo: string;
  descripcion: string;
  //genes_involucrados: string;
};