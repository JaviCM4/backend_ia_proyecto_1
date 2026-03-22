import { Model, DataTypes, CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';
import sequelize from '../database/connection';

class AsignacionSalon extends Model<InferAttributes<AsignacionSalon>, InferCreationAttributes<AsignacionSalon>> {
  declare id: CreationOptional<number>;
  declare id_salon: number;
  declare id_curso: number;
}

AsignacionSalon.init(
  {
    id:       { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    id_salon: { type: DataTypes.INTEGER, allowNull: false },
    id_curso: { type: DataTypes.INTEGER, allowNull: false },
  },
  { sequelize, tableName: 'asignacion_salon', timestamps: false },
);

export default AsignacionSalon;
