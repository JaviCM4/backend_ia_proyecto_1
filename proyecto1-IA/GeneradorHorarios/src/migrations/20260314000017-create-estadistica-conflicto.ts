import { QueryInterface } from 'sequelize';
import { col } from '../utils/migrationHelpers';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('estadistica_conflicto', {
    id:                        col.id(),
    solucion_id:               col.fk('solucion', 'id', false, 'CASCADE'),
    tiempo_ejecucion:          col.str(100),
    generaciones_ejecutadas:   col.int(),
    cantidad_conflictos:       col.int(),
    memoria_usada_bytes:       col.str(100),
    porcentaje_cursos_continuos: col.str(100),
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('estadistica_conflicto');
}
