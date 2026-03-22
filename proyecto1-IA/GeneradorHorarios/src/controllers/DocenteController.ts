import asyncHandler from 'express-async-handler';
import { DocenteService } from '../services/DocenteService';

export const getAll = asyncHandler(async (_req, res) => {
  const docentes = await DocenteService.getAll();
  res.json(docentes);
});

export const getById = asyncHandler(async (req, res) => {
  const docente = await DocenteService.getById(String(req.params.registro));
  res.json(docente);
});

export const create = asyncHandler(async (req, res) => {
  const docente = await DocenteService.create(req.body);
  res.status(201).json(docente);
});

export const update = asyncHandler(async (req, res) => {
  const docente = await DocenteService.update(String(req.params.registro), req.body);
  res.json(docente);
});

export const remove = asyncHandler(async (req, res) => {
  await DocenteService.remove(String(req.params.registro));
  res.status(204).send();
});

export const removeAll = asyncHandler(async (_req, res) => {
  await DocenteService.removeAll();
  res.status(204).send();
});

export const importFromCSV = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Se requiere un archivo CSV (campo "file")' });
    return;
  }
  const content = req.file.buffer.toString('utf-8');
  const result = await DocenteService.importFromCSV(content);
  res.json(result);
});
