import asyncHandler from 'express-async-handler';
import { AsignacionHorarioService } from '../services/AsignacionHorarioService';

export const getAll = asyncHandler(async (_req, res) => {
  const asignaciones = await AsignacionHorarioService.getAll();
  res.json(asignaciones);
});

export const getById = asyncHandler(async (req, res) => {
  const asignacion = await AsignacionHorarioService.getById(Number(req.params.id));
  res.json(asignacion);
});

export const create = asyncHandler(async (req, res) => {
  const asignacion = await AsignacionHorarioService.create(req.body);
  res.status(201).json(asignacion);
});

export const remove = asyncHandler(async (req, res) => {
  await AsignacionHorarioService.remove(Number(req.params.id));
  res.status(204).send();
});

export const removeAll = asyncHandler(async (_req, res) => {
  await AsignacionHorarioService.removeAll();
  res.status(204).send();
});
