import { CreationAttributes } from 'sequelize';
import AsignacionSalon from '../models/AsignacionSalon';
import Salon from '../models/Salon';
import Curso from '../models/Curso';
import { NotFoundError, ConflictError } from '../exceptions/ApiExceptions';

type AsignacionSalonData = CreationAttributes<AsignacionSalon>;

// ===================================== Métodos privados =====================================
const findOrFail = async (id: number): Promise<AsignacionSalon> => {
  const asignacion = await AsignacionSalon.findByPk(id, {
    include: [
      { model: Salon, as: 'salon' },
      { model: Curso, as: 'curso' },
    ],
  });
  if (!asignacion) throw new NotFoundError('AsignacionSalon', id);
  return asignacion;
};

// ========================================== CRUD ============================================
const getAll = (): Promise<AsignacionSalon[]> =>
  AsignacionSalon.findAll({
    include: [
      { model: Salon, as: 'salon' },
      { model: Curso, as: 'curso' },
    ],
  });

const getById = (id: number): Promise<AsignacionSalon> => findOrFail(id);

const create = async (data: AsignacionSalonData): Promise<AsignacionSalon> => {
  const existing = await AsignacionSalon.findOne({
    where: { id_curso: data.id_curso, id_salon: data.id_salon },
  });
  if (existing) throw new ConflictError('AsignacionSalon', { id_curso: data.id_curso, id_salon: data.id_salon });
  return AsignacionSalon.create(data);
};

const remove = async (id: number): Promise<void> => {
  const asignacion = await findOrFail(id);
  await asignacion.destroy();
};

const removeAll = async (): Promise<void> => {
  await AsignacionSalon.destroy({ where: {} });
};

export const AsignacionSalonService = {
  getAll,
  getById,
  create,
  remove,
  removeAll,
};
