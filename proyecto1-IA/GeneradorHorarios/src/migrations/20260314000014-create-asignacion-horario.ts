import { QueryInterface } from 'sequelize';
import { col } from '../utils/migrationHelpers';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('asignacion_horario', {
    id:         col.id(),
    curso_id:   col.fk('curso',   'id', false, 'CASCADE'),
    periodo_id: col.fk('periodo', 'id', false, 'RESTRICT'),
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('asignacion_horario');
}
