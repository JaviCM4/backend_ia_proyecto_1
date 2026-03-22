import { CreationAttributes } from 'sequelize';
import Laboratorio from '../models/Laboratorio';
import { NotFoundError } from '../exceptions/ApiExceptions';

type LaboratorioData = CreationAttributes<Laboratorio>;

// ===================================== Métodos privados =====================================
const findOrFail = async (id: number): Promise<Laboratorio> => {
  const lab = await Laboratorio.findByPk(id);
  if (!lab) throw new NotFoundError('Laboratorio', id);
  return lab;
};

// ========================================== CRUD ============================================
const getById = (id: number): Promise<Laboratorio> => findOrFail(id);

const update = async (id: number, data: Partial<LaboratorioData>): Promise<Laboratorio> => {
  const lab = await findOrFail(id);
  return lab.update(data);
};

export const LaboratorioService = {
  getById,
  update,
};
