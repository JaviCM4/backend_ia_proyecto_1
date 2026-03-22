import { QueryInterface } from 'sequelize';
import { col } from '../utils/migrationHelpers';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('conflicto', {
    id:          col.id(),
    solucion_id: col.fk('solucion', 'id', false, 'CASCADE'),
    tipo:        col.str(100),
    descripcion: col.str(255),
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('conflicto');
}
