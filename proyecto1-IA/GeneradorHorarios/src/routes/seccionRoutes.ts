import { Router } from 'express';
import * as SeccionController from '../controllers/SeccionController';

const router = Router();

// POST  /api/secciones          - Crear sección
// PUT   /api/secciones/:id      - Actualizar datos de la sección
// PUT   /api/secciones/laboratorio - Activar/desactivar laboratorio por curso
// DELETE /api/secciones/:id     - Eliminar sección
// DELETE /api/secciones         - Eliminar todas

router.post  ('/',             SeccionController.create);
router.put   ('/laboratorio',  SeccionController.setLaboratorio);
router.put   ('/:id',          SeccionController.update);
router.delete('/',             SeccionController.removeAll);
router.delete('/:id',          SeccionController.remove);

export default router;
