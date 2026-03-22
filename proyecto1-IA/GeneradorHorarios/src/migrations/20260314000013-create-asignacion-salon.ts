import { QueryInterface } from 'sequelize';
import { col } from '../utils/migrationHelpers';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('asignacion_salon', {
    id: col.id(),
    id_salon: col.fk('salon'),
    id_curso: col.fk('curso'),
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('asignacion_salon');
}
