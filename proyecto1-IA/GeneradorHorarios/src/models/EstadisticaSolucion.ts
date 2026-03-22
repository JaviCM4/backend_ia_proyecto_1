import { Model, DataTypes, CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';
import sequelize from '../database/connection';

class EstadisticaSolucion extends Model<InferAttributes<EstadisticaSolucion>, InferCreationAttributes<EstadisticaSolucion>> {
    declare id: CreationOptional<number>;
    declare solucion_id: number;
    declare tiempo_ejecucion: string;
    declare generaciones_ejecutadas: number;
    declare cantidad_conflictos: number;
    declare memoria_usada_bytes: string;
    declare porcentaje_cursos_continuos: string;
}

EstadisticaSolucion.init(
  {
    id:           { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    solucion_id: { type: DataTypes.INTEGER, allowNull: false },
    tiempo_ejecucion:   { type: DataTypes.STRING(100), allowNull: false },
    generaciones_ejecutadas:   { type: DataTypes.INTEGER, allowNull: false },
    cantidad_conflictos:   { type: DataTypes.INTEGER, allowNull: false },
    memoria_usada_bytes:   { type: DataTypes.STRING(100), allowNull: false },
    porcentaje_cursos_continuos:   { type: DataTypes.STRING(100), allowNull: false },
  },
  { sequelize, tableName: 'estadistica_conflicto', timestamps: false },
);

export default EstadisticaSolucion;
