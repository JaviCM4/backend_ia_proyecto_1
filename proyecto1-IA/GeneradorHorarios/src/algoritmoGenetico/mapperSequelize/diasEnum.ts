// Mapeo DiaEnum → días reales de la semana que representa
// LXV = lunes, miercoles, viernes (teoría)
// M   = martes (laboratorio)

import { DiaEnum } from "../../types/enums";
import { DiaSemana } from "../types/Domain.types";

// J   = jueves (laboratorio)
export const DIAS_POR_ENUM: Record<DiaEnum, DiaSemana[]> = {
  [DiaEnum.LXV]: ['lunes', 'miercoles', 'viernes'],
  [DiaEnum.M]:   ['martes'],
  [DiaEnum.J]:   ['jueves'],
};
