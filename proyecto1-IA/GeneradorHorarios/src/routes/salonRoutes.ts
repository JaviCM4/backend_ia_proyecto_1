import { Router } from 'express';
import * as SalonController from '../controllers/SalonController';
import { uploadCSV } from '../middlewares/upload';

const router = Router();

router.get(   '/',             SalonController.getAll);
router.get(   '/:id',          SalonController.getById);
router.post(  '/',             SalonController.create);
router.post(  '/import-csv',   uploadCSV.single('file'), SalonController.importFromCSV);
router.put(   '/:id',          SalonController.update);
router.delete('/',             SalonController.removeAll);
router.delete('/:id',          SalonController.remove);

export default router;
