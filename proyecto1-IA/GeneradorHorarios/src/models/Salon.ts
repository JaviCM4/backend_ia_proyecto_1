import { Model, DataTypes, CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';
import sequelize from '../database/connection';
import { TipoSalonEnum } from '../types/enums';

class Salon extends Model<InferAttributes<Salon>, InferCreationAttributes<Salon>> {
  declare id: CreationOptional<number>;
  declare tipo_salon: TipoSalonEnum;
  declare nombre: string;
  declare capacidad: number;
  declare solo_tarde: CreationOptional<boolean>;
  declare habilitado_teorica: CreationOptional<boolean>;
}

Salon.init(
  {
    id:                 { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tipo_salon:         { type: DataTypes.ENUM(...Object.values(TipoSalonEnum)), allowNull: false },
    nombre:             { type: DataTypes.STRING(50), allowNull: false, unique: true },
    capacidad:          { type: DataTypes.INTEGER, allowNull: false },
    solo_tarde:         { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    habilitado_teorica: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, tableName: 'salon', timestamps: false },
);

export default Salon;
