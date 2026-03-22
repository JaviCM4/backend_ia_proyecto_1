import { Model, DataTypes, CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';
import sequelize from '../database/connection';

class AsignacionDocente extends Model<InferAttributes<AsignacionDocente>, InferCreationAttributes<AsignacionDocente>> {
  declare id: CreationOptional<number>;
  declare curso_id: number;
  declare docente_id: string;
}

AsignacionDocente.init(
  {
    id:           { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    curso_id: { type: DataTypes.INTEGER, allowNull: false },
    docente_id:   { type: DataTypes.STRING(20), allowNull: false },
  },
  { sequelize, tableName: 'asignacion_docente', timestamps: false },
);

export default AsignacionDocente;
