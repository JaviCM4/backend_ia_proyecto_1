import { Model, DataTypes, CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';
import sequelize from '../database/connection';
import { CarreraEnum } from '../types/enums';

class Curso extends Model<InferAttributes<Curso>, InferCreationAttributes<Curso>> {
  declare id: CreationOptional<number>;
  declare carrera: CarreraEnum;
  declare codigo: string;
  declare nombre: string;
  declare semestre: number | null;
  declare no_periodos: number | null;
  declare necesita_salon: CreationOptional<boolean>;
  declare solo_tarde: CreationOptional<boolean>;
  declare es_obligatorio: CreationOptional<boolean>;
}

Curso.init(
  {
    id:             { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    carrera:        { type: DataTypes.ENUM(...Object.values(CarreraEnum)), allowNull: false },
    codigo:         { type: DataTypes.STRING(20), allowNull: false, unique: true },
    nombre:         { type: DataTypes.STRING(100), allowNull: false },
    semestre:       { type: DataTypes.INTEGER, allowNull: true },
    no_periodos:    { type: DataTypes.INTEGER, allowNull: true },
    necesita_salon: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    solo_tarde:     { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    es_obligatorio: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, tableName: 'curso', timestamps: false },
);

export default Curso;
