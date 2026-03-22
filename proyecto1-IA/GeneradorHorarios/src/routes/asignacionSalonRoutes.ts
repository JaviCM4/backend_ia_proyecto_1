import { Router } from 'express';
import * as AsignacionSalonController from '../controllers/AsignacionSalonController';

const router = Router();

router.get   ('/',    AsignacionSalonController.getAll);
router.get   ('/:id', AsignacionSalonController.getById);
router.post  ('/',    AsignacionSalonController.create);
router.delete('/',    AsignacionSalonController.removeAll);
router.delete('/:id', AsignacionSalonController.remove);

export default router;
