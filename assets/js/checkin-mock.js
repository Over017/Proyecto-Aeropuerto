/* =========================================================================
   DATOS SIMULADOS DEL CHECK-IN (mock)
   -------------------------------------------------------------------------
   Todo lo de este archivo es ficticio. Ninguna reserva, tarifa ni tarjeta
   corresponde a informacion real. Cuando exista backend, este modulo se
   reemplaza por llamadas al API manteniendo la forma de los objetos.

   Los valores que el cliente todavia no confirmo (limites de equipaje,
   tarifas, medios de pago) estan reunidos en CONFIG para poder cambiarlos
   en un solo lugar, igual que hace simulator.js con la operacion.
   ========================================================================= */

window.APP = window.APP || {};

APP.checkinDatos = (function () {
  'use strict';

  /* ---------- Parametros de la simulacion ----------
     OJO: son valores de ejemplo, no politica real de la aerolinea.
     Estan pendientes de confirmar con el cliente (ver README). */
  var CONFIG = {
    // Ventana de check-in, en minutos antes de la salida.
    APERTURA_CHECKIN_MIN: 48 * 60,
    CIERRE_CHECKIN_MIN: 60,

    // Equipaje de mano. La medida es orientativa: quien decide es el gabinete
    // fisico del aeropuerto, no lo que se declare aca.
    MANO_PESO_MAX_KG: 10,
    MANO_MEDIDAS_CM: '55 x 35 x 25',

    // Equipaje despachado.
    DESPACHADA_PESO_MAX_KG: 23,   // limite incluido en la franquicia
    DESPACHADA_PESO_TOPE_KG: 32,  // sobre esto no se acepta en autoservicio
    MAX_MALETAS_DESPACHADAS: 4,

    // Tarifas simuladas, en pesos chilenos.
    TARIFA_EXCESO_KG: 8500,
    TARIFA_MALETA_EXTRA: 45000,
    TARIFA_GATE_CHECK: 25000,     // facturar una pieza de mano en el momento

    /* --- Verificacion posterior del peso ---
       El pasajero declara el peso que marco la balanza; despues, en el punto
       de entrega, la maleta se vuelve a pesar. Aca se simula ese segundo
       pesaje: no hay balanza conectada, el "peso real" sale de estos numeros.
       DESVIACION_PESO_MAX_KG es cuanto puede alejarse del valor declarado. */
    PROB_PESO_COINCIDE: 0.45,
    DESVIACION_PESO_MAX_KG: 5,

    /* --- Gabinete de equipaje de mano ---
       Probabilidad de que el bolso no pase el gabinete fisico y haya que
       facturarlo en el momento. */
    PROB_MANO_NO_PASA: 0.25,

    /* --- Consecuencias de la diferencia de peso ---
       Plazo para regularizar una deuda antes de que se bloqueen los viajes
       futuros, y cuantas millas equivale un peso al pedir el reembolso.
       Ambos siguen abiertos con el cliente. */
    PLAZO_DEUDA_DIAS: 30,
    MILLAS_POR_PESO: 0.5,

    // Esperas simuladas (ms de tiempo real) para que se vea el "procesando".
    DEMORA_VALIDACION_MS: 1100,
    DEMORA_PAGO_MS: 1600,
    DEMORA_PESAJE_MS: 1800,
    DEMORA_EMISION_MS: 1400,

    // Intentos de identificacion antes de derivar a mostrador.
    MAX_INTENTOS_IDENTIDAD: 3,

    // Minutos antes de la salida en que se cierra la puerta de embarque.
    // Se usa solo para imprimir la hora en el pase de abordar.
    MINUTOS_EMBARQUE: 40
  };

  /* ---------- Medios de pago simulados ----------
     La entrevista pedia poder pagar el exceso sin sacar tarjeta fisica ni
     buscar efectivo: por eso el primero es una cuenta ya vinculada.
     Que medios se aceptarian de verdad sigue abierto con el cliente. */
  var MEDIOS_PAGO = [
    { id: 'cuenta',  nombre: 'Cuenta AeroAndes',  detalle: 'Tarjeta vinculada &middot; termina en 4417', preferido: true },
    { id: 'credito', nombre: 'Tarjeta de crédito', detalle: 'Guardada en el perfil &middot; termina en 9082' },
    { id: 'debito',  nombre: 'Tarjeta de débito',  detalle: 'Guardada en el perfil &middot; termina en 3310' }
  ];

  /* ---------- Como se devuelve un cobro de mas ----------
     Si el peso real resulta menor al declarado, el pasajero elige como
     recibir la diferencia. */
  var MEDIOS_REEMBOLSO = [
    { id: 'millas',  nombre: 'Millas AeroAndes', detalle: 'Se acreditan en tu cuenta al cierre del vuelo' },
    { id: 'tarjeta', nombre: 'A tu tarjeta',     detalle: 'A la misma tarjeta con que pagaste &middot; termina en 4417' }
  ];

  /* ---------- Reservas simuladas ----------
     Cada una existe para poder mostrar un camino distinto en la demo:

     AN7K2P  vuelo nacional, sin menores. El camino feliz.
     AN9QLM  vuelo internacional con un menor de edad en la reserva.
     AN3TZ8  vuelo internacional de larga distancia, con franquicia mayor.
     AN5RB1  el vuelo sale muy pronto: el check-in ya esta cerrado.

     `enMinutos` es cuanto falta para la salida contado desde que se abre la
     pagina. Se usa en vez de una hora fija para que los casos de borde
     (check-in cerrado) se comporten igual a cualquier hora del dia.

     Forma de una reserva:
       codigo        codigo de reserva que teclea el pasajero
       documento     documento con que se valida (debe coincidir)
       pasajero      titular de la reserva
       vuelo         datos del tramo
       franquicia    cuantas piezas trae incluidas el ticket
       menores       menores incluidos en la misma reserva
  */
  var RESERVAS = [
    {
      codigo: 'AN7K2P',
      documento: '12.345.678-9',
      pasajero: { nombre: 'María Fernanda Ríos', tipoDocumento: 'RUN', nacionalidad: 'Chile' },
      vuelo: {
        codigo: 'AN3020', origen: 'SCL', destino: 'PMC',
        enMinutos: 260, duracionMin: 110, puerta: 'B2', equipo: 'A321'
      },
      cabina: 'Economy',
      asiento: '18C',
      franquicia: { mano: 1, despachadas: 1 },
      menores: []
    },
    {
      codigo: 'AN9QLM',
      documento: '9.871.234-K',
      pasajero: { nombre: 'Rodrigo Alcaíno Vera', tipoDocumento: 'RUN', nacionalidad: 'Chile' },
      vuelo: {
        codigo: 'AN5501', origen: 'SCL', destino: 'EZE',
        enMinutos: 195, duracionMin: 135, puerta: 'C4', equipo: 'A320neo'
      },
      cabina: 'Economy',
      asiento: '11A',
      franquicia: { mano: 1, despachadas: 1 },
      // Un menor en la reserva activa la declaracion de autorizacion notarial.
      menores: [{ nombre: 'Emilia Alcaíno Soto', edad: 9, parentesco: 'Hija' }]
    },
    {
      codigo: 'AN3TZ8',
      documento: 'P4471902',
      pasajero: { nombre: 'Camila Undurraga Pinto', tipoDocumento: 'Pasaporte', nacionalidad: 'Chile' },
      vuelo: {
        codigo: 'AN9010', origen: 'SCL', destino: 'MAD',
        enMinutos: 420, duracionMin: 830, puerta: 'C14', equipo: 'B787-9'
      },
      cabina: 'Premium Economy',
      asiento: '7D',
      franquicia: { mano: 1, despachadas: 2 },
      menores: []
    },
    {
      codigo: 'AN5RB1',
      documento: '17.203.556-4',
      pasajero: { nombre: 'Ignacio Bravo Miranda', tipoDocumento: 'RUN', nacionalidad: 'Chile' },
      vuelo: {
        codigo: 'AN2310', origen: 'SCL', destino: 'CCP',
        enMinutos: 38, duracionMin: 75, puerta: 'A5', equipo: 'A319'
      },
      cabina: 'Economy',
      asiento: '22F',
      franquicia: { mano: 1, despachadas: 1 },
      menores: []
    }
  ];

  /** Normaliza lo tecleado para comparar: sin puntos, guiones ni espacios. */
  function normalizar(texto) {
    return String(texto || '').toUpperCase().replace(/[\s.\-]/g, '');
  }

  return {
    CONFIG: CONFIG,
    MEDIOS_PAGO: MEDIOS_PAGO,
    MEDIOS_REEMBOLSO: MEDIOS_REEMBOLSO,
    normalizar: normalizar,

    /** Codigos disponibles: solo para la ayuda de la demo, no es una funcion del producto. */
    codigosDeEjemplo: function () {
      return RESERVAS.map(function (r) {
        return {
          codigo: r.codigo,
          documento: r.documento,
          pista: r.vuelo.origen + ' - ' + r.vuelo.destino
        };
      });
    },

    /**
     * Busca una reserva por codigo. Devuelve una copia profunda para que el
     * flujo pueda trabajar sobre ella sin ensuciar el mock al reiniciar.
     */
    buscarReserva: function (codigo) {
      var buscado = normalizar(codigo);
      var encontrada = null;

      RESERVAS.forEach(function (r) {
        if (normalizar(r.codigo) === buscado) encontrada = r;
      });

      return encontrada ? JSON.parse(JSON.stringify(encontrada)) : null;
    }
  };
})();
