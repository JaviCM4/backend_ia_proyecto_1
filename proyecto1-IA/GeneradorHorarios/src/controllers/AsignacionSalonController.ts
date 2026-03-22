import asyncHandler from 'express-async-handler';
import { AsignacionSalonService } from '../services/AsignacionSalonService';

export const getAll = asyncHandler(async (_req, res) => {
  const asignaciones = await AsignacionSalonService.getAll();
  res.json(asignaciones);
});

export const getById = asyncHandler(async (req, res) => {
  const asignacion = await AsignacionSalonService.getById(Number(req.params.id));
  res.json(asignacion);
});

export const create = asyncHandler(async (req, res) => {
  const asignacion = await AsignacionSalonService.create(req.body);
  res.status(201).json(asignacion);
});

export const remove = asyncHandler(async (req, res) => {
  await AsignacionSalonService.remove(Number(req.params.id));
  res.status(204).send();
});

export const removeAll = asyncHandler(async (_req, res) => {
  await AsignacionSalonService.removeAll();
  res.status(204).send();
});
