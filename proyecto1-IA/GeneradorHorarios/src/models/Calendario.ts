import { Model, DataTypes, CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';
import sequelize from '../database/connection';
import { TipoAsignacionEnum, DiaEnum } from '../types/enums';

class Calendario extends Model<InferAttributes<Calendario>, InferCreationAttributes<Calendario>> {
  declare id: CreationOptional<number>;
  declare solucion_id: number;
  declare laboratorio_id: number | null;
  declare seccion_id: number | null;
  declare tipo_asignacion: TipoAsignacionEnum;
  declare docente_id: string | null;
  declare salon_id: number | null;
  declare dia: DiaEnum;
  declare periodo_id: number;
}

Calendario.init(
  {
    id:               { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    solucion_id:      { type: DataTypes.INTEGER, allowNull: false },
    laboratorio_id:   { type: DataTypes.INTEGER, allowNull: true },
    seccion_id:       { type: DataTypes.INTEGER, allowNull: true },
    tipo_asignacion:  { type: DataTypes.ENUM(...Object.values(TipoAsignacionEnum)), allowNull: false },
    docente_id:       { type: DataTypes.STRING(20), allowNull: true },
    salon_id:         { type: DataTypes.INTEGER, allowNull: true },
    dia:              { type: DataTypes.ENUM(...Object.values(DiaEnum)), allowNull: false },
    periodo_id:       { type: DataTypes.INTEGER, allowNull: false },
  },
  { sequelize, tableName: 'calendario', timestamps: false },
);

export default Calendario;
