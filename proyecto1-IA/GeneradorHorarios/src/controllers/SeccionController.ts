import asyncHandler from 'express-async-handler';
import { SeccionService } from '../services/SeccionService';

export const create = asyncHandler(async (req, res) => {
  const seccion = await SeccionService.create(req.body);
  res.status(201).json(seccion);
});

export const update = asyncHandler(async (req, res) => {
  const seccion = await SeccionService.update(Number(req.params.id), req.body);
  res.json(seccion);
});

export const setLaboratorio = asyncHandler(async (req, res) => {
  const { id_curso, tiene_laboratorio } = req.body;
  const result = await SeccionService.setLaboratorio(Number(id_curso), Boolean(tiene_laboratorio));
  res.json(result);
});

export const remove = asyncHandler(async (req, res) => {
  await SeccionService.remove(Number(req.params.id));
  res.status(204).send();
});

export const removeAll = asyncHandler(async (_req, res) => {
  await SeccionService.removeAll();
  res.status(204).send();
});
