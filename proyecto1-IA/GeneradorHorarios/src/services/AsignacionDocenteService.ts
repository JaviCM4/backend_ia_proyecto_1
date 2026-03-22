import { CreationAttributes } from 'sequelize';
import { parse } from 'csv-parse/sync';
import AsignacionDocente from '../models/AsignacionDocente';
import Docente from '../models/Docente';
import Curso from '../models/Curso';
import { NotFoundError, ConflictError } from '../exceptions/ApiExceptions';

type AsignacionDocenteData = CreationAttributes<AsignacionDocente>;

// ===================================== Métodos privados =====================================
const findOrFail = async (id: number): Promise<AsignacionDocente> => {
  const asignacion = await AsignacionDocente.findByPk(id, {
    include: [{ model: Docente, as: 'docente' }],
  });
  if (!asignacion) throw new NotFoundError('AsignacionDocente', id);
  return asignacion;
};

// ========================================== CRUD ============================================
const getAll = (): Promise<AsignacionDocente[]> =>
  AsignacionDocente.findAll({
    include: [{ model: Docente, as: 'docente' }],
  });

const getById = (id: number): Promise<AsignacionDocente> => findOrFail(id);

const create = async (data: AsignacionDocenteData): Promise<AsignacionDocente> => {
  const existing = await AsignacionDocente.findOne({
    where: { curso_id: data.curso_id, docente_id: data.docente_id },
  });
  if (existing) throw new ConflictError('AsignacionDocente', { curso_id: data.curso_id, docente_id: data.docente_id });
  return AsignacionDocente.create(data);
};

const remove = async (id: number): Promise<void> => {
  const asignacion = await findOrFail(id);
  await asignacion.destroy();
};

const removeAll = async (): Promise<void> => {
  await AsignacionDocente.destroy({ where: {} });
};

interface ImportAsignacionResult {
  creadas: number;
  duplicadas: number;
  errores: string[];
}

const importFromCSV = async (content: string): Promise<ImportAsignacionResult> => {
  const rows: { curso_id: string; docente_id: string }[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  let creadas = 0;
  let duplicadas = 0;
  const errores: string[] = [];

  for (const row of rows) {
    const cursoId = Number(row.curso_id);
    const docenteId = String(row.docente_id).trim();

    if (isNaN(cursoId) || !docenteId) {
      errores.push(`Fila inválida: curso_id="${row.curso_id}", docente_id="${row.docente_id}"`);
      continue;
    }

    try {
      const curso = await Curso.findByPk(cursoId);
      if (!curso) {
        errores.push(`Curso con id=${cursoId} no existe`);
        continue;
      }

      const docente = await Docente.findByPk(docenteId);
      if (!docente) {
        errores.push(`Docente con registro="${docenteId}" no existe`);
        continue;
      }

      const existing = await AsignacionDocente.findOne({
        where: { curso_id: cursoId, docente_id: docenteId },
      });

      if (existing) {
        duplicadas++;
      } else {
        await AsignacionDocente.create({ curso_id: cursoId, docente_id: docenteId });
        creadas++;
      }
    } catch (e) {
      errores.push(`Error al procesar curso_id=${cursoId}, docente_id="${docenteId}": ${(e as Error).message}`);
    }
  }

  return { creadas, duplicadas, errores };
};

export const AsignacionDocenteService = {
  getAll,
  getById,
  create,
  remove,
  removeAll,
  importFromCSV,
};
