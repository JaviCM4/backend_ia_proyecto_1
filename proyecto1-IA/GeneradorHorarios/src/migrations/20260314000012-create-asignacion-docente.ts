import { QueryInterface } from 'sequelize';
import { col } from '../utils/migrationHelpers';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('asignacion_docente', {
    id:         col.id(),
    curso_id:   col.fk('curso',   'id', false, 'CASCADE'),
    docente_id: col.fkStr('docente', 'registro', 20, false, 'CASCADE'),
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('asignacion_docente');
}
