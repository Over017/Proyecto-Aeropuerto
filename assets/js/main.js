/* =========================================================================
   ARRANQUE
   -------------------------------------------------------------------------
   Une las tres piezas: datos simulados -> simulador -> render.
   Cuando exista backend, lo unico que cambia aca es de donde salen los vuelos.
   ========================================================================= */

(function () {
  'use strict';

  // Velocidad inicial de la demo: 60x el tiempo real (1 minuto simulado por
  // segundo). Con esto la jornada se recorre en pocos minutos de presentacion.
  var VELOCIDAD_INICIAL = 60;

  document.addEventListener('DOMContentLoaded', function () {
    // El dia simulado es siempre "hoy": asi las horas del tablero se ven
    // coherentes con la fecha del computador donde se hace la demo.
    var hoy = new Date();
    var horaInicio = APP.tiempo.desdeHoraTexto(hoy, APP.datos.HORA_INICIO);

    // Las horas "HH:MM" del mock se convierten a timestamps del dia simulado.
    var vuelos = APP.datos.obtenerVuelos().map(function (v) {
      v.salidaProgramada = APP.tiempo.desdeHoraTexto(hoy, v.salida);
      return v;
    });

    var simulador = APP.crearSimulador({
      vuelos: vuelos,
      horaInicio: horaInicio,
      velocidad: VELOCIDAD_INICIAL
    });

    APP.ui.iniciar(simulador);
    simulador.iniciar();

    // Pausa la simulacion cuando la pestana no esta visible: evita que el
    // tablero "salte" horas de golpe al volver a la presentacion.
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        simulador.detener();
      } else {
        simulador.iniciar();
      }
    });
  });
})();
