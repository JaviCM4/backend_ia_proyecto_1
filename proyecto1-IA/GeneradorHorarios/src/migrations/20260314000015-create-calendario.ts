import { QueryInterface, DataTypes } from 'sequelize';
import { col } from '../utils/migrationHelpers';
import { TipoAsignacionEnum, DiaEnum } from '../types/enums';

export async function up(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.createTable('calendario', {
    id:              col.id(),
    solucion_id:     col.fk('solucion',    'id', false, 'CASCADE'),
    laboratorio_id:  col.fk('laboratorio', 'id', true,  'SET NULL'),
    seccion_id:      col.fk('seccion',     'id', true,  'SET NULL'),
    tipo_asignacion: { type: DataTypes.ENUM(...Object.values(TipoAsignacionEnum)), allowNull: false },
    docente_id:      col.fkStr('docente', 'registro', 20, true, 'SET NULL'),
    salon_id:        col.fk('salon',       'id', true,  'SET NULL'),
    dia:             { type: DataTypes.ENUM(...Object.values(DiaEnum)), allowNull: false },
    periodo_id:      col.fk('periodo',     'id', false, 'RESTRICT'),
  });
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('calendario');
}
