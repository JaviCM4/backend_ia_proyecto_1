import { QueryInterface, DataTypes } from 'sequelize';
import { col } from '../utils/migrationHelpers';
import { TipoSalonEnum } from '../types/enums';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('salon', {
    id:                 col.id(),
    tipo_salon:         { type: DataTypes.ENUM(...Object.values(TipoSalonEnum)), allowNull: false },
    nombre:             { ...col.str(50), unique: true },
    capacidad:          col.int(),
    solo_tarde:         col.bool(false),
    habilitado_teorica: col.bool(true),
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('salon');
}
