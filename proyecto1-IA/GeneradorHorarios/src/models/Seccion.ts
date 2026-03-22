import { Model, DataTypes, CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';
import sequelize from '../database/connection';

class Seccion extends Model<InferAttributes<Seccion>, InferCreationAttributes<Seccion>> {
  declare id: CreationOptional<number>;
  declare curso_id: number;
  declare letra: string;
  declare estudiantes_asignados: CreationOptional<number>;
}

Seccion.init(
  {
    id:                    { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    curso_id:              { type: DataTypes.INTEGER, allowNull: false },
    letra:                 { type: DataTypes.CHAR(1), allowNull: false },
    estudiantes_asignados: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
  },
  {
    sequelize,
    tableName: 'seccion',
    timestamps: false,
    indexes: [{ unique: true, fields: ['curso_id', 'letra'] }],
  },
);

export default Seccion;
