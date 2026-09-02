/* =========================================================================
   FLUJO DE CHECK-IN
   -------------------------------------------------------------------------
   Responsabilidad unica: llevar el estado del check-in y las reglas que lo
   gobiernan (ventana horaria, cargos por equipaje, cuando corresponde pedir
   la autorizacion de un menor, cuando hay que derivar a mostrador).

   No toca el DOM. Todo lo que la UI necesita sale de `obtenerVista()`.

   IMPORTANTE: es una simulacion. Aca no se valida ninguna identidad real, no
   se lee ningun documento y no se cobra nada de verdad. Las esperas son
   setTimeout y los resultados salen de CONFIG, no de un servicio externo.

   Pasos internos:
     identificacion -> vuelo -> equipaje -> [pago] -> [menor] -> restricciones -> pase
     y, desde cualquiera de ellos, la salida alternativa: mostrador
   ========================================================================= */

window.APP = window.APP || {};

APP.crearFlujoCheckin = function () {
  'use strict';

  var DATOS = APP.checkinDatos;
  var CONFIG = DATOS.CONFIG;
  var MIN = APP.tiempo.MINUTO;

  /* Grupos que ve el pasajero en la barra de progreso. Varios pasos internos
     caen en el mismo grupo para que la barra no salte segun el caso. */
  var GRUPOS = [
    { id: 'identidad',  titulo: 'Identidad' },
    { id: 'vuelo',      titulo: 'Vuelo' },
    { id: 'equipaje',   titulo: 'Equipaje' },
    { id: 'documentos', titulo: 'Documentos' },
    { id: 'pase',       titulo: 'Pase' }
  ];

  var GRUPO_DE_PASO = {
    identificacion: 'identidad',
    vuelo: 'vuelo',
    equipaje: 'equipaje',
    pago: 'equipaje',
    menor: 'documentos',
    restricciones: 'documentos',
    pase: 'pase'
  };

  var suscriptores = [];
  var temporizador = null;
  var estado;

  function estadoInicial() {
    return {
      paso: 'identificacion',
      direccion: 'avanza',      // la usa la UI para saber hacia donde animar
      ocupado: false,           // hay una espera simulada en curso
      mensajeOcupado: '',
      error: null,              // error puntual del paso actual
      intentosIdentidad: 0,

      reserva: null,

      declaraciones: {
        viajaConMenor: false,
        menorConAmbosPadres: null,   // null = todavia no responde
        autorizacion: null           // { nombre } cuando se "adjunta"
      },

      equipaje: {
        mano: 1,
        manoNoCabe: false,
        despachadas: []              // pesos en kg, uno por maleta
      },

      pago: {
        medio: 'cuenta',
        estado: 'pendiente',         // pendiente | procesando | pagado | rechazado
        intentos: 0,
        simularRechazo: false        // interruptor de demo, no una funcion real
      },

      pase: null,
      mostrador: null                // { titulo, motivo, sugerencia }
    };
  }

  /* ---------- Emision de cambios ---------- */
  function emitir() {
    var vista = obtenerVista();
    suscriptores.forEach(function (cb) { cb(vista); });
  }

  function irA(paso, direccion) {
    estado.paso = paso;
    estado.direccion = direccion || 'avanza';
    estado.error = null;
    emitir();
  }

  /** Espera simulada: bloquea la pantalla, muestra un mensaje y luego sigue. */
  function esperar(ms, mensaje, alTerminar) {
    estado.ocupado = true;
    estado.mensajeOcupado = mensaje;
    estado.error = null;
    emitir();

    clearTimeout(temporizador);
    temporizador = setTimeout(function () {
      estado.ocupado = false;
      estado.mensajeOcupado = '';
      alTerminar();
    }, ms);
  }

  function aMostrador(titulo, motivo, sugerencia) {
    estado.mostrador = { titulo: titulo, motivo: motivo, sugerencia: sugerencia };
    irA('mostrador', 'avanza');
  }

  /* ---------- Reglas de equipaje ----------
     Funcion pura: mismas entradas, mismo resultado. Aca vive toda la politica
     de cobro, que es justo lo que hay que ajustar cuando el cliente confirme
     sus limites reales. */
  function calcularCargos(equipaje, franquicia) {
    var detalle = [];
    var bloqueos = [];

    equipaje.despachadas.forEach(function (kg, i) {
      var numero = i + 1;
      var incluida = i < franquicia.despachadas;

      if (!incluida) {
        detalle.push({
          concepto: 'Maleta adicional (N&deg; ' + numero + ')',
          nota: 'La reserva incluye ' + franquicia.despachadas + ' maleta(s) despachada(s)',
          monto: CONFIG.TARIFA_MALETA_EXTRA
        });
      }

      if (kg > CONFIG.DESPACHADA_PESO_TOPE_KG) {
        // Sobre el tope no es cuestion de pagar: no se puede despachar asi.
        bloqueos.push(
          'La maleta N&deg; ' + numero + ' pesa ' + kg + ' kg y supera el tope de ' +
          CONFIG.DESPACHADA_PESO_TOPE_KG + ' kg por pieza.'
        );
      } else if (kg > CONFIG.DESPACHADA_PESO_MAX_KG) {
        var exceso = Math.ceil(kg - CONFIG.DESPACHADA_PESO_MAX_KG);
        detalle.push({
          concepto: 'Exceso de peso (maleta N&deg; ' + numero + ')',
          nota: exceso + ' kg sobre los ' + CONFIG.DESPACHADA_PESO_MAX_KG + ' kg incluidos',
          monto: exceso * CONFIG.TARIFA_EXCESO_KG
        });
      }
    });

    // Todo lo de mano que no cumple pasa a bodega: es la version digital del
    // gabinete medidor que hoy se usa en el mostrador.
    var piezasABodega = Math.max(0, equipaje.mano - franquicia.mano) + (equipaje.manoNoCabe ? 1 : 0);
    if (piezasABodega > 0) {
      detalle.push({
        concepto: 'Equipaje de mano enviado a bodega',
        nota: piezasABodega + ' pieza(s) fuera de la medida ' + CONFIG.MANO_MEDIDAS_CM + ' cm',
        monto: piezasABodega * CONFIG.TARIFA_MANO_A_BODEGA
      });
    }

    var total = detalle.reduce(function (acc, d) { return acc + d.monto; }, 0);

    return {
      detalle: detalle,
      total: total,
      bloqueos: bloqueos,
      piezasABodega: piezasABodega
    };
  }

  /* ---------- Reglas de documentacion ---------- */
  function requiereAutorizacionMenor() {
    if (!estado.declaraciones.viajaConMenor) return false;
    // Solo cuando el pasajero declara que el menor NO viaja con ambos padres.
    return estado.declaraciones.menorConAmbosPadres === false;
  }

  function autorizacionResuelta() {
    if (!estado.declaraciones.viajaConMenor) return true;
    // Mientras no responda la pregunta, el paso no esta resuelto.
    if (estado.declaraciones.menorConAmbosPadres === null) return false;
    if (!requiereAutorizacionMenor()) return true;
    return Boolean(estado.declaraciones.autorizacion);
  }

  /* ---------- Generacion del pase (simulada) ---------- */
  function generarPase() {
    var r = estado.reserva;
    var cargos = calcularCargos(estado.equipaje, r.franquicia);
    var piezasDespachadas = estado.equipaje.despachadas.length + cargos.piezasABodega;

    var etiquetas = [];
    for (var i = 0; i < piezasDespachadas; i++) {
      etiquetas.push({
        numero: 'AN ' + String(100000 + Math.floor(Math.random() * 899999)),
        destino: r.vuelo.destino,
        // Solo las primeras corresponden a maletas declaradas con peso.
        peso: i < estado.equipaje.despachadas.length ? estado.equipaje.despachadas[i] : null
      });
    }

    return {
      pasajero: r.pasajero.nombre,
      vuelo: r.vuelo,
      asiento: r.asiento,
      cabina: r.cabina,
      grupoEmbarque: Number(r.asiento.replace(/\D/g, '')) <= 12 ? 'Grupo 1' : 'Grupo 3',
      secuencia: String(Math.floor(Math.random() * 120) + 1).padStart(3, '0'),
      horaEmbarque: r.vuelo.salidaTs - CONFIG.MINUTOS_EMBARQUE * MIN,
      etiquetas: etiquetas,
      menores: r.menores
    };
  }

  /* ---------- Vista para la UI ---------- */
  function obtenerVista() {
    var cargos = estado.reserva
      ? calcularCargos(estado.equipaje, estado.reserva.franquicia)
      : { detalle: [], total: 0, bloqueos: [], piezasABodega: 0 };

    var grupoActual = GRUPO_DE_PASO[estado.paso] || null;
    var indiceGrupo = -1;
    GRUPOS.forEach(function (g, i) { if (g.id === grupoActual) indiceGrupo = i; });

    return {
      paso: estado.paso,
      direccion: estado.direccion,
      ocupado: estado.ocupado,
      mensajeOcupado: estado.mensajeOcupado,
      error: estado.error,

      reserva: estado.reserva,
      declaraciones: estado.declaraciones,
      equipaje: estado.equipaje,
      pago: estado.pago,
      pase: estado.pase,
      mostrador: estado.mostrador,

      cargos: cargos,
      hayCargos: cargos.total > 0,
      pagoResuelto: cargos.total === 0 || estado.pago.estado === 'pagado',
      requiereAutorizacionMenor: requiereAutorizacionMenor(),
      autorizacionResuelta: autorizacionResuelta(),

      internacional: estado.reserva
        ? APP.aeropuertos.esInternacional(estado.reserva.vuelo.origen, estado.reserva.vuelo.destino)
        : false,

      grupos: GRUPOS,
      grupoActual: grupoActual,
      indiceGrupo: indiceGrupo,
      config: CONFIG
    };
  }

  /* ---------- Navegacion entre pasos ----------
     Cual es el siguiente paso depende de lo que el pasajero haya declarado:
     sin cargos no hay pantalla de pago, sin menores no hay autorizacion. */
  function siguienteDe(paso) {
    var cargos = calcularCargos(estado.equipaje, estado.reserva.franquicia);

    switch (paso) {
      case 'vuelo':
        return 'equipaje';
      case 'equipaje':
        if (cargos.total > 0 && estado.pago.estado !== 'pagado') return 'pago';
        return estado.declaraciones.viajaConMenor ? 'menor' : 'restricciones';
      case 'pago':
        return estado.declaraciones.viajaConMenor ? 'menor' : 'restricciones';
      case 'menor':
        return 'restricciones';
      case 'restricciones':
        return 'pase';
      default:
        return paso;
    }
  }

  function anteriorDe(paso) {
    switch (paso) {
      case 'vuelo':          return 'identificacion';
      case 'equipaje':       return 'vuelo';
      case 'pago':           return 'equipaje';
      case 'menor':          return estado.pago.estado === 'pagado' ? 'pago' : 'equipaje';
      case 'restricciones':  return estado.declaraciones.viajaConMenor ? 'menor' : 'equipaje';
      default:               return paso;
    }
  }

  estado = estadoInicial();

  /* ---------- API publica ---------- */
  return {
    alCambiar: function (cb) {
      suscriptores.push(cb);
      cb(obtenerVista());
    },

    obtenerVista: obtenerVista,

    // Expuesta para poder revisar la politica de cobro sin pasar por la UI.
    calcularCargos: calcularCargos,

    /* --- Paso 1: identificacion (simulada) --- */
    identificar: function (codigo, documento) {
      if (!codigo || !documento) {
        estado.error = { campo: 'general', texto: 'Ingresa el codigo de reserva y tu documento.' };
        return emitir();
      }

      esperar(CONFIG.DEMORA_VALIDACION_MS, 'Buscando tu reserva', function () {
        var reserva = DATOS.buscarReserva(codigo);

        if (!reserva) {
          estado.intentosIdentidad++;
          if (estado.intentosIdentidad >= CONFIG.MAX_INTENTOS_IDENTIDAD) {
            return aMostrador(
              'No pudimos encontrar tu reserva',
              'Se agotaron los intentos de busqueda del codigo de reserva.',
              'En el mostrador pueden buscarla con tu documento o con el correo de compra.'
            );
          }
          estado.error = {
            campo: 'codigo',
            texto: 'No encontramos una reserva con ese codigo. Te queda(n) ' +
                   (CONFIG.MAX_INTENTOS_IDENTIDAD - estado.intentosIdentidad) + ' intento(s).'
          };
          return emitir();
        }

        if (DATOS.normalizar(reserva.documento) !== DATOS.normalizar(documento)) {
          estado.intentosIdentidad++;
          if (estado.intentosIdentidad >= CONFIG.MAX_INTENTOS_IDENTIDAD) {
            return aMostrador(
              'El documento no coincide con la reserva',
              'Se agotaron los intentos de validacion del documento.',
              'Un agente puede verificar tu identidad de forma presencial con tu documento fisico.'
            );
          }
          estado.error = {
            campo: 'documento',
            texto: 'El documento no coincide con el de la reserva. Te queda(n) ' +
                   (CONFIG.MAX_INTENTOS_IDENTIDAD - estado.intentosIdentidad) + ' intento(s).'
          };
          return emitir();
        }

        // La hora de salida se fija recien ahora, relativa al momento de la
        // demo: asi los casos de borde funcionan a cualquier hora del dia.
        reserva.vuelo.salidaTs = Date.now() + reserva.vuelo.enMinutos * MIN;
        reserva.vuelo.llegadaTs = reserva.vuelo.salidaTs + reserva.vuelo.duracionMin * MIN;

        if (reserva.vuelo.enMinutos < CONFIG.CIERRE_CHECKIN_MIN) {
          estado.reserva = reserva;
          return aMostrador(
            'El check-in en linea ya esta cerrado',
            'El vuelo ' + reserva.vuelo.codigo + ' sale en ' + reserva.vuelo.enMinutos +
            ' minutos y el check-in en linea cierra ' + CONFIG.CIERRE_CHECKIN_MIN +
            ' minutos antes de la salida.',
            'Acercate al counter de AeroAndes: todavia alcanzas a documentar de forma presencial.'
          );
        }

        if (reserva.vuelo.enMinutos > CONFIG.APERTURA_CHECKIN_MIN) {
          estado.error = {
            campo: 'general',
            texto: 'El check-in de este vuelo abre ' +
                   Math.round(CONFIG.APERTURA_CHECKIN_MIN / 60) + ' horas antes de la salida.'
          };
          return emitir();
        }

        estado.reserva = reserva;
        // Si la reserva ya trae un menor, la declaracion parte marcada: no
        // depende de que el pasajero se acuerde de declararlo.
        estado.declaraciones.viajaConMenor = reserva.menores.length > 0;
        estado.equipaje.mano = reserva.franquicia.mano;
        irA('vuelo', 'avanza');
      });
    },

    /* --- Paso 2: confirmacion del vuelo --- */
    confirmarVuelo: function (declaraciones) {
      if (declaraciones && typeof declaraciones.viajaConMenor === 'boolean') {
        estado.declaraciones.viajaConMenor = declaraciones.viajaConMenor;
      }
      irA('equipaje', 'avanza');
    },

    setViajaConMenor: function (valor) {
      estado.declaraciones.viajaConMenor = Boolean(valor);
      if (!valor) {
        estado.declaraciones.menorConAmbosPadres = null;
        estado.declaraciones.autorizacion = null;
      }
      emitir();
    },

    /* --- Paso 3: equipaje --- */
    setEquipajeMano: function (cantidad, noCabe) {
      estado.equipaje.mano = Math.max(0, Math.min(2, cantidad));
      if (typeof noCabe === 'boolean') estado.equipaje.manoNoCabe = noCabe;
      // Cambiar el equipaje invalida un pago anterior: el monto ya no es el mismo.
      if (estado.pago.estado === 'pagado') estado.pago.estado = 'pendiente';
      emitir();
    },

    agregarMaleta: function () {
      if (estado.equipaje.despachadas.length >= CONFIG.MAX_MALETAS_DESPACHADAS) return;
      estado.equipaje.despachadas.push(CONFIG.DESPACHADA_PESO_MAX_KG);
      if (estado.pago.estado === 'pagado') estado.pago.estado = 'pendiente';
      emitir();
    },

    quitarMaleta: function (indice) {
      estado.equipaje.despachadas.splice(indice, 1);
      if (estado.pago.estado === 'pagado') estado.pago.estado = 'pendiente';
      emitir();
    },

    setPesoMaleta: function (indice, kg) {
      var valor = Number(kg);
      if (isNaN(valor)) return;
      estado.equipaje.despachadas[indice] = Math.max(0, Math.min(45, valor));
      if (estado.pago.estado === 'pagado') estado.pago.estado = 'pendiente';
      emitir();
    },

    /* --- Paso 4: pago simulado del exceso --- */
    setMedioPago: function (id) {
      estado.pago.medio = id;
      if (estado.pago.estado === 'rechazado') {
        estado.pago.estado = 'pendiente';
        estado.error = null;
      }
      emitir();
    },

    setSimularRechazo: function (activo) {
      estado.pago.simularRechazo = Boolean(activo);
      emitir();
    },

    pagar: function () {
      if (estado.ocupado) return;

      esperar(CONFIG.DEMORA_PAGO_MS, 'Procesando el pago', function () {
        estado.pago.intentos++;

        // No hay pasarela: el resultado sale del interruptor de demo.
        if (estado.pago.simularRechazo) {
          estado.pago.estado = 'rechazado';
          estado.error = {
            campo: 'pago',
            texto: 'El medio de pago fue rechazado (rechazo simulado). Puedes intentar con otro.'
          };
          return emitir();
        }

        estado.pago.estado = 'pagado';
        emitir();
      });
    },

    /* --- Paso 5: autorizacion de un menor --- */
    responderMenorConAmbosPadres: function (valor) {
      estado.declaraciones.menorConAmbosPadres = valor;
      if (valor === true) estado.declaraciones.autorizacion = null;
      emitir();
    },

    adjuntarAutorizacion: function (nombreArchivo) {
      esperar(CONFIG.DEMORA_VALIDACION_MS, 'Recibiendo el documento', function () {
        // Se registra el adjunto, no se lee ni se valida su contenido.
        estado.declaraciones.autorizacion = { nombre: nombreArchivo || 'autorizacion.pdf' };
        emitir();
      });
    },

    quitarAutorizacion: function () {
      estado.declaraciones.autorizacion = null;
      emitir();
    },

    /* --- Paso final: emision del pase --- */
    emitirPase: function () {
      esperar(CONFIG.DEMORA_EMISION_MS, 'Emitiendo tu pase de abordar', function () {
        estado.pase = generarPase();
        irA('pase', 'avanza');
      });
    },

    /* --- Navegacion --- */
    avanzar: function () {
      if (estado.ocupado) return;
      var siguiente = siguienteDe(estado.paso);
      if (siguiente === 'pase') return this.emitirPase();
      irA(siguiente, 'avanza');
    },

    retroceder: function () {
      if (estado.paso === 'identificacion' || estado.ocupado) return;
      irA(anteriorDe(estado.paso), 'retrocede');
    },

    derivarAMostrador: function (titulo, motivo, sugerencia) {
      aMostrador(
        titulo || 'Te derivamos a un mostrador',
        motivo || 'Este caso necesita la revision de un agente.',
        sugerencia || 'Acercate al counter de AeroAndes con tu documento y tu equipaje.'
      );
    },

    reiniciar: function () {
      clearTimeout(temporizador);
      estado = estadoInicial();
      emitir();
    }
  };
};
