import { CreationAttributes } from 'sequelize';
import { parse } from 'csv-parse/sync';
import Docente from '../models/Docente';
import { NotFoundError } from '../exceptions/ApiExceptions';

type DocenteData = CreationAttributes<Docente>;

// ===================================== Métodos privados =====================================
const findOrFail = async (registro: string): Promise<Docente> => {
  const docente = await Docente.findByPk(registro);
  if (!docente) throw new NotFoundError('Docente', registro as unknown as number);
  return docente;
};

// ========================================== CRUD ============================================
const getAll = (): Promise<Docente[]> =>
  Docente.findAll({ order: [['nombre', 'ASC']] });

const getById = (registro: string): Promise<Docente> => findOrFail(registro);

const create = (data: DocenteData): Promise<Docente> => Docente.create(data);

const update = async (registro: string, data: Partial<DocenteData>): Promise<Docente> => {
  const docente = await findOrFail(registro);
  return docente.update(data);
};

const remove = async (registro: string): Promise<void> => {
  const docente = await findOrFail(registro);
  await docente.destroy();
};

const removeAll = async (): Promise<void> => {
  await Docente.destroy({ where: {} });
};

// ===================================== Importación desde CSV =====================================
interface ImportResult {
  docentesCreados: number;
  docentesExistentes: number;
  errores: string[];
}

const importFromCSV = async (content: string): Promise<ImportResult> => {
  const rows: Record<string, string>[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const result: ImportResult = {
    docentesCreados: 0,
    docentesExistentes: 0,
    errores: [],
  };

  for (const row of rows) {
    try {
      const [, creado] = await Docente.findOrCreate({
        where: { registro: String(row.registro) },
        defaults: {
          registro:     String(row.registro),
          nombre:       row.nombre,
          hora_entrada: row.hora_entrada !== '' ? row.hora_entrada : null,
          hora_salida:  row.hora_salida  !== '' ? row.hora_salida  : null,
        },
      });
      creado ? result.docentesCreados++ : result.docentesExistentes++;
    } catch (err) {
      result.errores.push(`[registro ${row.registro}]: ${(err as Error).message}`);
    }
  }

  return result;
};

export const DocenteService = {
  getAll,
  getById,
  create,
  update,
  remove,
  removeAll,
  importFromCSV,
};
