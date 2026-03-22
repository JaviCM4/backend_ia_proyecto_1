import { CreationAttributes, WhereOptions } from 'sequelize';
import { parse } from 'csv-parse/sync';
import Curso from '../models/Curso';
import Seccion from '../models/Seccion';
import Laboratorio from '../models/Laboratorio';
import { CarreraEnum } from '../types/enums';
import { NotFoundError } from '../exceptions/ApiExceptions';

// Tipo de dato que devuelven los métodos públicos
type CursoData = CreationAttributes<Curso>;

// ===================================== Métodos privados =====================================
const findOrFail = async (id: number): Promise<Curso> => {
  const curso = await Curso.findByPk(id, {
    include: [{ model: Seccion, as: 'secciones' }],
  });
  if (!curso) throw new NotFoundError('Curso', id);
  return curso;
};

// ========================================== CRUD ============================================
const getAll = (where: WhereOptions<Curso> = {}): Promise<Curso[]> =>
  Curso.findAll({
    where,
    order: [['semestre', 'ASC'], ['nombre', 'ASC']],
  });

const getAllConSecciones = async () => {
  const cursos = await Curso.findAll({
    order: [['semestre', 'ASC'], ['nombre', 'ASC']],
    include: [{
      model: Seccion,
      as: 'secciones',
      include: [{ model: Laboratorio, as: 'laboratorios' }],
    }],
  });

  return cursos.map((curso) => {
    const secciones = (curso as any).secciones as (Seccion & { laboratorios?: Laboratorio[] })[] ?? [];
    const tieneLaboratorio = secciones.some(s => s.laboratorios && s.laboratorios.length > 0);

    return {
      ...curso.toJSON(),
      tiene_laborartorio: tieneLaboratorio,
      secciones: secciones.map(s => {
        const lab = s.laboratorios?.[0] ?? null;
        return {
          id: s.id,
          letra: s.letra,
          estudiantes_asignados: s.estudiantes_asignados ?? 0,
          laboratorio: lab ? {
            id: lab.id,
            nombre: lab.nombre,
            estudiantes_asignados: lab.estudiantes_asignados ?? 0,
            no_periodos: lab.no_periodos,
          } : null,
        };
      }),
    };
  });
};

const getById = (id: number): Promise<Curso> => findOrFail(id);

const create = (data: CursoData): Promise<Curso> => Curso.create(data);

const update = async (id: number, data: Partial<CursoData>): Promise<Curso> => {
  const curso = await findOrFail(id);
  return curso.update(data);
};

const remove = async (id: number): Promise<void> => {
  const curso = await findOrFail(id);
  await curso.destroy();
};

// ===================================== Consultas específicas del dominio =====================================
const getByCarrera = (carrera: CarreraEnum): Promise<Curso[]> =>
  getAll({ carrera });

const getObligatorios = (carrera: CarreraEnum): Promise<Curso[]> =>
  getAll({ carrera, es_obligatorio: true });

const removeAll = async (): Promise<void> => {
  await Curso.destroy({ where: {} });
};

// ===================================== Importación desde CSV =====================================
interface ImportResult {
  cursosCreados: number;
  cursosExistentes: number;
  seccionesCreadas: number;
  seccionesExistentes: number;
  laboratoriosCreados: number;
  laboratoriosExistentes: number;
  errores: string[];
}

const parseBool = (val: unknown): boolean => String(val).toUpperCase() === 'TRUE';

const importFromCSV = async (content: string): Promise<ImportResult> => {
  const rows: Record<string, string>[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const result: ImportResult = {
    cursosCreados: 0,
    cursosExistentes: 0,
    seccionesCreadas: 0,
    seccionesExistentes: 0,
    laboratoriosCreados: 0,
    laboratoriosExistentes: 0,
    errores: [],
  };

  for (const row of rows) {
    try {
      // findOrCreate usa el codigo como clave única
      const [curso, cursoCreado] = await Curso.findOrCreate({
        where: { codigo: String(row.codigo) },
        defaults: {
          codigo:         String(row.codigo),
          nombre:         row.nombre,
          carrera:        row.carrera as CarreraEnum,
          semestre:       row.semestre     !== '' ? Number(row.semestre)     : null,
          no_periodos:    row.no_periodos  !== '' ? Number(row.no_periodos)  : null,
          necesita_salon: parseBool(row.necesita_salon),
          solo_tarde:     parseBool(row.solo_tarde),
          es_obligatorio: parseBool(row.es_obligatorio),
        },
      });
      cursoCreado ? result.cursosCreados++ : result.cursosExistentes++;

      // findOrCreate verifica (curso_id + letra) que tiene índice único
      const [seccion, seccionCreada] = await Seccion.findOrCreate({
        where: { curso_id: curso.id, letra: String(row.seccion) },
        defaults: {
          curso_id:              curso.id,
          letra:                 String(row.seccion),
          estudiantes_asignados: 0,
        },
      });
      seccionCreada ? result.seccionesCreadas++ : result.seccionesExistentes++;

      // Si la columna laboratorio es TRUE, crear también el laboratorio asociado a la sección
      if (parseBool(row.laboratorio)) {
        const [, labCreado] = await Laboratorio.findOrCreate({
          where: { seccion_id: seccion.id },
          defaults: {
            seccion_id:            seccion.id,
            nombre:                "Laboratorio " + row.nombre,
            estudiantes_asignados: 0,
            no_periodos: 3, 
            //no_periodos:           row.no_periodos !== '' ? Number(row.no_periodos) : null,
          },
        });
        labCreado ? result.laboratoriosCreados++ : result.laboratoriosExistentes++;
      }

    } catch (err) {
      result.errores.push(`[codigo ${row.codigo} sec ${row.seccion}]: ${(err as Error).message}`);
    }
  }

  return result;
};

export const CursoService = {
  getAll,
  getAllConSecciones,
  getById,
  create,
  update,
  remove,
  removeAll,
  importFromCSV,
  getByCarrera,
  getObligatorios,
};
