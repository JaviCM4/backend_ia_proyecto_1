import { Router } from 'express';
import * as AsignacionDocenteController from '../controllers/AsignacionDocenteController';
import { uploadCSV } from '../middlewares/upload';

const router = Router();

router.get   ('/',           AsignacionDocenteController.getAll);
router.get   ('/:id',        AsignacionDocenteController.getById);
router.post  ('/',           AsignacionDocenteController.create);
router.post  ('/import-csv', uploadCSV.single('file'), AsignacionDocenteController.importFromCSV);
router.delete('/',           AsignacionDocenteController.removeAll);
router.delete('/:id',        AsignacionDocenteController.remove);

export default router;
