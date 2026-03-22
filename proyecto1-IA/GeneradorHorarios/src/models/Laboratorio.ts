import { Model, DataTypes, CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';
import sequelize from '../database/connection';

class Laboratorio extends Model<InferAttributes<Laboratorio>, InferCreationAttributes<Laboratorio>> {
  declare id: CreationOptional<number>;
  declare seccion_id: number;
  declare nombre: string;
  declare estudiantes_asignados: CreationOptional<number>;
  declare no_periodos: number | null;
}

Laboratorio.init(
  {
    id:                    { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    seccion_id:            { type: DataTypes.INTEGER, allowNull: false },
    nombre:                { type: DataTypes.STRING(150), allowNull: false },
    estudiantes_asignados: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
    no_periodos:           { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, tableName: 'laboratorio', timestamps: false },
);

export default Laboratorio;
