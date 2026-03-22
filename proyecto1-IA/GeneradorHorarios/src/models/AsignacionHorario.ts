import { Model, DataTypes, CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';
import sequelize from '../database/connection';

class AsignacionHorario extends Model<InferAttributes<AsignacionHorario>, InferCreationAttributes<AsignacionHorario>> {
  declare id: CreationOptional<number>;
  declare curso_id: number;
  declare periodo_id: number;
}

AsignacionHorario.init(
  {
    id:           { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    curso_id: { type: DataTypes.INTEGER, allowNull: false },
    periodo_id:   { type: DataTypes.INTEGER, allowNull: false },
  },
  { sequelize, tableName: 'asignacion_horario', timestamps: false },
);

export default AsignacionHorario;
