/* =========================================================================
   DATOS SIMULADOS (mock)
   -------------------------------------------------------------------------
   Todo lo de este archivo es ficticio y existe solo para la maqueta.
   Cuando exista backend, este modulo se reemplaza por una llamada al API
   (GET /api/vuelos) manteniendo la misma forma de objeto.

   Forma de un vuelo:
     codigo       : identificador comercial del vuelo
     origen       : codigo IATA del aeropuerto de salida
     destino      : codigo IATA del aeropuerto de llegada
     salida       : hora programada de salida "HH:MM" (del dia simulado)
     duracionMin  : tiempo estimado de vuelo, en minutos
     puerta       : puerta de embarque asignada
     equipo       : modelo de avion
     retrasoMin   : (opcional) atraso inicial, para que el tablero no parta plano
     cancelado    : (opcional) vuelo cancelado desde el inicio
   ========================================================================= */

window.APP = window.APP || {};

APP.datos = (function () {
  'use strict';

  // Hora en que arranca el dia simulado. Los vuelos se reparten alrededor de
  // esta hora para que en la demo haya vuelos en todos los estados desde el
  // primer segundo (algunos ya aterrizados, otros embarcando, otros por salir).
  var HORA_INICIO = '06:00';

  var VUELOS = [
    { codigo: 'AN1204', origen: 'SCL', destino: 'ANF', salida: '05:10', duracionMin: 115, puerta: 'A3',  equipo: 'A320neo' },
    { codigo: 'AN2310', origen: 'SCL', destino: 'CCP', salida: '05:35', duracionMin:  75, puerta: 'A5',  equipo: 'A319' },
    { codigo: 'AN4402', origen: 'SCL', destino: 'LIM', salida: '05:50', duracionMin: 205, puerta: 'C12', equipo: 'B787-9' },
    { codigo: 'AN1108', origen: 'SCL', destino: 'CJC', salida: '06:15', duracionMin: 130, puerta: 'A7',  equipo: 'A320neo', retrasoMin: 35 },
    { codigo: 'AN3020', origen: 'SCL', destino: 'PMC', salida: '06:30', duracionMin: 110, puerta: 'B2',  equipo: 'A321' },
    { codigo: 'AN5501', origen: 'SCL', destino: 'EZE', salida: '06:45', duracionMin: 135, puerta: 'C4',  equipo: 'A320neo' },
    { codigo: 'AN1310', origen: 'SCL', destino: 'IQQ', salida: '07:05', duracionMin: 145, puerta: 'A9',  equipo: 'A321' },
    { codigo: 'AN2115', origen: 'SCL', destino: 'LSC', salida: '07:20', duracionMin:  65, puerta: 'A2',  equipo: 'A319' },
    { codigo: 'AN6604', origen: 'SCL', destino: 'GRU', salida: '07:40', duracionMin: 235, puerta: 'C8',  equipo: 'B787-9' },
    { codigo: 'AN3305', origen: 'SCL', destino: 'PUQ', salida: '08:00', duracionMin: 205, puerta: 'B6',  equipo: 'A321' },
    { codigo: 'AN2408', origen: 'SCL', destino: 'ZCO', salida: '08:25', duracionMin:  90, puerta: 'A4',  equipo: 'A319' },
    { codigo: 'AN7702', origen: 'SCL', destino: 'IPC', salida: '08:50', duracionMin: 320, puerta: 'C2',  equipo: 'B787-9' },
    { codigo: 'AN5210', origen: 'SCL', destino: 'MVD', salida: '09:10', duracionMin: 140, puerta: 'C6',  equipo: 'A320neo', cancelado: true },
    { codigo: 'AN1220', origen: 'ANF', destino: 'SCL', salida: '09:30', duracionMin: 115, puerta: 'N1',  equipo: 'A320neo' },
    { codigo: 'AN8801', origen: 'SCL', destino: 'BOG', salida: '09:55', duracionMin: 290, puerta: 'C10', equipo: 'B787-9' },
    { codigo: 'AN2326', origen: 'CCP', destino: 'SCL', salida: '10:15', duracionMin:  75, puerta: 'S2',  equipo: 'A319' },
    { codigo: 'AN4106', origen: 'SCL', destino: 'ASU', salida: '10:40', duracionMin: 175, puerta: 'C3',  equipo: 'A320neo' },
    { codigo: 'AN3040', origen: 'PMC', destino: 'SCL', salida: '11:05', duracionMin: 110, puerta: 'P1',  equipo: 'A321' }
  ];

  return {
    HORA_INICIO: HORA_INICIO,

    /** Atajo al catalogo compartido de aeropuertos (ver core.js). */
    ciudad: function (iata) {
      return APP.aeropuertos.ciudad(iata);
    },

    /**
     * Devuelve una copia de los vuelos base.
     * Se copia para que el simulador pueda mutar (atrasos, cancelaciones)
     * sin ensuciar los datos originales al recargar.
     */
    obtenerVuelos: function () {
      return VUELOS.map(function (v) {
        return {
          codigo: v.codigo,
          origen: v.origen,
          destino: v.destino,
          salida: v.salida,
          duracionMin: v.duracionMin,
          puerta: v.puerta,
          equipo: v.equipo,
          retrasoMin: v.retrasoMin || 0,
          cancelado: Boolean(v.cancelado)
        };
      });
    }
  };
})();
