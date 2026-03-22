import { DataTypes } from 'sequelize';

/**
 * Funciones helper para definir columnas en migraciones.
 * Evitan la repetición de boilerplate en cada archivo de migración.
 */
export const col = {
  id: () => ({
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false,
  }),

  str: (len: number, allowNull = false) => ({
    type: DataTypes.STRING(len),
    allowNull,
  }),

  char: (len: number, allowNull = false) => ({
    type: DataTypes.CHAR(len),
    allowNull,
  }),

  int: (allowNull = false) => ({
    type: DataTypes.INTEGER,
    allowNull,
  }),

  bool: (defaultValue = false) => ({
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue,
  }),

  time: (allowNull = true) => ({
    type: DataTypes.TIME,
    allowNull,
  }),

  decimal: (p: number, s: number, allowNull = true) => ({
    type: DataTypes.DECIMAL(p, s),
    allowNull,
  }),

  date: (defaultNow = false) => ({
    type: DataTypes.DATE,
    allowNull: true,
    ...(defaultNow && { defaultValue: DataTypes.NOW }),
  }),

  /** FK entera que apunta a otra tabla */
  fk: (model: string, key = 'id', allowNull = false, onDelete = 'CASCADE') => ({
    type: DataTypes.INTEGER,
    allowNull,
    references: { model, key },
    onDelete,
  }),

  /** FK string (ej. docente.registro) */
  fkStr: (model: string, key: string, len = 20, allowNull = true, onDelete = 'CASCADE') => ({
    type: DataTypes.STRING(len),
    allowNull,
    references: { model, key },
    onDelete,
  }),
};
