/* =========================================================================
   RENDER DEL CHECK-IN
   -------------------------------------------------------------------------
   Responsabilidad unica: pintar la pantalla que corresponde al paso actual y
   enganchar los controles al flujo. No decide reglas de negocio: todo lo que
   muestra sale de la vista que entrega checkin-flow.js.

   Criterio de rendimiento y de animacion: el panel de un paso se construye
   una sola vez al entrar a ese paso. Mientras el pasajero se queda ahi
   (mueve un peso, cambia el medio de pago) solo se actualizan las partes
   vivas, para no romper el foco ni cortar las transiciones.
   ========================================================================= */

window.APP = window.APP || {};

APP.checkinUI = (function () {
  'use strict';

  var dom = {};
  var flujo = null;
  var pasoPintado = null;   // paso cuyo panel esta montado ahora mismo
  var panel = null;         // elemento del panel montado
  var pantalla = null;      // definicion de la pantalla montada
  var totalPintado = null;  // ultimo total de cargos, para destellar al cambiar
  var primerPintado = true; // el primer panel no necesita reposicionar el scroll

  /* ---------- Utilidades de presentacion ---------- */

  function esc(texto) {
    return String(texto === undefined || texto === null ? '' : texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** 45000 -> "$ 45.000". Moneda de la simulacion: peso chileno. */
  function pesos(monto) {
    return '$ ' + Math.round(monto).toLocaleString('es-CL');
  }

  function kg(valor) {
    return (Math.round(valor * 10) / 10).toLocaleString('es-CL') + ' kg';
  }

  function nota(texto) {
    return '<p class="simulacion">' + texto + '</p>';
  }

  /** Barras de ancho variable: hace de codigo de barras, no codifica nada. */
  function barrasSimuladas(cantidad) {
    var barras = '';
    for (var i = 0; i < cantidad; i++) {
      var ancho = 1 + Math.floor(Math.random() * 3);
      barras += '<i style="width:' + ancho + 'px"></i>';
    }
    return '<div class="barras" aria-hidden="true">' + barras + '</div>';
  }

  function boton(rol, texto, clase) {
    return '<button type="button" class="btn ' + (clase || '') + '" data-rol="' + rol + '">' + texto + '</button>';
  }

  /** Pie de navegacion comun a los pasos intermedios. */
  function navegacion(textoAvanzar, extra) {
    return '<div class="acciones">' +
      boton('atras', 'Atras', 'btn--plano') +
      (extra || '') +
      boton('avanzar', textoAvanzar, 'btn--principal') +
      '</div>';
  }

  function encabezado(titulo, bajada) {
    return '<header class="panel__encabezado">' +
      '<h2 class="panel__titulo">' + titulo + '</h2>' +
      (bajada ? '<p class="panel__bajada">' + bajada + '</p>' : '') +
      '</header>';
  }

  /* =======================================================================
     PANTALLAS
     Cada una define:
       html(vista)              markup inicial del panel
       montar(el, vista)        engancha los controles (una sola vez)
       actualizar(el, vista)    refresca solo lo que cambia dentro del paso
     ======================================================================= */

  var PANTALLAS = {};

  /* ---------- 1. Identificacion ---------- */
  PANTALLAS.identificacion = {
    html: function () {
      var ejemplos = APP.checkinDatos.codigosDeEjemplo().map(function (e) {
        return '<li><button type="button" class="ejemplo" data-codigo="' + esc(e.codigo) +
          '" data-documento="' + esc(e.documento) + '">' +
          '<span class="ejemplo__codigo">' + esc(e.codigo) + '</span>' +
          '<span class="ejemplo__detalle">' + esc(e.documento) + ' &middot; ' + esc(e.pista) + '</span>' +
          '</button></li>';
      }).join('');

      return encabezado('Check-in en linea', 'Ten a mano tu codigo de reserva y el documento con que compraste.') +
        '<form class="formulario" data-rol="formulario" novalidate>' +
          '<label class="campo">' +
            '<span class="campo__label">Codigo de reserva</span>' +
            '<input class="campo__input campo__input--codigo" data-rol="codigo" type="text" ' +
              'inputmode="text" autocomplete="off" spellcheck="false" maxlength="8" placeholder="AN7K2P" />' +
          '</label>' +
          '<label class="campo">' +
            '<span class="campo__label">Documento del pasajero</span>' +
            '<input class="campo__input" data-rol="documento" type="text" ' +
              'autocomplete="off" spellcheck="false" placeholder="12.345.678-9 o pasaporte" />' +
            '<span class="campo__ayuda">RUN o pasaporte, el mismo de la compra.</span>' +
          '</label>' +
          '<p class="alerta alerta--error" data-rol="error" hidden></p>' +
          '<div class="acciones acciones--sola">' +
            '<button type="submit" class="btn btn--principal">Buscar mi reserva</button>' +
          '</div>' +
        '</form>' +
        '<details class="demo">' +
          '<summary class="demo__titulo">Reservas de ejemplo para la demo</summary>' +
          '<p class="demo__texto">No existe ninguna base de datos detras: estas son las cuatro ' +
            'reservas ficticias que trae la maqueta. Toca una para completar el formulario.</p>' +
          '<ul class="demo__lista">' + ejemplos + '</ul>' +
        '</details>' +
        nota('Simulacion &mdash; la identidad no se verifica contra ningun registro real. ' +
             'Solo se compara el documento con el de la reserva ficticia.');
    },

    montar: function (el) {
      var campoCodigo = el.querySelector('[data-rol="codigo"]');
      var campoDoc = el.querySelector('[data-rol="documento"]');

      // El codigo de reserva se muestra siempre en mayusculas, como en el ticket.
      campoCodigo.addEventListener('input', function () {
        var pos = this.selectionStart;
        this.value = this.value.toUpperCase();
        this.setSelectionRange(pos, pos);
      });

      el.querySelector('[data-rol="formulario"]').addEventListener('submit', function (e) {
        e.preventDefault();
        flujo.identificar(campoCodigo.value.trim(), campoDoc.value.trim());
      });

      Array.prototype.forEach.call(el.querySelectorAll('.ejemplo'), function (btn) {
        btn.addEventListener('click', function () {
          campoCodigo.value = btn.dataset.codigo;
          campoDoc.value = btn.dataset.documento;
          campoCodigo.focus();
        });
      });

      campoCodigo.focus();
    },

    actualizar: function (el, vista) {
      var error = el.querySelector('[data-rol="error"]');
      error.hidden = !vista.error;
      if (vista.error) error.innerHTML = esc(vista.error.texto);

      el.querySelector('[data-rol="codigo"]')
        .classList.toggle('campo__input--error', Boolean(vista.error) && vista.error.campo === 'codigo');
      el.querySelector('[data-rol="documento"]')
        .classList.toggle('campo__input--error', Boolean(vista.error) && vista.error.campo === 'documento');
    }
  };

  /* ---------- 2. Confirmacion del vuelo ---------- */
  PANTALLAS.vuelo = {
    html: function (vista) {
      var r = vista.reserva;
      var v = r.vuelo;
      var traeMenor = r.menores.length > 0;

      var menores = r.menores.map(function (m) {
        return '<li>' + esc(m.nombre) + ' <span class="dato__nota">' + m.edad + ' anos &middot; ' + esc(m.parentesco) + '</span></li>';
      }).join('');

      return encabezado('Confirma tu vuelo', 'Revisa que los datos sean los correctos antes de seguir.') +

        '<article class="tarjeta tarjeta--vuelo">' +
          '<div class="tarjeta__fila">' +
            '<div>' +
              '<span class="dato__label">Pasajero</span>' +
              '<span class="dato__valor">' + esc(r.pasajero.nombre) + '</span>' +
              '<span class="dato__nota">' + esc(r.pasajero.tipoDocumento) + ' ' + esc(r.documento) + '</span>' +
            '</div>' +
            '<div class="tarjeta__pill">' + esc(v.codigo) + '</div>' +
          '</div>' +

          '<div class="tramo">' +
            '<div class="tramo__punta">' +
              '<span class="tramo__iata">' + esc(v.origen) + '</span>' +
              '<span class="tramo__ciudad">' + APP.aeropuertos.ciudad(v.origen) + '</span>' +
              '<span class="tramo__hora">' + APP.tiempo.aTexto(v.salidaTs) + '</span>' +
            '</div>' +
            '<div class="tramo__linea" aria-hidden="true"><span></span></div>' +
            '<div class="tramo__punta tramo__punta--fin">' +
              '<span class="tramo__iata">' + esc(v.destino) + '</span>' +
              '<span class="tramo__ciudad">' + APP.aeropuertos.ciudad(v.destino) + '</span>' +
              '<span class="tramo__hora">' + APP.tiempo.aTexto(v.llegadaTs) + '</span>' +
            '</div>' +
          '</div>' +

          '<div class="datos">' +
            '<div class="dato"><span class="dato__label">Fecha</span><span class="dato__valor">' +
              APP.tiempo.aFechaCorta(v.salidaTs) + '</span></div>' +
            '<div class="dato"><span class="dato__label">Duracion</span><span class="dato__valor">' +
              APP.tiempo.duracion(v.duracionMin) + '</span></div>' +
            '<div class="dato"><span class="dato__label">Puerta</span><span class="dato__valor">' +
              esc(v.puerta) + '</span></div>' +
            '<div class="dato"><span class="dato__label">Asiento</span><span class="dato__valor">' +
              esc(r.asiento) + '</span></div>' +
            '<div class="dato"><span class="dato__label">Cabina</span><span class="dato__valor">' +
              esc(r.cabina) + '</span></div>' +
            '<div class="dato"><span class="dato__label">Equipo</span><span class="dato__valor">' +
              esc(v.equipo) + '</span></div>' +
          '</div>' +
        '</article>' +

        '<section class="bloque">' +
          '<h3 class="bloque__titulo">Antes de continuar</h3>' +
          (traeMenor
            ? '<div class="aviso">' +
                '<p class="aviso__texto">Tu reserva incluye un menor de edad. Mas adelante te vamos a ' +
                  'preguntar con quien viaja, porque de eso depende la documentacion que necesitas.</p>' +
                '<ul class="lista-simple">' + menores + '</ul>' +
              '</div>'
            : '<label class="opcion">' +
                '<input type="checkbox" data-rol="menor" />' +
                '<span><span class="opcion__titulo">Viajo con un menor de edad a mi cargo</span>' +
                '<span class="opcion__nota">Marca esta casilla si un menor viaja bajo tu responsabilidad ' +
                'en este vuelo.</span></span>' +
              '</label>') +
        '</section>' +

        navegacion('Continuar');
    },

    montar: function (el) {
      var casilla = el.querySelector('[data-rol="menor"]');
      if (casilla) {
        casilla.addEventListener('change', function () {
          flujo.setViajaConMenor(this.checked);
        });
      }
    }
  };

  /* ---------- 3. Equipaje ---------- */
  PANTALLAS.equipaje = {
    html: function (vista) {
      var c = vista.config;
      var f = vista.reserva.franquicia;

      return encabezado('Declara tu equipaje', 'Con esto calculamos si corresponde algun cargo antes de llegar al aeropuerto.') +

        '<section class="bloque">' +
          '<h3 class="bloque__titulo">Equipaje de mano</h3>' +
          '<p class="bloque__bajada">Tu tarifa incluye ' + f.mano + ' pieza(s) de hasta ' +
            c.MANO_PESO_MAX_KG + ' kg que quepan en ' + c.MANO_MEDIDAS_CM + ' cm.</p>' +

          '<div class="medidor">' +
            '<div class="medidor__caja" aria-hidden="true">' +
              '<span class="medidor__cota medidor__cota--alto">55</span>' +
              '<span class="medidor__cota medidor__cota--ancho">35</span>' +
              '<span class="medidor__cota medidor__cota--fondo">25</span>' +
            '</div>' +
            '<p class="medidor__texto">Es el mismo medidor que hoy esta en el mostrador: si tu bolso ' +
              'no entra, viaja en bodega.</p>' +
          '</div>' +

          '<div class="contador">' +
            '<span class="contador__label">Piezas de mano</span>' +
            '<div class="contador__controles">' +
              '<button type="button" class="paso" data-rol="mano-menos" aria-label="Quitar una pieza">&minus;</button>' +
              '<span class="contador__valor" data-rol="mano-valor">0</span>' +
              '<button type="button" class="paso" data-rol="mano-mas" aria-label="Agregar una pieza">+</button>' +
            '</div>' +
          '</div>' +

          '<label class="opcion">' +
            '<input type="checkbox" data-rol="mano-no-cabe" />' +
            '<span><span class="opcion__titulo">Mi bolso no cabe en el medidor</span>' +
            '<span class="opcion__nota">Lo despachamos a bodega. Tiene un cargo de ' +
              pesos(c.TARIFA_MANO_A_BODEGA) + '.</span></span>' +
          '</label>' +
        '</section>' +

        '<section class="bloque">' +
          '<h3 class="bloque__titulo">Equipaje despachado</h3>' +
          '<p class="bloque__bajada">Incluye ' + f.despachadas + ' maleta(s) de hasta ' +
            c.DESPACHADA_PESO_MAX_KG + ' kg. Sobre ese peso se cobra ' + pesos(c.TARIFA_EXCESO_KG) +
            ' por kilo, y el tope por pieza es ' + c.DESPACHADA_PESO_TOPE_KG + ' kg.</p>' +

          '<div class="maletas" data-rol="maletas"></div>' +
          '<button type="button" class="btn btn--suave" data-rol="agregar">Agregar maleta</button>' +
        '</section>' +

        '<section class="resumen" data-rol="resumen">' +
          '<h3 class="bloque__titulo">Resumen de cargos</h3>' +
          '<div data-rol="detalle"></div>' +
          '<div class="resumen__total">' +
            '<span>Total a pagar</span>' +
            '<strong data-rol="total">' + pesos(0) + '</strong>' +
          '</div>' +
        '</section>' +

        '<div class="alerta alerta--error" data-rol="bloqueos" hidden></div>' +

        navegacion('Continuar') +
        nota('Simulacion &mdash; los pesos los declaras tu; no hay balanza ni medidor conectado.');
    },

    montar: function (el) {
      el.querySelector('[data-rol="mano-menos"]').addEventListener('click', function () {
        var v = flujo.obtenerVista();
        flujo.setEquipajeMano(v.equipaje.mano - 1);
      });

      el.querySelector('[data-rol="mano-mas"]').addEventListener('click', function () {
        var v = flujo.obtenerVista();
        flujo.setEquipajeMano(v.equipaje.mano + 1);
      });

      el.querySelector('[data-rol="mano-no-cabe"]').addEventListener('change', function () {
        var v = flujo.obtenerVista();
        flujo.setEquipajeMano(v.equipaje.mano, this.checked);
      });

      el.querySelector('[data-rol="agregar"]').addEventListener('click', function () {
        flujo.agregarMaleta();
      });

      // Delegacion: las maletas se crean y se borran, no conviene enganchar
      // cada control por separado.
      var contenedor = el.querySelector('[data-rol="maletas"]');

      contenedor.addEventListener('input', function (e) {
        var control = e.target.closest('[data-rol="peso"]');
        if (!control) return;
        flujo.setPesoMaleta(Number(control.dataset.indice), control.value);
      });

      contenedor.addEventListener('click', function (e) {
        var quitar = e.target.closest('[data-rol="quitar"]');
        if (!quitar) return;
        flujo.quitarMaleta(Number(quitar.dataset.indice));
      });

      el.querySelector('[data-rol="bloqueos"]').addEventListener('click', function (e) {
        if (!e.target.closest('[data-rol="a-mostrador"]')) return;
        flujo.derivarAMostrador(
          'Necesitas ayuda con tu equipaje',
          'Una de tus maletas supera el tope de peso por pieza que se puede despachar en autoservicio.',
          'En el mostrador pueden redistribuir el peso o documentar la pieza como carga especial.'
        );
      });
    },

    actualizar: function (el, vista) {
      var c = vista.config;
      var eq = vista.equipaje;

      el.querySelector('[data-rol="mano-valor"]').textContent = eq.mano;
      el.querySelector('[data-rol="mano-menos"]').disabled = eq.mano <= 0;
      el.querySelector('[data-rol="mano-mas"]').disabled = eq.mano >= 2;
      el.querySelector('[data-rol="mano-no-cabe"]').checked = eq.manoNoCabe;

      /* Maletas: se reconstruyen solo cuando cambia la cantidad. Si se
         reconstruyeran en cada tecla, el slider perderia el foco al arrastrar. */
      var contenedor = el.querySelector('[data-rol="maletas"]');
      if (contenedor.children.length !== eq.despachadas.length) {
        contenedor.innerHTML = eq.despachadas.map(function (peso, i) {
          var incluida = i < vista.reserva.franquicia.despachadas;
          return '<div class="maleta">' +
            '<div class="maleta__cabecera">' +
              '<span class="maleta__nombre">Maleta ' + (i + 1) +
                '<span class="maleta__tipo">' + (incluida ? 'incluida en la tarifa' : 'adicional') + '</span>' +
              '</span>' +
              '<button type="button" class="quitar" data-rol="quitar" data-indice="' + i + '">Quitar</button>' +
            '</div>' +
            '<div class="maleta__peso">' +
              '<input type="range" class="rango" data-rol="peso" data-indice="' + i + '" ' +
                'min="0" max="45" step="0.5" value="' + peso + '" ' +
                'aria-label="Peso de la maleta ' + (i + 1) + ' en kilos" />' +
              '<span class="maleta__kg" data-rol="kg-' + i + '">' + kg(peso) + '</span>' +
            '</div>' +
            '<span class="maleta__estado" data-rol="estado-' + i + '"></span>' +
          '</div>';
        }).join('');
      }

      // Peso y etiqueta de cada maleta (esto si cambia en cada movimiento).
      eq.despachadas.forEach(function (peso, i) {
        var etiquetaKg = el.querySelector('[data-rol="kg-' + i + '"]');
        var estado = el.querySelector('[data-rol="estado-' + i + '"]');
        if (!etiquetaKg) return;

        etiquetaKg.textContent = kg(peso);

        var sobreTope = peso > c.DESPACHADA_PESO_TOPE_KG;
        var conExceso = peso > c.DESPACHADA_PESO_MAX_KG;

        etiquetaKg.classList.toggle('maleta__kg--alerta', conExceso);

        if (sobreTope) {
          estado.textContent = 'Supera el tope de ' + c.DESPACHADA_PESO_TOPE_KG + ' kg por pieza';
        } else if (conExceso) {
          estado.textContent = 'Exceso de ' + Math.ceil(peso - c.DESPACHADA_PESO_MAX_KG) + ' kg';
        } else {
          estado.textContent = 'Dentro de los ' + c.DESPACHADA_PESO_MAX_KG + ' kg incluidos';
        }
        estado.classList.toggle('maleta__estado--alerta', conExceso);
      });

      el.querySelector('[data-rol="agregar"]').disabled =
        eq.despachadas.length >= c.MAX_MALETAS_DESPACHADAS;

      /* Resumen de cargos */
      var detalle = el.querySelector('[data-rol="detalle"]');
      detalle.innerHTML = vista.cargos.detalle.length
        ? vista.cargos.detalle.map(function (d) {
            return '<div class="resumen__linea">' +
              '<span>' + d.concepto + '<span class="resumen__nota">' + d.nota + '</span></span>' +
              '<span class="resumen__monto">' + pesos(d.monto) + '</span>' +
            '</div>';
          }).join('')
        : '<p class="resumen__vacio">Tu equipaje esta dentro de lo incluido en la tarifa.</p>';

      var total = el.querySelector('[data-rol="total"]');
      total.textContent = pesos(vista.cargos.total);
      total.classList.toggle('resumen__total--cobro', vista.cargos.total > 0);

      // Destello cuando el total cambia: el mismo recurso que usa el tablero
      // para marcar el momento exacto en que algo cambio.
      if (totalPintado !== null && totalPintado !== vista.cargos.total) {
        total.classList.remove('destella');
        void total.offsetWidth;
        total.classList.add('destella');
      }
      totalPintado = vista.cargos.total;

      /* Bloqueos: no se resuelven pagando, hay que ir a mostrador. */
      var bloqueos = el.querySelector('[data-rol="bloqueos"]');
      bloqueos.hidden = vista.cargos.bloqueos.length === 0;
      if (vista.cargos.bloqueos.length) {
        bloqueos.innerHTML = vista.cargos.bloqueos.map(function (b) {
          return '<p>' + b + '</p>';
        }).join('') +
        '<p class="alerta__accion">' +
          '<button type="button" class="btn btn--suave" data-rol="a-mostrador">Ir a un mostrador</button>' +
        '</p>';
      }

      var avanzar = el.querySelector('[data-rol="avanzar"]');
      avanzar.disabled = vista.cargos.bloqueos.length > 0;
      avanzar.textContent = vista.cargos.total > 0 ? 'Continuar al pago' : 'Continuar';
    }
  };

  /* ---------- 4. Pago simulado del exceso ---------- */
  PANTALLAS.pago = {
    html: function (vista) {
      var medios = APP.checkinDatos.MEDIOS_PAGO.map(function (m) {
        return '<label class="medio">' +
          '<input type="radio" name="medio" value="' + m.id + '" data-rol="medio" />' +
          '<span class="medio__cuerpo">' +
            '<span class="medio__nombre">' + m.nombre +
              (m.preferido ? '<span class="medio__tag">sin sacar la tarjeta</span>' : '') +
            '</span>' +
            '<span class="medio__detalle">' + m.detalle + '</span>' +
          '</span>' +
        '</label>';
      }).join('');

      var detalle = vista.cargos.detalle.map(function (d) {
        return '<div class="resumen__linea">' +
          '<span>' + d.concepto + '<span class="resumen__nota">' + d.nota + '</span></span>' +
          '<span class="resumen__monto">' + pesos(d.monto) + '</span>' +
        '</div>';
      }).join('');

      return encabezado('Exceso de equipaje', 'Se paga aqui mismo, para no tener que resolverlo en la fila.') +

        '<div class="monto">' +
          '<span class="monto__label">Total a pagar</span>' +
          '<span class="monto__valor">' + pesos(vista.cargos.total) + '</span>' +
        '</div>' +

        '<section class="resumen resumen--plano">' + detalle + '</section>' +

        '<section class="bloque">' +
          '<h3 class="bloque__titulo">Con que pagas</h3>' +
          '<div class="medios">' + medios + '</div>' +
        '</section>' +

        '<p class="alerta alerta--error" data-rol="error" hidden></p>' +

        '<div class="exito" data-rol="exito" hidden>' +
          '<span class="exito__check" aria-hidden="true">' +
            '<svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27 l8 8 l15 -16" /></svg>' +
          '</span>' +
          '<p class="exito__texto">Pago simulado como aprobado</p>' +
        '</div>' +

        '<div class="acciones">' +
          boton('atras', 'Atras', 'btn--plano') +
          boton('pagar', 'Pagar ' + pesos(vista.cargos.total), 'btn--principal') +
          boton('avanzar', 'Continuar', 'btn--principal') +
        '</div>' +

        '<label class="opcion opcion--demo">' +
          '<input type="checkbox" data-rol="rechazo" />' +
          '<span><span class="opcion__titulo">Simular un pago rechazado</span>' +
          '<span class="opcion__nota">Interruptor de demo: fuerza el camino de error para poder ' +
            'mostrarlo en la presentacion.</span></span>' +
        '</label>' +

        nota('Simulacion &mdash; sin conexion a medios de pago reales. No se cobra ningun monto ' +
             'y no se guarda ningun dato de tarjeta.');
    },

    montar: function (el) {
      el.querySelector('[data-rol="pagar"]').addEventListener('click', function () {
        flujo.pagar();
      });

      el.querySelector('[data-rol="rechazo"]').addEventListener('change', function () {
        flujo.setSimularRechazo(this.checked);
      });

      Array.prototype.forEach.call(el.querySelectorAll('[data-rol="medio"]'), function (radio) {
        radio.addEventListener('change', function () {
          flujo.setMedioPago(this.value);
        });
      });
    },

    actualizar: function (el, vista) {
      var pagado = vista.pago.estado === 'pagado';

      Array.prototype.forEach.call(el.querySelectorAll('[data-rol="medio"]'), function (radio) {
        radio.checked = radio.value === vista.pago.medio;
        radio.disabled = pagado;
      });

      el.querySelector('[data-rol="rechazo"]').checked = vista.pago.simularRechazo;

      var error = el.querySelector('[data-rol="error"]');
      error.hidden = !(vista.error && vista.error.campo === 'pago');
      if (!error.hidden) error.textContent = vista.error.texto;

      // Pagado: se esconde el boton de pagar y aparece el check animado.
      el.querySelector('[data-rol="exito"]').hidden = !pagado;
      el.querySelector('[data-rol="pagar"]').hidden = pagado;
      el.querySelector('[data-rol="avanzar"]').hidden = !pagado;

      var pagar = el.querySelector('[data-rol="pagar"]');
      pagar.textContent = vista.pago.estado === 'rechazado'
        ? 'Reintentar ' + pesos(vista.cargos.total)
        : 'Pagar ' + pesos(vista.cargos.total);
    }
  };

  /* ---------- 5. Autorizacion de viaje de un menor ---------- */
  PANTALLAS.menor = {
    html: function (vista) {
      var menores = vista.reserva.menores;

      var lista = menores.length
        ? '<ul class="lista-simple">' + menores.map(function (m) {
            return '<li>' + esc(m.nombre) + ' <span class="dato__nota">' + m.edad +
              ' anos &middot; ' + esc(m.parentesco) + '</span></li>';
          }).join('') + '</ul>'
        : '';

      return encabezado('Viaje de un menor de edad', 'De esto depende si puedes cerrar el check-in en linea.') +

        lista +

        '<section class="bloque">' +
          '<h3 class="bloque__titulo">El menor viaja con ambos padres o tutores legales?</h3>' +
          '<div class="eleccion" role="group">' +
            '<button type="button" class="eleccion__btn" data-rol="con-ambos">Si, viaja con ambos</button>' +
            '<button type="button" class="eleccion__btn" data-rol="sin-ambos">No, viaja sin uno o sin ambos</button>' +
          '</div>' +
        '</section>' +

        '<section class="bloque" data-rol="ok" hidden>' +
          '<div class="aviso aviso--ok">' +
            '<p class="aviso__texto">Con ambos padres o tutores presentes no se necesita autorizacion ' +
              'adicional. Recuerda llevar los documentos de identidad del menor.</p>' +
          '</div>' +
        '</section>' +

        '<section class="bloque" data-rol="pide-autorizacion" hidden>' +
          '<div class="aviso aviso--alerta">' +
            '<p class="aviso__texto">En ese caso se necesita la <strong>autorizacion notarial de ' +
              'viaje</strong> firmada por el padre, madre o tutor que no viaja. Sin ese documento no ' +
              'podemos cerrar el check-in en linea.</p>' +
          '</div>' +

          '<div class="adjunto" data-rol="sin-archivo">' +
            '<label class="btn btn--suave btn--archivo">' +
              'Adjuntar autorizacion' +
              '<input type="file" data-rol="archivo" accept=".pdf,.jpg,.jpeg,.png" hidden />' +
            '</label>' +
            '<p class="adjunto__nota">PDF o foto del documento notarial.</p>' +
          '</div>' +

          '<div class="adjunto adjunto--listo" data-rol="con-archivo" hidden>' +
            '<span class="exito__check exito__check--chico" aria-hidden="true">' +
              '<svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27 l8 8 l15 -16" /></svg>' +
            '</span>' +
            '<div>' +
              '<p class="adjunto__nombre" data-rol="nombre-archivo"></p>' +
              '<p class="adjunto__nota">Recibido. El contenido no se revisa en esta simulacion: ' +
                'en el aeropuerto se compara con el documento fisico.</p>' +
            '</div>' +
            '<button type="button" class="quitar" data-rol="quitar-archivo">Quitar</button>' +
          '</div>' +

          '<p class="adjunto__salida">Si no tienes el documento a mano, ' +
            '<button type="button" class="enlace" data-rol="a-mostrador">continua en un mostrador</button>.</p>' +
        '</section>' +

        navegacion('Continuar') +
        nota('Simulacion &mdash; el archivo no se sube a ningun servidor ni se valida su contenido. ' +
             'Solo se registra que fue adjuntado.');
    },

    montar: function (el) {
      el.querySelector('[data-rol="con-ambos"]').addEventListener('click', function () {
        flujo.responderMenorConAmbosPadres(true);
      });

      el.querySelector('[data-rol="sin-ambos"]').addEventListener('click', function () {
        flujo.responderMenorConAmbosPadres(false);
      });

      el.querySelector('[data-rol="archivo"]').addEventListener('change', function () {
        // Solo se toma el nombre: el archivo nunca sale del navegador.
        var nombre = this.files && this.files[0] ? this.files[0].name : 'autorizacion.pdf';
        flujo.adjuntarAutorizacion(nombre);
        this.value = '';
      });

      el.querySelector('[data-rol="quitar-archivo"]').addEventListener('click', function () {
        flujo.quitarAutorizacion();
      });

      el.querySelector('[data-rol="a-mostrador"]').addEventListener('click', function () {
        flujo.derivarAMostrador(
          'Te esperamos en el mostrador',
          'El viaje de un menor sin ambos padres o tutores necesita la autorizacion notarial ' +
            'antes de embarcar.',
          'Un agente puede revisar el documento original y completar el check-in contigo.'
        );
      });
    },

    actualizar: function (el, vista) {
      var respuesta = vista.declaraciones.menorConAmbosPadres;
      var adjunto = vista.declaraciones.autorizacion;

      el.querySelector('[data-rol="con-ambos"]').setAttribute('aria-pressed', String(respuesta === true));
      el.querySelector('[data-rol="sin-ambos"]').setAttribute('aria-pressed', String(respuesta === false));
      el.querySelector('[data-rol="con-ambos"]').classList.toggle('eleccion__btn--activa', respuesta === true);
      el.querySelector('[data-rol="sin-ambos"]').classList.toggle('eleccion__btn--activa', respuesta === false);

      el.querySelector('[data-rol="ok"]').hidden = respuesta !== true;
      el.querySelector('[data-rol="pide-autorizacion"]').hidden = respuesta !== false;

      el.querySelector('[data-rol="sin-archivo"]').hidden = Boolean(adjunto);
      el.querySelector('[data-rol="con-archivo"]').hidden = !adjunto;
      if (adjunto) {
        el.querySelector('[data-rol="nombre-archivo"]').textContent = adjunto.nombre;
      }

      el.querySelector('[data-rol="avanzar"]').disabled = !vista.autorizacionResuelta;
    }
  };

  /* ---------- 6. Restricciones de salida (solo informativo) ---------- */
  PANTALLAS.restricciones = {
    html: function (vista) {
      var v = vista.reserva.vuelo;

      // Un arraigo lo verifica el control migratorio, no la aerolinea. Por eso
      // esta pantalla informa y no pide confirmar nada: no existe una casilla
      // que "acredite" no tener restricciones judiciales.
      var salida = vista.internacional
        ? '<div class="aviso aviso--info">' +
            '<h3 class="aviso__titulo">Salida del pais</h3>' +
            '<p class="aviso__texto">Tu vuelo sale de ' + APP.aeropuertos.pais(v.origen) +
              ' hacia ' + APP.aeropuertos.pais(v.destino) + '. La salida del pais esta sujeta a que no ' +
              'existan restricciones judiciales vigentes a tu nombre, como un arraigo.</p>' +
            '<p class="aviso__texto">Esa validacion la realiza el control migratorio de la Policia de ' +
              'Investigaciones en el aeropuerto, contra los registros del Poder Judicial. ' +
              '<strong>AeroAndes no tiene acceso a esos registros y no la verifica aqui.</strong></p>' +
          '</div>'
        : '<div class="aviso aviso--info">' +
            '<h3 class="aviso__titulo">Vuelo nacional</h3>' +
            '<p class="aviso__texto">Para volar dentro del pais necesitas tu documento de identidad ' +
              'vigente. Si ademas viaja un menor, lleva su documento.</p>' +
          '</div>';

      var recordatorios = [
        'Documento de identidad vigente, el mismo con que hiciste el check-in.',
        vista.internacional ? 'Pasaporte vigente y, si el destino lo exige, visa.' : null,
        vista.declaraciones.viajaConMenor ? 'Documentos del menor y, si corresponde, la autorizacion notarial original.' : null,
        'Presentate en la puerta ' + esc(v.puerta) + ' a la hora de embarque indicada en tu pase.'
      ].filter(Boolean).map(function (t) { return '<li>' + t + '</li>'; }).join('');

      return encabezado('Antes de viajar', 'Un recordatorio, no una verificacion.') +
        salida +
        '<section class="bloque">' +
          '<h3 class="bloque__titulo">Lleva contigo</h3>' +
          '<ul class="lista-check">' + recordatorios + '</ul>' +
        '</section>' +
        navegacion('Emitir mi pase de abordar') +
        nota('Simulacion &mdash; esta pantalla es informativa. No se consulta ninguna base de datos ' +
             'judicial ni migratoria.');
    }
  };

  /* ---------- 7. Pase de abordar ---------- */
  PANTALLAS.pase = {
    html: function (vista) {
      var p = vista.pase;
      var v = p.vuelo;

      var etiquetas = p.etiquetas.length
        ? '<section class="bloque">' +
            '<h3 class="bloque__titulo">Etiquetas de equipaje</h3>' +
            '<div class="etiquetas">' +
              p.etiquetas.map(function (e) {
                return '<article class="etiqueta">' +
                  '<div class="etiqueta__destino">' + esc(e.destino) + '</div>' +
                  '<div class="etiqueta__datos">' +
                    '<span class="etiqueta__numero">' + esc(e.numero) + '</span>' +
                    '<span class="etiqueta__nota">' + esc(p.pasajero) + ' &middot; ' + esc(v.codigo) +
                      (e.peso !== null ? ' &middot; ' + kg(e.peso) : ' &middot; desde cabina') + '</span>' +
                  '</div>' +
                  barrasSimuladas(28) +
                '</article>';
              }).join('') +
            '</div>' +
            '<p class="bloque__bajada">Imprimelas en el aeropuerto o muestralas en el drop-off ' +
              'de equipaje. No pases por el mostrador de documentacion.</p>' +
          '</section>'
        : '';

      return '<div class="exito exito--grande">' +
          '<span class="exito__check" aria-hidden="true">' +
            '<svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27 l8 8 l15 -16" /></svg>' +
          '</span>' +
          '<h2 class="panel__titulo">Check-in listo</h2>' +
          '<p class="panel__bajada">Tu pase de abordar simulado esta emitido.</p>' +
        '</div>' +

        '<article class="pase">' +
          '<div class="pase__cabecera">' +
            '<span class="pase__marca">AeroAndes</span>' +
            '<span class="pase__tipo">Pase de abordar</span>' +
          '</div>' +

          '<div class="pase__cuerpo">' +
            '<div class="pase__pasajero">' +
              '<span class="dato__label">Pasajero</span>' +
              '<span class="pase__nombre">' + esc(p.pasajero) + '</span>' +
            '</div>' +

            '<div class="tramo tramo--pase">' +
              '<div class="tramo__punta">' +
                '<span class="tramo__iata">' + esc(v.origen) + '</span>' +
                '<span class="tramo__hora">' + APP.tiempo.aTexto(v.salidaTs) + '</span>' +
              '</div>' +
              '<div class="tramo__linea" aria-hidden="true"><span></span></div>' +
              '<div class="tramo__punta tramo__punta--fin">' +
                '<span class="tramo__iata">' + esc(v.destino) + '</span>' +
                '<span class="tramo__hora">' + APP.tiempo.aTexto(v.llegadaTs) + '</span>' +
              '</div>' +
            '</div>' +

            '<div class="datos datos--pase">' +
              '<div class="dato"><span class="dato__label">Vuelo</span><span class="dato__valor">' + esc(v.codigo) + '</span></div>' +
              '<div class="dato"><span class="dato__label">Fecha</span><span class="dato__valor">' + APP.tiempo.aFechaCorta(v.salidaTs) + '</span></div>' +
              '<div class="dato"><span class="dato__label">Puerta</span><span class="dato__valor">' + esc(v.puerta) + '</span></div>' +
              '<div class="dato"><span class="dato__label">Embarque</span><span class="dato__valor">' + APP.tiempo.aTexto(p.horaEmbarque) + '</span></div>' +
              '<div class="dato"><span class="dato__label">Asiento</span><span class="dato__valor dato__valor--fuerte">' + esc(p.asiento) + '</span></div>' +
              '<div class="dato"><span class="dato__label">Grupo</span><span class="dato__valor">' + esc(p.grupoEmbarque) + '</span></div>' +
              '<div class="dato"><span class="dato__label">Secuencia</span><span class="dato__valor">' + esc(p.secuencia) + '</span></div>' +
              '<div class="dato"><span class="dato__label">Cabina</span><span class="dato__valor">' + esc(p.cabina) + '</span></div>' +
            '</div>' +
          '</div>' +

          '<div class="pase__pie">' +
            barrasSimuladas(46) +
            '<span class="pase__codigo">' + esc(v.codigo) + ' &middot; ' + esc(p.asiento) +
              ' &middot; SEQ ' + esc(p.secuencia) + '</span>' +
          '</div>' +
        '</article>' +

        etiquetas +

        '<div class="acciones">' +
          boton('imprimir', 'Imprimir o guardar', 'btn--suave') +
          boton('reiniciar', 'Hacer otro check-in', 'btn--principal') +
        '</div>' +

        nota('Simulacion &mdash; este pase no es valido para embarcar. Los codigos de barras son ' +
             'decorativos y no codifican informacion.');
    },

    montar: function (el) {
      el.querySelector('[data-rol="imprimir"]').addEventListener('click', function () {
        window.print();
      });
      el.querySelector('[data-rol="reiniciar"]').addEventListener('click', function () {
        flujo.reiniciar();
      });
    }
  };

  /* ---------- Camino alternativo: mostrador ---------- */
  PANTALLAS.mostrador = {
    html: function (vista) {
      var m = vista.mostrador;

      return '<div class="desvio">' +
          '<span class="desvio__icono" aria-hidden="true">' +
            '<svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M26 14 v16" /><path d="M26 36 v2" /></svg>' +
          '</span>' +
          '<h2 class="panel__titulo">' + esc(m.titulo) + '</h2>' +
          '<p class="panel__bajada">' + esc(m.motivo) + '</p>' +
        '</div>' +

        '<div class="aviso aviso--info">' +
          '<p class="aviso__texto">' + esc(m.sugerencia) + '</p>' +
        '</div>' +

        '<section class="bloque">' +
          '<h3 class="bloque__titulo">Donde encontrarnos</h3>' +
          '<ul class="lista-simple">' +
            '<li>Counter AeroAndes &middot; nivel de salidas, modulos 12 a 18</li>' +
            '<li>Atencion continua desde 3 horas antes de cada vuelo</li>' +
          '</ul>' +
        '</section>' +

        '<div class="acciones">' +
          boton('reiniciar', 'Volver a intentar', 'btn--principal') +
        '</div>' +

        nota('Simulacion &mdash; los modulos y horarios de atencion son ficticios.');
    },

    montar: function (el) {
      el.querySelector('[data-rol="reiniciar"]').addEventListener('click', function () {
        flujo.reiniciar();
      });
    }
  };

  /* =======================================================================
     MONTAJE Y TRANSICIONES
     ======================================================================= */

  function montarPanel(vista) {
    pantalla = PANTALLAS[vista.paso];
    if (!pantalla) return;

    var nuevo = document.createElement('section');
    nuevo.className = 'panel panel--' + (vista.direccion === 'retrocede' ? 'entra-atras' : 'entra');
    nuevo.innerHTML = pantalla.html(vista);

    dom.escenario.innerHTML = '';
    dom.escenario.appendChild(nuevo);
    panel = nuevo;

    // Navegacion comun: todos los pasos intermedios la usan igual.
    var atras = panel.querySelector('[data-rol="atras"]');
    if (atras) atras.addEventListener('click', function () { flujo.retroceder(); });

    var avanzar = panel.querySelector('[data-rol="avanzar"]');
    if (avanzar) avanzar.addEventListener('click', function () { flujo.avanzar(); });

    if (pantalla.montar) pantalla.montar(panel, vista);

    // Al cambiar de paso la vista vuelve arriba: en el totem la pantalla es
    // grande y, si no, el pasajero no se entera de que cambio el paso.
    if (!primerPintado) {
      dom.escenario.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    primerPintado = false;
  }

  function pintarProgreso(vista) {
    // En el desvio a mostrador la barra no tiene sentido: el flujo se corto.
    dom.progreso.hidden = vista.paso === 'mostrador';
    if (dom.progreso.hidden) return;

    if (!dom.progreso.children.length) {
      dom.progreso.innerHTML = vista.grupos.map(function (g) {
        return '<li class="progreso__paso" data-grupo="' + g.id + '">' +
          '<span class="progreso__punto" aria-hidden="true"></span>' +
          '<span class="progreso__texto">' + g.titulo + '</span>' +
        '</li>';
      }).join('');
    }

    Array.prototype.forEach.call(dom.progreso.children, function (li, i) {
      li.classList.toggle('progreso__paso--activo', i === vista.indiceGrupo);
      li.classList.toggle('progreso__paso--hecho', i < vista.indiceGrupo);
      li.setAttribute('aria-current', i === vista.indiceGrupo ? 'step' : 'false');
    });
  }

  function pintarEspera(vista) {
    dom.espera.hidden = !vista.ocupado;
    if (vista.ocupado) dom.esperaTexto.textContent = vista.mensajeOcupado;
    // Mientras hay una espera simulada, el panel no debe aceptar clics.
    if (panel) panel.classList.toggle('panel--bloqueado', vista.ocupado);
  }

  function pintar(vista) {
    pintarProgreso(vista);

    if (vista.paso !== pasoPintado) {
      pasoPintado = vista.paso;
      totalPintado = null;
      montarPanel(vista);
    }

    if (pantalla && pantalla.actualizar && panel) {
      pantalla.actualizar(panel, vista);
    }

    pintarEspera(vista);
  }

  /* ---------- Modo totem ---------- */
  // Misma pagina, tipografia y controles mas grandes: es la forma barata de
  // servir al pasajero en su celular y en el totem del aeropuerto.
  function montarTotem() {
    function aplicar(activo) {
      document.body.classList.toggle('modo-totem', activo);
      dom.totem.setAttribute('aria-pressed', String(activo));
      dom.totem.textContent = activo ? 'Salir del modo totem' : 'Modo totem';
    }

    dom.totem.addEventListener('click', function () {
      var activo = !document.body.classList.contains('modo-totem');
      aplicar(activo);

      // La pantalla completa es opcional: si el navegador la niega, el modo
      // totem igual funciona, solo que dentro de la ventana.
      if (activo && document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(function () {});
      } else if (!activo && document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(function () {});
      }
    });

    // Permite abrir el totem ya configurado: checkin.html?totem=1
    if (/[?&]totem=1/.test(window.location.search)) aplicar(true);
  }

  /* ---------- API publica ---------- */
  return {
    iniciar: function (elFlujo) {
      flujo = elFlujo;

      dom = {
        escenario: document.getElementById('escenario'),
        progreso: document.getElementById('progreso'),
        espera: document.getElementById('espera'),
        esperaTexto: document.getElementById('espera-texto'),
        totem: document.getElementById('btn-totem')
      };

      montarTotem();
      flujo.alCambiar(pintar);
    }
  };
})();
