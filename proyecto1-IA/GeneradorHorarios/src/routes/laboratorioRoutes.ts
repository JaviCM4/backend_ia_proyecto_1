import { Router } from 'express';
import * as LaboratorioController from '../controllers/LaboratorioController';

const router = Router();

router.get('/:id', LaboratorioController.getById);
router.put('/:id', LaboratorioController.update);

export default router;
