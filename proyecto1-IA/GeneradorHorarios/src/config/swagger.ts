import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title:       'Generador de Horarios API',
      version:     '1.0.0',
      description: 'API REST para la gestión de cursos, docentes, salones y asignaciones del generador de horarios',
    },
    components: {
      schemas: {

        // ─── Enumeraciones ──────────────────────────────────────────────────
        CarreraEnum: {
          type: 'string',
          enum: ['AREA COMUN', 'ING. SISTEMAS', 'ING. CIVIL', 'ING. MECANICA', 'ING. INDUSTRIAL', 'ING. MECANICA INDUSTRIAL'],
        },
        TipoSalonEnum: {
          type: 'string',
          enum: ['NORMAL', 'LABORATORIO', 'SALON', 'CANCHA'],
        },
        TipoAsignacionEnum: {
          type: 'string',
          enum: ['CLASE', 'LABORATORIO'],
        },
        DiaEnum: {
          type: 'string',
          enum: ['LXM', 'M', 'J'],
        },

        // ─── Curso ──────────────────────────────────────────────────────────
        Curso: {
          type: 'object',
          properties: {
            id:             { type: 'integer', readOnly: true },
            carrera:        { $ref: '#/components/schemas/CarreraEnum' },
            codigo:         { type: 'string', example: 'IPC1' },
            nombre:         { type: 'string', example: 'Introducción a la Programación y Computación 1' },
            semestre:       { type: 'integer', nullable: true, example: 1 },
            no_periodos:    { type: 'integer', nullable: true, example: 5 },
            necesita_salon: { type: 'boolean', default: false },
            solo_tarde:     { type: 'boolean', default: false },
            es_obligatorio: { type: 'boolean', default: true },
          },
          required: ['carrera', 'codigo', 'nombre'],
        },
        CursoInput: {
          type: 'object',
          properties: {
            carrera:        { $ref: '#/components/schemas/CarreraEnum' },
            codigo:         { type: 'string', example: 'IPC1' },
            nombre:         { type: 'string', example: 'Introducción a la Programación y Computación 1' },
            semestre:       { type: 'integer', nullable: true },
            no_periodos:    { type: 'integer', nullable: true },
            necesita_salon: { type: 'boolean' },
            solo_tarde:     { type: 'boolean' },
            es_obligatorio: { type: 'boolean' },
          },
          required: ['carrera', 'codigo', 'nombre'],
        },

        // ─── Docente ────────────────────────────────────────────────────────
        Docente: {
          type: 'object',
          properties: {
            registro:     { type: 'string', example: '10121' },
            nombre:       { type: 'string', example: 'Mario Cajas' },
            hora_entrada: { type: 'string', format: 'time', nullable: true, example: '14:30:00' },
            hora_salida:  { type: 'string', format: 'time', nullable: true, example: '20:00:00' },
          },
          required: ['registro', 'nombre'],
        },
        DocenteInput: {
          type: 'object',
          properties: {
            registro:     { type: 'string', example: '10121' },
            nombre:       { type: 'string', example: 'Mario Cajas' },
            hora_entrada: { type: 'string', format: 'time', nullable: true, example: '14:30:00' },
            hora_salida:  { type: 'string', format: 'time', nullable: true, example: '20:00:00' },
          },
          required: ['registro', 'nombre'],
        },

        // ─── Salon ──────────────────────────────────────────────────────────
        Salon: {
          type: 'object',
          properties: {
            id:                 { type: 'integer', readOnly: true },
            tipo_salon:         { $ref: '#/components/schemas/TipoSalonEnum' },
            nombre:             { type: 'string', example: 'Salón 1' },
            capacidad:          { type: 'integer', example: 90 },
            solo_tarde:         { type: 'boolean', default: false },
            habilitado_teorica: { type: 'boolean', default: true },
          },
          required: ['tipo_salon', 'nombre', 'capacidad'],
        },
        SalonInput: {
          type: 'object',
          properties: {
            tipo_salon:         { $ref: '#/components/schemas/TipoSalonEnum' },
            nombre:             { type: 'string', example: 'Salón 1' },
            capacidad:          { type: 'integer', example: 90 },
            solo_tarde:         { type: 'boolean' },
            habilitado_teorica: { type: 'boolean' },
          },
          required: ['tipo_salon', 'nombre', 'capacidad'],
        },

        // ─── AsignacionDocente ───────────────────────────────────────────────
        AsignacionDocente: {
          type: 'object',
          properties: {
            id:         { type: 'integer', readOnly: true },
            curso_id:   { type: 'integer', example: 1 },
            docente_id: { type: 'string', example: '10121' },
          },
          required: ['curso_id', 'docente_id'],
        },

        // ─── AsignacionSalon ─────────────────────────────────────────────────
        AsignacionSalon: {
          type: 'object',
          properties: {
            id:       { type: 'integer', readOnly: true },
            id_salon: { type: 'integer', example: 1 },
            id_curso: { type: 'integer', example: 1 },
          },
          required: ['id_salon', 'id_curso'],
        },

        // ─── AsignacionHorario ───────────────────────────────────────────────
        AsignacionHorario: {
          type: 'object',
          properties: {
            id:         { type: 'integer', readOnly: true },
            curso_id:   { type: 'integer', example: 1 },
            periodo_id: { type: 'integer', example: 1 },
          },
          required: ['curso_id', 'periodo_id'],
        },

        // ─── Respuestas de importación CSV ───────────────────────────────────
        ImportCursoResult: {
          type: 'object',
          properties: {
            cursosCreados:      { type: 'integer' },
            cursosExistentes:   { type: 'integer' },
            seccionesCreadas:   { type: 'integer' },
            seccionesExistentes:{ type: 'integer' },
            errores:            { type: 'array', items: { type: 'string' } },
          },
        },
        ImportDocenteResult: {
          type: 'object',
          properties: {
            docentesCreados:   { type: 'integer' },
            docentesExistentes:{ type: 'integer' },
            errores:           { type: 'array', items: { type: 'string' } },
          },
        },
        ImportSalonResult: {
          type: 'object',
          properties: {
            salonesCreados:   { type: 'integer' },
            salonesExistentes:{ type: 'integer' },
            errores:          { type: 'array', items: { type: 'string' } },
          },
        },

        // ─── Errores genéricos ───────────────────────────────────────────────
        ErrorResponse: {
          type: 'object',
          properties: {
            error:    { type: 'string' },
            detalles: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    paths: {
      // ════════════════════════════════════════════════════════════════════
      // CURSOS
      // ════════════════════════════════════════════════════════════════════
      '/api/cursos': {
        get: {
          tags: ['Cursos'],
          summary: 'Obtener todos los cursos',
          responses: { 200: { description: 'Lista de cursos', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Curso' } } } } } },
        },
        post: {
          tags: ['Cursos'],
          summary: 'Crear un curso',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CursoInput' } } } },
          responses: {
            201: { description: 'Curso creado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Curso' } } } },
            400: { description: 'Datos inválidos', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
        delete: {
          tags: ['Cursos'],
          summary: 'Eliminar todos los cursos',
          responses: { 204: { description: 'Eliminados' } },
        },
      },
      '/api/cursos/{id}': {
        get: {
          tags: ['Cursos'],
          summary: 'Obtener un curso por ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            200: { description: 'Curso encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Curso' } } } },
            404: { description: 'No encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
        put: {
          tags: ['Cursos'],
          summary: 'Actualizar un curso',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CursoInput' } } } },
          responses: {
            200: { description: 'Curso actualizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Curso' } } } },
            404: { description: 'No encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
        delete: {
          tags: ['Cursos'],
          summary: 'Eliminar un curso por ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            204: { description: 'Eliminado' },
            404: { description: 'No encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/cursos/import-csv': {
        post: {
          tags: ['Cursos'],
          summary: 'Importar cursos y secciones desde un CSV',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    file: { type: 'string', format: 'binary', description: 'Archivo CSV de cursos' },
                  },
                  required: ['file'],
                },
              },
            },
          },
          responses: { 200: { description: 'Resultado de la importación', content: { 'application/json': { schema: { $ref: '#/components/schemas/ImportCursoResult' } } } } },
        },
      },

      // ════════════════════════════════════════════════════════════════════
      // DOCENTES
      // ════════════════════════════════════════════════════════════════════
      '/api/docentes': {
        get: {
          tags: ['Docentes'],
          summary: 'Obtener todos los docentes',
          responses: { 200: { description: 'Lista de docentes', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Docente' } } } } } },
        },
        post: {
          tags: ['Docentes'],
          summary: 'Crear un docente',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DocenteInput' } } } },
          responses: {
            201: { description: 'Docente creado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Docente' } } } },
            400: { description: 'Datos inválidos', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
        delete: {
          tags: ['Docentes'],
          summary: 'Eliminar todos los docentes',
          responses: { 204: { description: 'Eliminados' } },
        },
      },
      '/api/docentes/{registro}': {
        get: {
          tags: ['Docentes'],
          summary: 'Obtener un docente por registro',
          parameters: [{ name: 'registro', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            200: { description: 'Docente encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Docente' } } } },
            404: { description: 'No encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
        put: {
          tags: ['Docentes'],
          summary: 'Actualizar un docente',
          parameters: [{ name: 'registro', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DocenteInput' } } } },
          responses: {
            200: { description: 'Docente actualizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Docente' } } } },
            404: { description: 'No encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
        delete: {
          tags: ['Docentes'],
          summary: 'Eliminar un docente por registro',
          parameters: [{ name: 'registro', in: 'path', required: true, schema: { type: 'string' } }],
          responses: {
            204: { description: 'Eliminado' },
            404: { description: 'No encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/docentes/import-csv': {
        post: {
          tags: ['Docentes'],
          summary: 'Importar docentes desde un CSV',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    file: { type: 'string', format: 'binary', description: 'Archivo CSV de docentes' },
                  },
                  required: ['file'],
                },
              },
            },
          },
          responses: { 200: { description: 'Resultado de la importación', content: { 'application/json': { schema: { $ref: '#/components/schemas/ImportDocenteResult' } } } } },
        },
      },

      // ════════════════════════════════════════════════════════════════════
      // SALONES
      // ════════════════════════════════════════════════════════════════════
      '/api/salones': {
        get: {
          tags: ['Salones'],
          summary: 'Obtener todos los salones',
          responses: { 200: { description: 'Lista de salones', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Salon' } } } } } },
        },
        post: {
          tags: ['Salones'],
          summary: 'Crear un salón',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SalonInput' } } } },
          responses: {
            201: { description: 'Salón creado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Salon' } } } },
            400: { description: 'Datos inválidos', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
        delete: {
          tags: ['Salones'],
          summary: 'Eliminar todos los salones',
          responses: { 204: { description: 'Eliminados' } },
        },
      },
      '/api/salones/{id}': {
        get: {
          tags: ['Salones'],
          summary: 'Obtener un salón por ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            200: { description: 'Salón encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Salon' } } } },
            404: { description: 'No encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
        put: {
          tags: ['Salones'],
          summary: 'Actualizar un salón',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SalonInput' } } } },
          responses: {
            200: { description: 'Salón actualizado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Salon' } } } },
            404: { description: 'No encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
        delete: {
          tags: ['Salones'],
          summary: 'Eliminar un salón por ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            204: { description: 'Eliminado' },
            404: { description: 'No encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/api/salones/import-csv': {
        post: {
          tags: ['Salones'],
          summary: 'Importar salones desde un CSV',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    file: { type: 'string', format: 'binary', description: 'Archivo CSV de salones' },
                  },
                  required: ['file'],
                },
              },
            },
          },
          responses: { 200: { description: 'Resultado de la importación', content: { 'application/json': { schema: { $ref: '#/components/schemas/ImportSalonResult' } } } } },
        },
      },

      // ════════════════════════════════════════════════════════════════════
      // ASIGNACIONES DOCENTE
      // ════════════════════════════════════════════════════════════════════
      '/api/asignaciones-docente': {
        get: {
          tags: ['Asignaciones Docente'],
          summary: 'Obtener todas las asignaciones de docente',
          responses: { 200: { description: 'Lista', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/AsignacionDocente' } } } } } },
        },
        post: {
          tags: ['Asignaciones Docente'],
          summary: 'Crear una asignación de docente',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AsignacionDocente' } } } },
          responses: {
            201: { description: 'Creada', content: { 'application/json': { schema: { $ref: '#/components/schemas/AsignacionDocente' } } } },
            400: { description: 'Datos inválidos', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
        delete: {
          tags: ['Asignaciones Docente'],
          summary: 'Eliminar todas las asignaciones de docente',
          responses: { 204: { description: 'Eliminadas' } },
        },
      },
      '/api/asignaciones-docente/{id}': {
        get: {
          tags: ['Asignaciones Docente'],
          summary: 'Obtener una asignación de docente por ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            200: { description: 'Encontrada', content: { 'application/json': { schema: { $ref: '#/components/schemas/AsignacionDocente' } } } },
            404: { description: 'No encontrada', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
        put: {
          tags: ['Asignaciones Docente'],
          summary: 'Actualizar una asignación de docente',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AsignacionDocente' } } } },
          responses: {
            200: { description: 'Actualizada', content: { 'application/json': { schema: { $ref: '#/components/schemas/AsignacionDocente' } } } },
            404: { description: 'No encontrada', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
        delete: {
          tags: ['Asignaciones Docente'],
          summary: 'Eliminar una asignación de docente',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            204: { description: 'Eliminada' },
            404: { description: 'No encontrada', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },

      // ════════════════════════════════════════════════════════════════════
      // ASIGNACIONES SALON
      // ════════════════════════════════════════════════════════════════════
      '/api/asignaciones-salon': {
        get: {
          tags: ['Asignaciones Salón'],
          summary: 'Obtener todas las asignaciones de salón',
          responses: { 200: { description: 'Lista', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/AsignacionSalon' } } } } } },
        },
        post: {
          tags: ['Asignaciones Salón'],
          summary: 'Crear una asignación de salón',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AsignacionSalon' } } } },
          responses: {
            201: { description: 'Creada', content: { 'application/json': { schema: { $ref: '#/components/schemas/AsignacionSalon' } } } },
            400: { description: 'Datos inválidos', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
        delete: {
          tags: ['Asignaciones Salón'],
          summary: 'Eliminar todas las asignaciones de salón',
          responses: { 204: { description: 'Eliminadas' } },
        },
      },
      '/api/asignaciones-salon/{id}': {
        get: {
          tags: ['Asignaciones Salón'],
          summary: 'Obtener una asignación de salón por ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            200: { description: 'Encontrada', content: { 'application/json': { schema: { $ref: '#/components/schemas/AsignacionSalon' } } } },
            404: { description: 'No encontrada', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
        put: {
          tags: ['Asignaciones Salón'],
          summary: 'Actualizar una asignación de salón',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AsignacionSalon' } } } },
          responses: {
            200: { description: 'Actualizada', content: { 'application/json': { schema: { $ref: '#/components/schemas/AsignacionSalon' } } } },
            404: { description: 'No encontrada', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
        delete: {
          tags: ['Asignaciones Salón'],
          summary: 'Eliminar una asignación de salón',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            204: { description: 'Eliminada' },
            404: { description: 'No encontrada', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },

      // ════════════════════════════════════════════════════════════════════
      // ASIGNACIONES HORARIO
      // ════════════════════════════════════════════════════════════════════
      '/api/asignaciones-horario': {
        get: {
          tags: ['Asignaciones Horario'],
          summary: 'Obtener todas las asignaciones de horario',
          responses: { 200: { description: 'Lista', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/AsignacionHorario' } } } } } },
        },
        post: {
          tags: ['Asignaciones Horario'],
          summary: 'Crear una asignación de horario',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AsignacionHorario' } } } },
          responses: {
            201: { description: 'Creada', content: { 'application/json': { schema: { $ref: '#/components/schemas/AsignacionHorario' } } } },
            400: { description: 'Datos inválidos', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
        delete: {
          tags: ['Asignaciones Horario'],
          summary: 'Eliminar todas las asignaciones de horario',
          responses: { 204: { description: 'Eliminadas' } },
        },
      },
      '/api/asignaciones-horario/{id}': {
        get: {
          tags: ['Asignaciones Horario'],
          summary: 'Obtener una asignación de horario por ID',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            200: { description: 'Encontrada', content: { 'application/json': { schema: { $ref: '#/components/schemas/AsignacionHorario' } } } },
            404: { description: 'No encontrada', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
        put: {
          tags: ['Asignaciones Horario'],
          summary: 'Actualizar una asignación de horario',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/AsignacionHorario' } } } },
          responses: {
            200: { description: 'Actualizada', content: { 'application/json': { schema: { $ref: '#/components/schemas/AsignacionHorario' } } } },
            404: { description: 'No encontrada', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
        delete: {
          tags: ['Asignaciones Horario'],
          summary: 'Eliminar una asignación de horario',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: {
            204: { description: 'Eliminada' },
            404: { description: 'No encontrada', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
    },
  },
  apis: [], // Toda la documentación está definida arriba, no se usan anotaciones JSDoc
};

export const swaggerSpec = swaggerJsdoc(options);
