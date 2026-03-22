import asyncHandler from 'express-async-handler';
import { LaboratorioService } from '../services/LaboratorioService';

export const getById = asyncHandler(async (req, res) => {
  const lab = await LaboratorioService.getById(Number(req.params.id));
  res.json(lab);
});

export const update = asyncHandler(async (req, res) => {
  const lab = await LaboratorioService.update(Number(req.params.id), req.body);
  res.json(lab);
});
