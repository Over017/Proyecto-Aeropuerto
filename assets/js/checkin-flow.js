/* =========================================================================
   FLUJO DE CHECK-IN
   -------------------------------------------------------------------------
   Responsabilidad unica: llevar el estado del check-in y las reglas que lo
   gobiernan (ventana horaria, cargos por equipaje, verificacion posterior del
   peso, cuando corresponde pedir la autorizacion de un menor, cuando hay que
   derivar a mostrador).

   No toca el DOM. Todo lo que la UI necesita sale de `obtenerVista()`.

   IMPORTANTE: es una simulacion. Aca no se valida ninguna identidad real, no
   se lee ningun documento, no hay balanza ni gabinete conectados y no se cobra
   nada de verdad. Las esperas son setTimeout y los resultados salen de CONFIG.

   MODELO DE EQUIPAJE (ver README):
   lo que el pasajero declara es una declaracion bajo su responsabilidad, no un
   dato verificado. Despues, en el punto de entrega, la maleta se vuelve a
   pesar y la diferencia se resuelve como deuda o como reembolso. Por eso el
   check-in NO se bloquea por una diferencia de peso: la plata se ajusta igual.

   Pasos internos:
     identificacion -> vuelo -> equipaje -> [pago] -> verificacion
       -> [deuda | reembolso] -> [gatecheck] -> [menor] -> restricciones -> pase
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
    verificacion: 'equipaje',
    deuda: 'equipaje',
    reembolso: 'equipaje',
    gatecheck: 'equipaje',
    menor: 'documentos',
    restricciones: 'documentos',
    pase: 'pase'
  };

  // Hasta donde se puede volver atras. Una vez que la maleta se peso en el
  // punto de entrega ya no tiene sentido editar la declaracion.
  var PASOS_CON_VUELTA = { vuelo: 'identificacion', equipaje: 'vuelo', pago: 'equipaje' };

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
        despachadas: [],             // pesos declarados en kg, uno por maleta
        condicionesAceptadas: false  // acepta responsabilidad por lo declarado
      },

      pago: {
        medio: 'cuenta',
        estado: 'pendiente',         // pendiente | pagado | rechazado
        intentos: 0,
        simularRechazo: false        // interruptor de demo, no una funcion real
      },

      /* Forzadores de la demo: permiten mostrar cada desenlace a voluntad en
         la presentacion en vez de depender del azar. No son del producto. */
      demo: {
        verificacion: 'aleatorio',   // aleatorio | coincide | mayor | menor
        gabinete: 'aleatorio'        // aleatorio | pasa | no-pasa
      },

      verificacion: null,            // resultado del pesaje en el punto de entrega
      deuda: null,                   // { monto, estado }
      reembolso: null,               // { monto, millas, medio, estado }
      gate: null,                    // { piezas, monto, estado }

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

  /* =======================================================================
     REGLAS DE EQUIPAJE
     ======================================================================= */

  /**
   * Cargos del equipaje despachado. Funcion pura: mismas entradas, mismo
   * resultado. Se usa dos veces con entradas distintas — con los pesos
   * declarados y con los verificados — y la resta de ambas es la diferencia
   * que despues se cobra o se devuelve.
   *
   * El equipaje de mano NO entra aca: quien decide si una pieza va a bodega es
   * el gabinete fisico del aeropuerto, y eso se resuelve en el gate-check.
   */
  function calcularCargos(despachadas, franquicia) {
    var detalle = [];
    var bloqueos = [];

    despachadas.forEach(function (kg, i) {
      var numero = i + 1;

      if (i >= franquicia.despachadas) {
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

    return {
      detalle: detalle,
      total: detalle.reduce(function (acc, d) { return acc + d.monto; }, 0),
      bloqueos: bloqueos
    };
  }

  function cargosActuales() {
    if (!estado.reserva) return { detalle: [], total: 0, bloqueos: [] };
    return calcularCargos(estado.equipaje.despachadas, estado.reserva.franquicia);
  }

  /* ---------- Segundo pesaje (simulado) ----------
     No hay balanza: el "peso real" se genera aca. Los modos de demo permiten
     forzar cada desenlace para la presentacion. */
  function pesoRealSimulado(declarado) {
    var modo = estado.demo.verificacion;
    var tope = CONFIG.DESVIACION_PESO_MAX_KG;
    var delta;

    if (modo === 'coincide') {
      delta = 0;
    } else if (modo === 'mayor') {
      delta = 1 + Math.random() * tope;
    } else if (modo === 'menor') {
      delta = -(1 + Math.random() * tope);
    } else {
      delta = Math.random() < CONFIG.PROB_PESO_COINCIDE
        ? 0
        : (Math.random() * 2 - 1) * tope;
    }

    var real = declarado + delta;
    // Una balanza de aeropuerto marca de medio kilo en medio kilo.
    real = Math.round(Math.max(0, Math.min(CONFIG.DESPACHADA_PESO_TOPE_KG, real)) * 2) / 2;
    return real;
  }

  /**
   * Compara lo declarado con lo verificado y traduce la diferencia a plata.
   * La diferencia se calcula sobre los CARGOS, no sobre los kilos: si ambos
   * pesos caen dentro de la franquicia incluida, no se debe ni se devuelve
   * nada aunque los kilos no sean identicos.
   */
  function construirVerificacion() {
    var declaradas = estado.equipaje.despachadas;
    var franquicia = estado.reserva.franquicia;
    var reales = declaradas.map(pesoRealSimulado);

    var cargoDeclarado = calcularCargos(declaradas, franquicia).total;
    var cargoReal = calcularCargos(reales, franquicia).total;
    var diferencia = cargoReal - cargoDeclarado;

    return {
      piezas: declaradas.map(function (kg, i) {
        return { declarado: kg, real: reales[i], diferencia: reales[i] - kg };
      }),
      cargoDeclarado: cargoDeclarado,
      cargoReal: cargoReal,
      diferencia: diferencia,
      resultado: diferencia > 0 ? 'deuda' : (diferencia < 0 ? 'reembolso' : 'coincide'),
      monto: Math.abs(diferencia),
      millas: Math.round(Math.abs(diferencia) * CONFIG.MILLAS_POR_PESO)
    };
  }

  /* ---------- Gabinete de equipaje de mano (simulado) ----------
     Dos motivos distintos para tener que facturar una pieza en el momento:
     declarar mas piezas de las que incluye la tarifa (se sabe de antemano) y
     que el bolso no entre en el gabinete (se sabe recien en el aeropuerto). */
  function construirGate() {
    var mano = estado.equipaje.mano;
    var sobrantes = Math.max(0, mano - estado.reserva.franquicia.mano);

    var noPasa = false;
    if (mano > 0) {
      var modo = estado.demo.gabinete;
      noPasa = modo === 'no-pasa' ? true
             : modo === 'pasa' ? false
             : Math.random() < CONFIG.PROB_MANO_NO_PASA;
    }

    var piezas = Math.min(mano, sobrantes + (noPasa ? 1 : 0));

    return {
      piezas: piezas,
      sobrantes: sobrantes,
      noPasa: noPasa,
      monto: piezas * CONFIG.TARIFA_GATE_CHECK,
      estado: 'pendiente'   // pendiente | facturado
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

    // Las etiquetas salen del peso verificado, no del declarado: es el que
    // realmente viaja con la maleta.
    var etiquetas = estado.equipaje.despachadas.map(function (kg, i) {
      var real = estado.verificacion ? estado.verificacion.piezas[i].real : kg;
      return { numero: numeroEtiqueta(), destino: r.vuelo.destino, peso: real, origen: 'despachada' };
    });

    // Las piezas de mano facturadas en el gabinete tambien llevan etiqueta.
    if (estado.gate && estado.gate.estado === 'facturado') {
      for (var i = 0; i < estado.gate.piezas; i++) {
        etiquetas.push({ numero: numeroEtiqueta(), destino: r.vuelo.destino, peso: null, origen: 'gate' });
      }
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

  function numeroEtiqueta() {
    return 'AN ' + String(100000 + Math.floor(Math.random() * 899999));
  }

  /* =======================================================================
     NAVEGACION
     Cual es el siguiente paso depende de lo declarado y de como resulto la
     verificacion: sin cargos no hay pantalla de pago, sin maletas no hay
     verificacion, sin menores no hay autorizacion.
     ======================================================================= */

  function despuesDeEquipaje() {
    if (estado.gate && estado.gate.piezas > 0 && estado.gate.estado === 'pendiente') return 'gatecheck';
    return estado.declaraciones.viajaConMenor ? 'menor' : 'restricciones';
  }

  function despuesDeVerificacion() {
    if (estado.verificacion.resultado === 'deuda' && estado.deuda.estado === 'pendiente') return 'deuda';
    if (estado.verificacion.resultado === 'reembolso' && estado.reembolso.estado === 'pendiente') return 'reembolso';
    return despuesDeEquipaje();
  }

  /* ---------- Vista para la UI ---------- */
  function obtenerVista() {
    var cargos = cargosActuales();

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
      demo: estado.demo,
      verificacion: estado.verificacion,
      deuda: estado.deuda,
      reembolso: estado.reembolso,
      gate: estado.gate,
      pase: estado.pase,
      mostrador: estado.mostrador,

      cargos: cargos,
      hayCargos: cargos.total > 0,
      pagoResuelto: cargos.total === 0 || estado.pago.estado === 'pagado',
      puedeSalirDeEquipaje: estado.equipaje.condicionesAceptadas && cargos.bloqueos.length === 0,
      requiereAutorizacionMenor: requiereAutorizacionMenor(),
      autorizacionResuelta: autorizacionResuelta(),
      puedeRetroceder: Boolean(PASOS_CON_VUELTA[estado.paso]),

      internacional: estado.reserva
        ? APP.aeropuertos.esInternacional(estado.reserva.vuelo.origen, estado.reserva.vuelo.destino)
        : false,

      grupos: GRUPOS,
      grupoActual: grupoActual,
      indiceGrupo: indiceGrupo,
      config: CONFIG
    };
  }

  estado = estadoInicial();

  /* =======================================================================
     API PUBLICA
     ======================================================================= */
  var api = {
    alCambiar: function (cb) {
      suscriptores.push(cb);
      cb(obtenerVista());
    },

    obtenerVista: obtenerVista,

    // Expuestas para poder revisar las reglas sin pasar por la UI.
    calcularCargos: calcularCargos,

    /* --- Paso 1: identificacion (simulada) --- */
    identificar: function (codigo, documento) {
      if (!codigo || !documento) {
        estado.error = { campo: 'general', texto: 'Ingresa el código de reserva y tu documento.' };
        return emitir();
      }

      esperar(CONFIG.DEMORA_VALIDACION_MS, 'Buscando tu reserva', function () {
        var reserva = DATOS.buscarReserva(codigo);

        if (!reserva) {
          estado.intentosIdentidad++;
          if (estado.intentosIdentidad >= CONFIG.MAX_INTENTOS_IDENTIDAD) {
            return aMostrador(
              'No pudimos encontrar tu reserva',
              'Se agotaron los intentos de busqueda del código de reserva.',
              'En el mostrador pueden buscarla con tu documento o con el correo de compra.'
            );
          }
          estado.error = {
            campo: 'codigo',
            texto: 'No encontramos una reserva con ese código. Te queda(n) ' +
                   (CONFIG.MAX_INTENTOS_IDENTIDAD - estado.intentosIdentidad) + ' intento(s).'
          };
          return emitir();
        }

        if (DATOS.normalizar(reserva.documento) !== DATOS.normalizar(documento)) {
          estado.intentosIdentidad++;
          if (estado.intentosIdentidad >= CONFIG.MAX_INTENTOS_IDENTIDAD) {
            return aMostrador(
              'El documento no coincide con la reserva',
              'Se agotaron los intentos de validación del documento.',
              'Un agente puede verificar tu identidad de forma presencial con tu documento físico.'
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
            'El check-in en línea ya está cerrado',
            'El vuelo ' + reserva.vuelo.codigo + ' sale en ' + reserva.vuelo.enMinutos +
            ' minutos y el check-in en línea cierra ' + CONFIG.CIERRE_CHECKIN_MIN +
            ' minutos antes de la salida.',
            'Acércate al counter de AeroAndes: todavía alcanzas a documentar de forma presencial.'
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
    setViajaConMenor: function (valor) {
      estado.declaraciones.viajaConMenor = Boolean(valor);
      if (!valor) {
        estado.declaraciones.menorConAmbosPadres = null;
        estado.declaraciones.autorizacion = null;
      }
      emitir();
    },

    /* --- Paso 3: declaracion de equipaje --- */
    setEquipajeMano: function (cantidad) {
      estado.equipaje.mano = Math.max(0, Math.min(2, cantidad));
      emitir();
    },

    agregarMaleta: function () {
      if (estado.equipaje.despachadas.length >= CONFIG.MAX_MALETAS_DESPACHADAS) return;
      estado.equipaje.despachadas.push(CONFIG.DESPACHADA_PESO_MAX_KG);
      invalidarPago();
      emitir();
    },

    quitarMaleta: function (indice) {
      estado.equipaje.despachadas.splice(indice, 1);
      invalidarPago();
      emitir();
    },

    /** El peso queda editable hasta facturar: no es un valor de una sola vez. */
    setPesoMaleta: function (indice, kg) {
      var valor = Number(kg);
      if (isNaN(valor)) return;
      estado.equipaje.despachadas[indice] = Math.max(0, Math.min(45, valor));
      invalidarPago();
      emitir();
    },

    aceptarCondiciones: function (valor) {
      estado.equipaje.condicionesAceptadas = Boolean(valor);
      // Si el error visible era justamente que faltaba aceptar, ya no aplica.
      if (valor && estado.error && estado.error.campo === 'condiciones') estado.error = null;
      emitir();
    },

    /* --- Controles de demo (no son funciones del producto) --- */
    setDemoVerificacion: function (modo) {
      estado.demo.verificacion = modo;
      emitir();
    },

    setDemoGabinete: function (modo) {
      estado.demo.gabinete = modo;
      emitir();
    },

    /* --- Paso 4: pago del exceso declarado --- */
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

    /* --- Paso 5: verificacion en el punto de entrega ---
       Aca se simula el segundo pesaje y el paso por el gabinete. A partir de
       este punto la declaracion ya no se puede editar. */
    verificarEnAeropuerto: function () {
      if (estado.ocupado) return;

      esperar(CONFIG.DEMORA_PESAJE_MS, 'Pesando tu equipaje en el punto de entrega', function () {
        estado.gate = construirGate();

        if (estado.equipaje.despachadas.length === 0) {
          // Sin maletas despachadas no hay nada que verificar.
          estado.verificacion = null;
          return irA(despuesDeEquipaje(), 'avanza');
        }

        estado.verificacion = construirVerificacion();

        if (estado.verificacion.resultado === 'deuda') {
          estado.deuda = { monto: estado.verificacion.monto, estado: 'pendiente' };
        } else if (estado.verificacion.resultado === 'reembolso') {
          estado.reembolso = {
            monto: estado.verificacion.monto,
            millas: estado.verificacion.millas,
            medio: 'millas',
            estado: 'pendiente'
          };
        }

        irA('verificacion', 'avanza');
      });
    },

    /* --- Deuda por peso declarado de menos --- */
    pagarDeuda: function () {
      if (estado.ocupado) return;
      esperar(CONFIG.DEMORA_PAGO_MS, 'Procesando el pago', function () {
        estado.deuda.estado = 'pagada';
        emitir();
      });
    },

    /** Dejar la deuda pendiente es una opcion, con su consecuencia declarada. */
    aplazarDeuda: function () {
      estado.deuda.estado = 'aplazada';
      irA(despuesDeEquipaje(), 'avanza');
    },

    /* --- Reembolso por peso declarado de mas --- */
    setMedioReembolso: function (id) {
      estado.reembolso.medio = id;
      emitir();
    },

    confirmarReembolso: function () {
      if (estado.ocupado) return;
      esperar(CONFIG.DEMORA_PAGO_MS, 'Registrando tu reembolso', function () {
        estado.reembolso.estado = 'confirmado';
        emitir();
      });
    },

    /* --- Gate-check del equipaje de mano --- */
    facturarEnGate: function () {
      if (estado.ocupado) return;
      esperar(CONFIG.DEMORA_PAGO_MS, 'Facturando tu equipaje de mano', function () {
        estado.gate.estado = 'facturado';
        emitir();
      });
    },

    /* --- Autorizacion de un menor --- */
    responderMenorConAmbosPadres: function (valor) {
      estado.declaraciones.menorConAmbosPadres = valor;
      if (valor === true) estado.declaraciones.autorizacion = null;
      emitir();
    },

    adjuntarAutorizacion: function (nombreArchivo) {
      esperar(CONFIG.DEMORA_VALIDACION_MS, 'Recibiendo el documento', function () {
        // Se registra el adjunto, no se lee ni se valida su contenido.
        estado.declaraciones.autorizacion = { nombre: nombreArchivo || 'autorización.pdf' };
        emitir();
      });
    },

    quitarAutorizacion: function () {
      estado.declaraciones.autorizacion = null;
      emitir();
    },

    /* --- Emision del pase --- */
    emitirPase: function () {
      esperar(CONFIG.DEMORA_EMISION_MS, 'Emitiendo tu pase de abordar', function () {
        estado.pase = generarPase();
        irA('pase', 'avanza');
      });
    },

    /* --- Navegacion --- */
    avanzar: function () {
      if (estado.ocupado) return;

      switch (estado.paso) {
        case 'vuelo':
          return irA('equipaje', 'avanza');

        case 'equipaje':
          if (!estado.equipaje.condicionesAceptadas) {
            estado.error = {
              campo: 'condiciones',
              texto: 'Para continuar tienes que aceptar las condiciones de declaración de equipaje.'
            };
            return emitir();
          }
          if (cargosActuales().total > 0 && estado.pago.estado !== 'pagado') {
            return irA('pago', 'avanza');
          }
          return api.verificarEnAeropuerto();

        case 'pago':
          return api.verificarEnAeropuerto();

        case 'verificacion':
          return irA(despuesDeVerificacion(), 'avanza');

        case 'deuda':
        case 'reembolso':
        case 'gatecheck':
          return irA(despuesDeEquipaje(), 'avanza');

        case 'menor':
          return irA('restricciones', 'avanza');

        case 'restricciones':
          return api.emitirPase();
      }
    },

    retroceder: function () {
      if (estado.ocupado) return;
      var anterior = PASOS_CON_VUELTA[estado.paso];
      if (anterior) irA(anterior, 'retrocede');
    },

    derivarAMostrador: function (titulo, motivo, sugerencia) {
      aMostrador(
        titulo || 'Te derivamos a un mostrador',
        motivo || 'Este caso necesita la revisión de un agente.',
        sugerencia || 'Acércate al counter de AeroAndes con tu documento y tu equipaje.'
      );
    },

    reiniciar: function () {
      clearTimeout(temporizador);
      estado = estadoInicial();
      emitir();
    }
  };

  /* Cambiar la declaracion despues de haber pagado invalida ese pago: el monto
     ya no es el mismo. */
  function invalidarPago() {
    if (estado.pago.estado === 'pagado') estado.pago.estado = 'pendiente';
  }

  return api;
};
