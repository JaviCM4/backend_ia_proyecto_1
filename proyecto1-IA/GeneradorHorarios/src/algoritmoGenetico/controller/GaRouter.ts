import { Router } from 'express';
import { ejecutar, obtenerEstado, cancelar, ejecutarGa } from './GaController';
import { obtenerUltimaSolucion, solucionPorId } from './GaController';
 
const router = Router();
 
// Lanza el job → responde { jobId } en < 50ms
router.post('/ejecutar', ejecutar);
 
// Polling del cliente → responde estado actual en < 10ms
router.get('/estado/:jobId', obtenerEstado);
 
// Cancelar job
router.delete('/cancelar/:jobId', cancelar);

router.get('/ultima-solucion', obtenerUltimaSolucion);
router.get('/solucion/:id', solucionPorId);

export default router;