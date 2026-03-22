import { Request, Response, NextFunction } from 'express';
import { ValidationError, UniqueConstraintError, ForeignKeyConstraintError } from 'sequelize';
import { NotFoundError, ConflictError } from '../exceptions/ApiExceptions';

export const errorHandler = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  // 404 — recurso no encontrado
  if (err instanceof NotFoundError) {
    return res.status(404).json({ error: err.message });
  }

  // 409 — tupla duplicada (validación de negocio)
  if (err instanceof ConflictError) {
    return res.status(409).json({ error: err.message });
  }

  // 400 — datos inválidos o campos faltantes (validación de Sequelize)
  if (err instanceof ValidationError) {
    const mensajes = err.errors.map(e => e.message);
    return res.status(400).json({ error: 'Datos inválidos', detalles: mensajes });
  }

  // 400 — valor duplicado (unique constraint)
  if (err instanceof UniqueConstraintError) {
    const campos = err.errors.map(e => e.path).join(', ');
    return res.status(400).json({ error: `Ya existe un registro con el mismo valor en: ${campos}` });
  }

  // 400 — FK que no existe en la tabla referenciada
  if (err instanceof ForeignKeyConstraintError) {
    return res.status(400).json({ error: 'El registro referenciado no existe' });
  }

  console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor' });
};