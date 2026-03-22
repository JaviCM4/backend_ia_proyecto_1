import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import sequelize from '../database/connection';
import sinchronize from '../database/sincronizar';
import '../models';
import { swaggerSpec } from '../config/swagger';
import cursoRoutes              from '../routes/cursoRoutes';
import docenteRoutes            from '../routes/docenteRoutes';
import salonRoutes              from '../routes/salonRoutes';
import asignacionDocenteRoutes  from '../routes/asignacionDocenteRoutes';
import asignacionSalonRoutes    from '../routes/asignacionSalonRoutes';
import asignacionHorarioRoutes  from '../routes/asignacionHorarioRoutes';
import seccionRoutes            from '../routes/seccionRoutes';
import laboratorioRoutes        from '../routes/laboratorioRoutes';
import gaRouter                 from '../algoritmoGenetico/controller/GaRouter';
import carrerasRoutes           from '../routes/carreraRouter';
import { errorHandler } from '../middlewares/errorHandler';

class Server {
  public app: Application;
  public puerto: string;

  constructor() {
    this.app = express();
    this.puerto = process.env.PORT || '8080';
    this.middlewares();
    this.routes();
    this.dbConnection();
    //this.sinchronize();
    this.listen();
    this.app.use(cors({
      origin: ['*'],
      exposedHeaders: ['Authorization', 'authorization'],
    }));
  }

  private middlewares(): void {
    this.app.use(express.json());
    this.app.use(cors());
  }

  private routes(): void {
    this.app.get('/', (req: Request, res: Response) => {
      res.json({ msg: 'api corriendo... 🚀' });
    });
    this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    this.app.use('/api/cursos',               cursoRoutes);
    this.app.use('/api/docentes',              docenteRoutes);
    this.app.use('/api/salones',               salonRoutes);
    this.app.use('/api/asignaciones-docente',  asignacionDocenteRoutes);
    this.app.use('/api/asignaciones-salon',    asignacionSalonRoutes);
    this.app.use('/api/asignaciones-horario',  asignacionHorarioRoutes);
    this.app.use('/api/secciones',             seccionRoutes);
    this.app.use('/api/laboratorios',           laboratorioRoutes);
    this.app.use('/api/carreras',             carrerasRoutes);
    this.app.use('/api/ga', gaRouter);
    this.app.use(errorHandler);
  }

  private async sinchronize(): Promise<void> {
    try {
      //await sinchronize;
      console.log('Modelos sincronizados con la base de datos');
    } catch (error) {
      console.error('Error al sincronizar los modelos:', error);
    }
  }

  private async dbConnection(): Promise<void> {
    try {
      await sequelize.authenticate();
      console.log('Conectado a la base de datos');
    } catch (error) {
      console.error('Error al conectar con la base de datos:', error);
    }
  }

  private listen(): void {
    this.app.listen(this.puerto, () => {
      console.log(`Servidor corriendo en el puerto localhost:${this.puerto}`);
    });
  }
}

export default Server;
