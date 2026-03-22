import sequelize from './connection';

import '../models/AsignacionDocente';
import '../models/AsignacionHorario';
import '../models/AsignacionSalon';
import '../models/Calendario';
import '../models/Curso';
import '../models/Docente';
import '../models/Laboratorio';
import '../models/Periodo';
import '../models/Salon';
import '../models/Seccion';
import '../models/Solucion';
import '../models/Conflicto';
import '../models/EstadisticaSolucion';
import '../models/index';

// Sincronizar para crear tablas si no existen
sequelize
  .sync({ alter: false })
  .then(() => console.log('✅ Modelos sincronizados con la base de datos.'))
  .catch((err) => console.error('❌ Error al sincronizar modelos:', err));

export default sequelize;