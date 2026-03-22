import { Model, DataTypes, CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';
import sequelize from '../database/connection';

class Conflicto extends Model<InferAttributes<Conflicto>, InferCreationAttributes<Conflicto>> {
  declare id: CreationOptional<number>;
  declare solucion_id: number;
  declare tipo: string;
  declare descripcion: string;
}

Conflicto.init(
  {
    id:           { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    solucion_id: { type: DataTypes.INTEGER, allowNull: false },
    tipo:   { type: DataTypes.STRING(100), allowNull: false },
    descripcion:   { type: DataTypes.STRING(255), allowNull: false },
  },
  { sequelize, tableName: 'conflicto', timestamps: false },
);

export default Conflicto;
