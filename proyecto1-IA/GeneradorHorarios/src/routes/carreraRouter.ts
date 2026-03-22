import { Router } from "express";
import { getCarreras } from "../controllers/CarreraController";

const router = Router();

router.get('/', getCarreras);

export default router;