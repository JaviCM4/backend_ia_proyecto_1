import Docente         from './Docente';
import Periodo         from './Periodo';
import Solucion        from './Solucion';
import Curso           from './Curso';
import Seccion         from './Seccion';
import Salon           from './Salon';
import Laboratorio     from './Laboratorio';
import AsignacionDocente  from './AsignacionDocente';
import AsignacionSalon    from './AsignacionSalon';
import AsignacionHorario  from './AsignacionHorario';
import Calendario      from './Calendario';
import Conflicto from './Conflicto';
import EstadisticaSolucion from './EstadisticaSolucion';

// ── Curso ↔ Seccion ────────────────────────────────────────────
Curso.hasMany(Seccion,    { foreignKey: 'curso_id', as: 'secciones' });
Seccion.belongsTo(Curso,  { foreignKey: 'curso_id', as: 'curso' });

// ── Seccion ↔ Laboratorio ──────────────────────────────────────
Seccion.hasMany(Laboratorio,      { foreignKey: 'seccion_id', as: 'laboratorios' });
Laboratorio.belongsTo(Seccion,    { foreignKey: 'seccion_id', as: 'seccion' });

// ── Docente ↔ AsignacionDocente ────────────────────────────────
Docente.hasMany(AsignacionDocente,      { foreignKey: 'docente_id', sourceKey: 'registro', as: 'asignaciones' });
AsignacionDocente.belongsTo(Docente,    { foreignKey: 'docente_id', targetKey: 'registro', as: 'docente' });

Curso.hasMany(AsignacionDocente,        { foreignKey: 'curso_id', as: 'asignacionesDocente' });
AsignacionDocente.belongsTo(Curso,      { foreignKey: 'curso_id', as: 'curso' });

// ── Salon / Curso ↔ AsignacionSalon ────────────────────────────
Salon.hasMany(AsignacionSalon,    { foreignKey: 'id_salon', as: 'asignacionesSalon' });
AsignacionSalon.belongsTo(Salon,  { foreignKey: 'id_salon', as: 'salon' });

Curso.hasMany(AsignacionSalon,    { foreignKey: 'id_curso', as: 'salonesAsignados' });
AsignacionSalon.belongsTo(Curso,  { foreignKey: 'id_curso', as: 'curso' });

// ── Periodo ↔ AsignacionHorario ────────────────────────────────
Periodo.hasMany(AsignacionHorario,    { foreignKey: 'periodo_id', as: 'asignacionesHorario' });
AsignacionHorario.belongsTo(Periodo,  { foreignKey: 'periodo_id', as: 'periodo' });

Curso.hasMany(AsignacionHorario,      { foreignKey: 'curso_id', as: 'asignacionesHorario' });
AsignacionHorario.belongsTo(Curso,    { foreignKey: 'curso_id', as: 'curso' });

// ── Calendario ─────────────────────────────────────────────────
Solucion.hasMany(Calendario,       { foreignKey: 'solucion_id',    as: 'calendarios' });
Calendario.belongsTo(Solucion,     { foreignKey: 'solucion_id',    as: 'solucion' });

Laboratorio.hasMany(Calendario,    { foreignKey: 'laboratorio_id', as: 'calendarios' });
Calendario.belongsTo(Laboratorio,  { foreignKey: 'laboratorio_id', as: 'laboratorio' });

Seccion.hasMany(Calendario,        { foreignKey: 'seccion_id',     as: 'calendarios' });
Calendario.belongsTo(Seccion,      { foreignKey: 'seccion_id',     as: 'seccion' });

Docente.hasMany(Calendario,        { foreignKey: 'docente_id', sourceKey: 'registro', as: 'calendarios' });
Calendario.belongsTo(Docente,      { foreignKey: 'docente_id', targetKey: 'registro', as: 'docente' });

Salon.hasMany(Calendario,          { foreignKey: 'salon_id',       as: 'calendariosSalon' });
Calendario.belongsTo(Salon,        { foreignKey: 'salon_id',       as: 'salon' });

Periodo.hasMany(Calendario,        { foreignKey: 'periodo_id',     as: 'calendariosPeriodo' });
Calendario.belongsTo(Periodo,      { foreignKey: 'periodo_id',     as: 'periodo' });

Solucion.hasMany(Conflicto,        { foreignKey: 'solucion_id',    as: 'conflictos' });
Conflicto.belongsTo(Solucion,      { foreignKey: 'solucion_id',    as: 'solucion' });

Solucion.hasOne(EstadisticaSolucion, { foreignKey: 'solucion_id',    as: 'estadistica' });
EstadisticaSolucion.belongsTo(Solucion, { foreignKey: 'solucion_id',    as: 'solucion' });


export {
  Docente,
  Periodo,
  Solucion,
  Curso,
  Seccion,
  Salon,
  Laboratorio,
  AsignacionDocente,
  AsignacionSalon,
  AsignacionHorario,
  Calendario,
  Conflicto,
  EstadisticaSolucion
};
