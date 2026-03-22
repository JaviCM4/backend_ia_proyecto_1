import { QueryInterface } from 'sequelize';
import { col } from '../utils/migrationHelpers';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('laboratorio', {
    id: col.id(),
    seccion_id: col.fk('seccion'),
    nombre: col.str(150),
    estudiantes_asignados: { ...col.int(true), defaultValue: 0 },
    no_periodos: col.int(true),
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('laboratorio');
}
