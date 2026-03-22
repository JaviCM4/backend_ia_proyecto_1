import { QueryInterface } from 'sequelize';
import { col } from '../utils/migrationHelpers';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('seccion', {
    id: col.id(),
    curso_id: col.fk('curso'),
    letra: col.char(1),
    estudiantes_asignados: { ...col.int(true), defaultValue: 0 },
  });

  await queryInterface.addConstraint('seccion', {
    fields: ['curso_id', 'letra'],
    type: 'unique',
    name: 'uq_seccion_curso_letra',
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('seccion');
}
