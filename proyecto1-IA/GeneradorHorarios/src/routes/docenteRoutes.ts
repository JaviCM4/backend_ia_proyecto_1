import { Router } from 'express';
import * as DocenteController from '../controllers/DocenteController';
import { uploadCSV } from '../middlewares/upload';

const router = Router();

router.get   ('/',              DocenteController.getAll);
router.get   ('/:registro',     DocenteController.getById);
router.post  ('/',              DocenteController.create);
router.post  ('/import-csv',    uploadCSV.single('file'), DocenteController.importFromCSV);
router.put   ('/:registro',     DocenteController.update);
router.delete('/',              DocenteController.removeAll);
router.delete('/:registro',     DocenteController.remove);

export default router;
