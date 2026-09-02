/* =========================================================================
   ARRANQUE DEL CHECK-IN
   -------------------------------------------------------------------------
   Une las piezas: datos simulados -> flujo -> render.
   Cuando exista backend, lo unico que cambia aca es de donde sale la reserva.
   ========================================================================= */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var flujo = APP.crearFlujoCheckin();
    APP.checkinUI.iniciar(flujo);
  });
})();
