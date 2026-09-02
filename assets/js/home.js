/* =========================================================================
   PORTADA
   -------------------------------------------------------------------------
   Lo unico que hace la portada por JS es escribir los limites de equipaje y
   la ventana de check-in leyendolos de CONFIG, para que no queden numeros
   escritos a mano en el HTML que despues contradigan al flujo real.
   ========================================================================= */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    var CONFIG = APP.checkinDatos.CONFIG;

    // Valor tal cual viene de CONFIG.
    Array.prototype.forEach.call(document.querySelectorAll('[data-config]'), function (el) {
      el.textContent = CONFIG[el.dataset.config];
    });

    // Valor formateado como monto.
    Array.prototype.forEach.call(document.querySelectorAll('[data-config-pesos]'), function (el) {
      el.textContent = '$ ' + CONFIG[el.dataset.configPesos].toLocaleString('es-CL');
    });

    // Valor en minutos, mostrado en horas.
    Array.prototype.forEach.call(document.querySelectorAll('[data-config-horas]'), function (el) {
      el.textContent = Math.round(CONFIG[el.dataset.configHoras] / 60);
    });
  });
})();
