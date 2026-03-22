import { Router } from 'express';
import * as CursoController from '../controllers/CursoController';
import { uploadCSV } from '../middlewares/upload';

const router = Router();

router.get   ('/',              CursoController.getAll);
router.get   ('/con-secciones', CursoController.getAllConSecciones);
router.get   ('/:id',           CursoController.getById);
router.post  ('/',            CursoController.create);
router.post  ('/import-csv',  uploadCSV.single('file'), CursoController.importFromCSV);
router.put   ('/:id',         CursoController.update);
router.delete('/',            CursoController.removeAll);
router.delete('/:id',         CursoController.remove);

export default router;
