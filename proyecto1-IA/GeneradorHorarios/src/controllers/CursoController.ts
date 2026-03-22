import asyncHandler from 'express-async-handler';
import { CursoService } from '../services/CursoService';
import { CarreraEnum } from '../types/enums';

export const getAll = asyncHandler(async (req, res) => {
  const { carrera } = req.query;
  const cursos = carrera
    ? await CursoService.getByCarrera(carrera as CarreraEnum)
    : await CursoService.getAll();
  res.json(cursos);
});

export const getAllConSecciones = asyncHandler(async (_req, res) => {
  const cursos = await CursoService.getAllConSecciones();
  res.json(cursos);
});

export const getById = asyncHandler(async (req, res) => {
  const curso = await CursoService.getById(Number(req.params.id));
  res.json(curso);
});

export const create = asyncHandler(async (req, res) => {
  const curso = await CursoService.create(req.body);
  res.status(201).json(curso);
});

export const update = asyncHandler(async (req, res) => {
  const curso = await CursoService.update(Number(req.params.id), req.body);
  res.json(curso);
});

export const remove = asyncHandler(async (req, res) => {
  await CursoService.remove(Number(req.params.id));
  res.status(204).send();
});

export const removeAll = asyncHandler(async (_req, res) => {
  await CursoService.removeAll();
  res.status(204).send();
});

export const importFromCSV = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Se requiere un archivo CSV (campo "file")' });
    return;
  }
  const content = req.file.buffer.toString('utf-8');
  const result = await CursoService.importFromCSV(content);
  res.json(result);
});
