import { Model, DataTypes, InferAttributes, InferCreationAttributes } from 'sequelize';
import sequelize from '../database/connection';

class Docente extends Model<InferAttributes<Docente>, InferCreationAttributes<Docente>> {
  declare registro: string;
  declare nombre: string;
  declare hora_entrada: string | null;
  declare hora_salida: string | null;
}

Docente.init(
  {
    registro:     { type: DataTypes.STRING(20), primaryKey: true, allowNull: false },
    nombre:       { type: DataTypes.STRING(100), allowNull: false },
    hora_entrada: { type: DataTypes.TIME, allowNull: true },
    hora_salida:  { type: DataTypes.TIME, allowNull: true },
  },
  { sequelize, tableName: 'docente', timestamps: false },
);

export default Docente;
