import asyncHandler from 'express-async-handler';
import { SalonService } from '../services/SalonService';

export const getAll = asyncHandler(async (_req, res) => {
  const salones = await SalonService.getAll();
  res.json(salones);
});

export const getById = asyncHandler(async (req, res) => {
  const salon = await SalonService.getById(Number(req.params.id));
  res.json(salon);
});

export const create = asyncHandler(async (req, res) => {
  const salon = await SalonService.create(req.body);
  res.status(201).json(salon);
});

export const update = asyncHandler(async (req, res) => {
  const salon = await SalonService.update(Number(req.params.id), req.body);
  res.json(salon);
});

export const remove = asyncHandler(async (req, res) => {
  await SalonService.remove(Number(req.params.id));
  res.status(204).send();
});

export const removeAll = asyncHandler(async (_req, res) => {
  await SalonService.removeAll();
  res.status(204).send();
});

export const importFromCSV = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Se requiere un archivo CSV (campo "file")' });
    return;
  }
  const content = req.file.buffer.toString('utf-8');
  const result = await SalonService.importFromCSV(content);
  res.json(result);
});
