import { Model, DataTypes, CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';
import sequelize from '../database/connection';

class Solucion extends Model<InferAttributes<Solucion>, InferCreationAttributes<Solucion>> {
  declare id: CreationOptional<number>;
  declare generacion: number;
  declare aptitud: number | null;
  declare fecha_creacion: CreationOptional<Date>;
}

Solucion.init(
  {
    id:             { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    generacion:     { type: DataTypes.INTEGER, allowNull: false },
    aptitud:        { type: DataTypes.DECIMAL(10, 4), allowNull: true },
    fecha_creacion: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: 'solucion', timestamps: false },
);

export default Solucion;
