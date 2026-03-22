import { QueryInterface, DataTypes } from 'sequelize';
import { col } from '../utils/migrationHelpers';
import { CarreraEnum } from '../types/enums';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('curso', {
    id:             col.id(),
    carrera:        { type: DataTypes.ENUM(...Object.values(CarreraEnum)), allowNull: false },
    codigo:         { ...col.str(20), unique: true },
    nombre:         col.str(100),
    semestre:       col.int(true),
    no_periodos:    col.int(true),
    necesita_salon: col.bool(false),
    solo_tarde:     col.bool(false),
    es_obligatorio: col.bool(true),
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('curso');
}
