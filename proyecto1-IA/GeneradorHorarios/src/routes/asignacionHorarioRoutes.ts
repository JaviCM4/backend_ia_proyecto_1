import { Router } from 'express';
import * as AsignacionHorarioController from '../controllers/AsignacionHorarioController';

const router = Router();

router.get   ('/',    AsignacionHorarioController.getAll);
router.get   ('/:id', AsignacionHorarioController.getById);
router.post  ('/',    AsignacionHorarioController.create);
router.delete('/',    AsignacionHorarioController.removeAll);
router.delete('/:id', AsignacionHorarioController.remove);

export default router;
