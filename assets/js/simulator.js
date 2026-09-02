/* =========================================================================
   SIMULADOR DE OPERACION
   -------------------------------------------------------------------------
   Responsabilidad unica: mantener un reloj simulado y, a partir de el,
   derivar el estado de cada vuelo. No toca el DOM.

   Ciclo de estados:
     Programado -> Embarcando -> En camino -> Aterrizado
     (cualquiera puede terminar en Cancelado)

   Las reglas de negocio estan todas en CONFIG para poder ajustarlas cuando
   el profesor confirme los tiempos reales de la operacion.
   ========================================================================= */

// Los helpers de tiempo viven en core.js (los comparte con el check-in).
window.APP = window.APP || {};

APP.ESTADOS = {
  PROGRAMADO: 'Programado',
  EMBARCANDO: 'Embarcando',
  EN_CAMINO: 'En camino',
  ATERRIZADO: 'Aterrizado',
  CANCELADO: 'Cancelado',
  ATRASADO: 'Atrasado' // etiqueta visual, no un paso del ciclo
};

APP.crearSimulador = function (opciones) {
  'use strict';

  var MIN = APP.tiempo.MINUTO;
  var E = APP.ESTADOS;

  var CONFIG = {
    // Minutos antes de la salida en que el vuelo pasa a "Embarcando".
    MINUTOS_EMBARQUE: 40,

    // Cada cuanto (tiempo real) recalculamos el tablero.
    INTERVALO_TICK_MS: 250,

    // Probabilidad, por vuelo y por minuto simulado, de que aparezca un atraso.
    PROB_ATRASO: 0.0006,

    // Probabilidad, por vuelo y por minuto simulado, de una cancelacion.
    PROB_CANCELACION: 0.00005,

    // Rango del atraso aleatorio, en minutos.
    ATRASO_MIN: 10,
    ATRASO_MAX: 75
  };

  var vuelos = opciones.vuelos;
  var reloj = opciones.horaInicio;          // timestamp del "ahora" simulado
  // Multiplicador del tiempo real: 60 = el reloj avanza 1 minuto simulado por
  // cada segundo real, asi una jornada de 6 horas dura 6 minutos de demo.
  var velocidad = opciones.velocidad || 60;
  var intervalo = null;
  var suscriptores = [];

  /* ---------- Calculo de horarios ---------- */

  // La salida estimada es la programada mas el atraso acumulado.
  function salidaEstimada(v) {
    return v.salidaProgramada + v.retrasoMin * MIN;
  }

  function llegadaEstimada(v) {
    return salidaEstimada(v) + v.duracionMin * MIN;
  }

  /* ---------- Regla de estados ---------- */
  function calcularEstado(v, ahora) {
    if (v.cancelado) return E.CANCELADO;
    if (ahora >= llegadaEstimada(v)) return E.ATERRIZADO;
    if (ahora >= salidaEstimada(v)) return E.EN_CAMINO;
    if (ahora >= salidaEstimada(v) - CONFIG.MINUTOS_EMBARQUE * MIN) return E.EMBARCANDO;
    return E.PROGRAMADO;
  }

  /* ---------- Eventos aleatorios ---------- */
  // Solo pueden atrasarse o cancelarse los vuelos que todavia no despegaron:
  // una vez en el aire, el horario ya no se mueve.
  function aplicarEventos(minutosTranscurridos) {
    vuelos.forEach(function (v) {
      var estado = calcularEstado(v, reloj);
      if (estado === E.EN_CAMINO || estado === E.ATERRIZADO || estado === E.CANCELADO) return;

      // La probabilidad se escala por los minutos simulados que avanzo el tick.
      if (Math.random() < CONFIG.PROB_CANCELACION * minutosTranscurridos) {
        v.cancelado = true;
        return;
      }

      // Un vuelo se atrasa una sola vez, para que el tablero no se descontrole.
      if (v.retrasoMin === 0 && Math.random() < CONFIG.PROB_ATRASO * minutosTranscurridos) {
        var rango = CONFIG.ATRASO_MAX - CONFIG.ATRASO_MIN;
        v.retrasoMin = CONFIG.ATRASO_MIN + Math.round(Math.random() * rango);
      }
    });
  }

  /* ---------- Vista que consume la UI ---------- */
  // Se arma un objeto plano por vuelo: la UI no vuelve a calcular nada.
  function construirVista() {
    var lista = vuelos.map(function (v) {
      var estado = calcularEstado(v, reloj);
      var atrasado = v.retrasoMin > 0 && !v.cancelado;

      return {
        codigo: v.codigo,
        origen: v.origen,
        destino: v.destino,
        puerta: v.puerta,
        equipo: v.equipo,
        estado: estado,
        // Mientras el vuelo no aterrice, el atraso manda en la etiqueta visible.
        etiqueta: (atrasado && estado !== E.ATERRIZADO && estado !== E.CANCELADO) ? E.ATRASADO : estado,
        atrasado: atrasado,
        retrasoMin: v.retrasoMin,
        cancelado: v.cancelado,
        salidaProgramada: v.salidaProgramada,
        salidaEstimada: salidaEstimada(v),
        llegadaEstimada: llegadaEstimada(v)
      };
    });

    // Orden del tablero: por hora de salida estimada, como una pantalla de aeropuerto.
    lista.sort(function (a, b) { return a.salidaEstimada - b.salidaEstimada; });

    return {
      ahora: reloj,
      vuelos: lista,
      resumen: {
        total: lista.length,
        enCamino: lista.filter(function (f) { return f.estado === E.EN_CAMINO; }).length,
        atrasados: lista.filter(function (f) { return f.atrasado && f.estado !== E.ATERRIZADO; }).length,
        cancelados: lista.filter(function (f) { return f.cancelado; }).length
      }
    };
  }

  function emitir() {
    var vista = construirVista();
    suscriptores.forEach(function (cb) { cb(vista); });
  }

  function tick() {
    // Cuanto tiempo simulado corresponde a este tick, segun el multiplicador.
    var avanceMs = CONFIG.INTERVALO_TICK_MS * velocidad;
    reloj += avanceMs;
    aplicarEventos(avanceMs / MIN);
    emitir();
  }

  /* ---------- API publica ---------- */
  return {
    iniciar: function () {
      if (intervalo) return;
      emitir(); // pinta el estado inicial sin esperar el primer tick
      intervalo = setInterval(tick, CONFIG.INTERVALO_TICK_MS);
    },

    detener: function () {
      clearInterval(intervalo);
      intervalo = null;
    },

    /** Cambia el multiplicador del tiempo real (1 = tiempo normal). */
    setVelocidad: function (v) {
      velocidad = v;
    },

    getVelocidad: function () {
      return velocidad;
    },

    /** Registra un callback que recibe la vista completa en cada tick. */
    alActualizar: function (cb) {
      suscriptores.push(cb);
    },

    config: CONFIG
  };
};
