import { Request, Response } from "express";
import { listarCarreras } from "../services/CarreraService";

export const getCarreras = async (request: Request, response: Response) => {
    try {
        response.json(await listarCarreras());
    } catch (error) {
        response.status(500).json({ error: 'Error al listar carreras' });
    }
}