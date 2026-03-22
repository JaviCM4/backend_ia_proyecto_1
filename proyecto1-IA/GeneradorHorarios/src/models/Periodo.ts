import { Model, DataTypes, CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';
import sequelize from '../database/connection';

class Periodo extends Model<InferAttributes<Periodo>, InferCreationAttributes<Periodo>> {
  declare id: CreationOptional<number>;
  declare hora_inicio: string;
  declare hora_fin: string;
}

Periodo.init(
  {
    id:          { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    hora_inicio: { type: DataTypes.TIME, allowNull: false },
    hora_fin:    { type: DataTypes.TIME, allowNull: false },
  },
  { sequelize, tableName: 'periodo', timestamps: false },
);

export default Periodo;
