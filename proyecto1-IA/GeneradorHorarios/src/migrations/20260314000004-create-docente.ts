import { QueryInterface, DataTypes } from 'sequelize';
import { col } from '../utils/migrationHelpers';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('docente', {
    registro: { type: DataTypes.STRING(20), primaryKey: true, allowNull: false },
    nombre: col.str(100),
    hora_entrada: col.time(),
    hora_salida: col.time(),
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('docente');
}
