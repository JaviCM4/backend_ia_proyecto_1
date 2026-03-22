import { CreationAttributes } from 'sequelize';
import { parse } from 'csv-parse/sync';
import Salon from '../models/Salon';
import { NotFoundError } from '../exceptions/ApiExceptions';

type SalonData = CreationAttributes<Salon>;

// ===================================== Métodos privados =====================================
const findOrFail = async (id: number): Promise<Salon> => {
  const salon = await Salon.findByPk(id);
  if (!salon) throw new NotFoundError('Salon', id);
  return salon;
};

// ========================================== CRUD ============================================
const getAll = (): Promise<Salon[]> =>
  Salon.findAll({ order: [['nombre', 'ASC']] });

const getById = (id: number): Promise<Salon> => findOrFail(id);

const create = (data: SalonData): Promise<Salon> => Salon.create(data);

const update = async (id: number, data: Partial<SalonData>): Promise<Salon> => {
  const salon = await findOrFail(id);
  return salon.update(data);
};

const remove = async (id: number): Promise<void> => {
  const salon = await findOrFail(id);
  await salon.destroy();
};

const removeAll = async (): Promise<void> => {
  await Salon.destroy({ where: {} });
};

// ===================================== Importación desde CSV =====================================
interface ImportResult {
  salonesCreados: number;
  salonesExistentes: number;
  errores: string[];
}

const importFromCSV = async (content: string): Promise<ImportResult> => {
  const rows: Record<string, string>[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  const result: ImportResult = {
    salonesCreados: 0,
    salonesExistentes: 0,
    errores: [],
  };

  for (const row of rows) {
    try {
      const [, creado] = await Salon.findOrCreate({
        where: { nombre: row.nombre },
        defaults: {
          tipo_salon:         row.tipo_salon as any,
          nombre:             row.nombre,
          capacidad:          Number(row.capacidad),
          solo_tarde:         row.solo_tarde === 'true',
          habilitado_teorica: row.habilitado_teorico === 'true',
        },
      });
      creado ? result.salonesCreados++ : result.salonesExistentes++;
    } catch (err) {
      result.errores.push(`[salon "${row.nombre}"]: ${(err as Error).message}`);
    }
  }

  return result;
};

export const SalonService = {
  getAll,
  getById,
  create,
  update,
  remove,
  removeAll,
  importFromCSV,
};
