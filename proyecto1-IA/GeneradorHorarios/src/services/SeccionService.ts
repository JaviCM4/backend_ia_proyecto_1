import { CreationAttributes } from 'sequelize';
import Seccion from '../models/Seccion';
import Laboratorio from '../models/Laboratorio';
import { NotFoundError } from '../exceptions/ApiExceptions';

type SeccionData = CreationAttributes<Seccion>;

// ===================================== Métodos privados =====================================
const findOrFail = async (id: number): Promise<Seccion> => {
  const seccion = await Seccion.findByPk(id);
  if (!seccion) throw new NotFoundError('Seccion', id);
  return seccion;
};

// ========================================== CRUD ============================================
const create = (data: SeccionData): Promise<Seccion> => Seccion.create(data);

const update = async (id: number, data: Partial<SeccionData>): Promise<Seccion> => {
  const seccion = await findOrFail(id);
  return seccion.update(data);
};

const remove = async (id: number): Promise<void> => {
  const seccion = await findOrFail(id);
  await seccion.destroy();
};

const removeAll = async (): Promise<void> => {
  await Seccion.destroy({ where: {} });
};

// ===================================== Laboratorio por curso =====================================
interface SetLaboratorioResult {
  id_curso: number;
  tiene_laboratorio: boolean;
  secciones_afectadas: number;
}

const setLaboratorio = async (id_curso: number, tiene_laboratorio: boolean): Promise<SetLaboratorioResult> => {
  const secciones = await Seccion.findAll({ where: { curso_id: id_curso } });

  if (!secciones.length) throw new NotFoundError('Curso (secciones)', id_curso);

  if (tiene_laboratorio) {
    for (const seccion of secciones) {
      const existe = await Laboratorio.findOne({ where: { seccion_id: seccion.id } });
      if (!existe) {
        await Laboratorio.create({
          seccion_id: seccion.id,
          nombre: `Lab ${seccion.letra}`,
          estudiantes_asignados: 0,
          no_periodos: null,
        });
      }
    }
  } else {
    const ids = secciones.map(s => s.id);
    await Laboratorio.destroy({ where: { seccion_id: ids } });
  }

  return { id_curso, tiene_laboratorio, secciones_afectadas: secciones.length };
};

export const SeccionService = {
  create,
  update,
  remove,
  removeAll,
  setLaboratorio,
};
