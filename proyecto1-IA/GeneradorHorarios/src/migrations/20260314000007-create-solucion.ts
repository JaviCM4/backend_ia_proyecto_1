import { QueryInterface } from 'sequelize';
import { col } from '../utils/migrationHelpers';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('solucion', {
    id: col.id(),
    generacion: col.int(),
    aptitud: col.decimal(10, 4),
    fecha_creacion: col.date(true),
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('solucion');
}
