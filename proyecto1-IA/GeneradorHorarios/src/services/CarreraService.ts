import { Curso } from "../models";

export const listarCarreras = async () => {
    const cursos = await Curso.findAll({
        attributes: ['carrera'],
        group: ['carrera'],
    });
    return cursos.map(c => c.carrera);
}