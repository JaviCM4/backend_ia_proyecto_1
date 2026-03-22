import asyncHandler from 'express-async-handler';
import { AsignacionDocenteService } from '../services/AsignacionDocenteService';

export const getAll = asyncHandler(async (_req, res) => {
  const asignaciones = await AsignacionDocenteService.getAll();
  res.json(asignaciones);
});

export const getById = asyncHandler(async (req, res) => {
  const asignacion = await AsignacionDocenteService.getById(Number(req.params.id));
  res.json(asignacion);
});

export const create = asyncHandler(async (req, res) => {
  const asignacion = await AsignacionDocenteService.create(req.body);
  res.status(201).json(asignacion);
});

export const remove = asyncHandler(async (req, res) => {
  await AsignacionDocenteService.remove(Number(req.params.id));
  res.status(204).send();
});

export const removeAll = asyncHandler(async (_req, res) => {
  await AsignacionDocenteService.removeAll();
  res.status(204).send();
});

export const importFromCSV = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Se requiere un archivo CSV' });
    return;
  }
  const result = await AsignacionDocenteService.importFromCSV(req.file.buffer.toString('utf-8'));
  res.json(result);
});
