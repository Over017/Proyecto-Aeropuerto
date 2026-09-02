/* =========================================================================
   NUCLEO COMPARTIDO
   -------------------------------------------------------------------------
   Lo que usan por igual el panel operacional y el portal de check-in:
   el namespace APP, los helpers de tiempo y el catalogo de aeropuertos.

   Vive aparte para no duplicarlo en cada seccion del sitio. No toca el DOM
   ni sabe nada de pantallas.
   ========================================================================= */

window.APP = window.APP || {};

/* ---------- Helpers de tiempo ---------- */
APP.tiempo = {
  MINUTO: 60 * 1000,

  /** "HH:MM" -> timestamp del dia indicado. */
  desdeHoraTexto: function (dia, texto) {
    var partes = texto.split(':');
    var d = new Date(dia);
    d.setHours(Number(partes[0]), Number(partes[1]), 0, 0);
    return d.getTime();
  },

  /** timestamp -> "HH:MM" en 24 horas. */
  aTexto: function (ts) {
    var d = new Date(ts);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  },

  /** timestamp -> "lun 2 sep" (fecha corta para el pase de abordar). */
  aFechaCorta: function (ts) {
    var DIAS = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
    var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    var d = new Date(ts);
    return DIAS[d.getDay()] + ' ' + d.getDate() + ' ' + MESES[d.getMonth()];
  },

  /** Minutos (numero) -> "2 h 15 min" / "45 min". */
  duracion: function (minutos) {
    var h = Math.floor(minutos / 60);
    var m = minutos % 60;
    if (h === 0) return m + ' min';
    if (m === 0) return h + ' h';
    return h + ' h ' + m + ' min';
  }
};

/* ---------- Aeropuertos ---------- */
APP.aeropuertos = (function () {
  'use strict';

  var CATALOGO = {
    SCL: { ciudad: 'Santiago',       pais: 'Chile' },
    ANF: { ciudad: 'Antofagasta',    pais: 'Chile' },
    CJC: { ciudad: 'Calama',         pais: 'Chile' },
    IQQ: { ciudad: 'Iquique',        pais: 'Chile' },
    LSC: { ciudad: 'La Serena',      pais: 'Chile' },
    CCP: { ciudad: 'Concepción',     pais: 'Chile' },
    ZCO: { ciudad: 'Temuco',         pais: 'Chile' },
    PMC: { ciudad: 'Puerto Montt',   pais: 'Chile' },
    PUQ: { ciudad: 'Punta Arenas',   pais: 'Chile' },
    IPC: { ciudad: 'Isla de Pascua', pais: 'Chile' },
    LIM: { ciudad: 'Lima',           pais: 'Perú' },
    EZE: { ciudad: 'Buenos Aires',   pais: 'Argentina' },
    MVD: { ciudad: 'Montevideo',     pais: 'Uruguay' },
    GRU: { ciudad: 'São Paulo',      pais: 'Brasil' },
    BOG: { ciudad: 'Bogotá',         pais: 'Colombia' },
    ASU: { ciudad: 'Asunción',       pais: 'Paraguay' },
    MAD: { ciudad: 'Madrid',         pais: 'España' },
    MIA: { ciudad: 'Miami',          pais: 'Estados Unidos' }
  };

  return {
    /** Nombre de ciudad para un codigo IATA (si no existe, devuelve el codigo). */
    ciudad: function (iata) {
      return CATALOGO[iata] ? CATALOGO[iata].ciudad : iata;
    },

    pais: function (iata) {
      return CATALOGO[iata] ? CATALOGO[iata].pais : '';
    },

    /**
     * Un tramo es internacional si origen y destino estan en paises distintos.
     * Se usa para decidir que aviso de documentacion mostrar en el check-in.
     */
    esInternacional: function (origen, destino) {
      var a = CATALOGO[origen];
      var b = CATALOGO[destino];
      if (!a || !b) return false;
      return a.pais !== b.pais;
    }
  };
})();
