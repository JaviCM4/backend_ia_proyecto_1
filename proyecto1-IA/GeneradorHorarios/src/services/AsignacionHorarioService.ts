import { CreationAttributes } from 'sequelize';
import AsignacionHorario from '../models/AsignacionHorario';
import Periodo from '../models/Periodo';
import { NotFoundError, ConflictError } from '../exceptions/ApiExceptions';

type AsignacionHorarioData = CreationAttributes<AsignacionHorario>;

// ===================================== Métodos privados =====================================
const findOrFail = async (id: number): Promise<AsignacionHorario> => {
  const asignacion = await AsignacionHorario.findByPk(id, {
    include: [{ model: Periodo, as: 'periodo' }],
  });
  if (!asignacion) throw new NotFoundError('AsignacionHorario', id);
  return asignacion;
};

// ========================================== CRUD ============================================
const getAll = (): Promise<AsignacionHorario[]> =>
  AsignacionHorario.findAll({
    include: [{ model: Periodo, as: 'periodo' }],
  });

const getById = (id: number): Promise<AsignacionHorario> => findOrFail(id);

const create = async (data: AsignacionHorarioData): Promise<AsignacionHorario> => {
  const existing = await AsignacionHorario.findOne({
    where: { curso_id: data.curso_id, periodo_id: data.periodo_id },
  });
  if (existing) throw new ConflictError('AsignacionHorario', { curso_id: data.curso_id, periodo_id: data.periodo_id });
  return AsignacionHorario.create(data);
};

const remove = async (id: number): Promise<void> => {
  const asignacion = await findOrFail(id);
  await asignacion.destroy();
};

const removeAll = async (): Promise<void> => {
  await AsignacionHorario.destroy({ where: {} });
};

export const AsignacionHorarioService = {
  getAll,
  getById,
  create,
  remove,
  removeAll,
};
