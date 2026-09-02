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

  /**
   * Pie de navegacion. El boton "Atras" solo aparece donde el flujo permite
   * volver: una vez pesado el equipaje en el aeropuerto, la declaracion ya no
   * se puede editar.
   */
  function navegacion(vista, textoAvanzar) {
    return '<div class="acciones">' +
      (vista.puedeRetroceder ? boton('atras', 'Atrás', 'btn--plano') : '') +
      boton('avanzar', textoAvanzar, 'btn--principal') +
      '</div>';
  }

  function encabezado(titulo, bajada) {
    return '<header class="panel__encabezado">' +
      '<h2 class="panel__titulo">' + titulo + '</h2>' +
      (bajada ? '<p class="panel__bajada">' + bajada + '</p>' : '') +
      '</header>';
  }

  /** Check animado + texto, para confirmar una accion completada. */
  function exito(rol, texto) {
    return '<div class="exito" data-rol="' + rol + '" hidden>' +
      '<span class="exito__check" aria-hidden="true">' +
        '<svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27 l8 8 l15 -16" /></svg>' +
      '</span>' +
      '<p class="exito__texto">' + texto + '</p>' +
    '</div>';
  }

  /** Grupo de botones para los controles de demo. */
  function opcionesDemo(rol, etiqueta, opciones, activa) {
    return '<div class="demo__grupo">' +
      '<span class="demo__label">' + etiqueta + '</span>' +
      '<div class="demo__opciones" role="group" aria-label="' + etiqueta + '">' +
        opciones.map(function (o) {
          return '<button type="button" class="demo__btn' + (o.id === activa ? ' demo__btn--activa' : '') +
            '" data-rol="' + rol + '" data-valor="' + o.id + '">' + o.texto + '</button>';
        }).join('') +
      '</div>' +
    '</div>';
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

      return encabezado('Check-in en línea', 'Ten a mano tu código de reserva y el documento con que compraste.') +
        '<form class="formulario" data-rol="formulario" novalidate>' +
          '<label class="campo">' +
            '<span class="campo__label">Código de reserva</span>' +
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
          '<p class="demo__texto">No existe ninguna base de datos detrás: estas son las cuatro ' +
            'reservas ficticias que trae la maqueta. Toca una para completar el formulario.</p>' +
          '<ul class="demo__lista">' + ejemplos + '</ul>' +
        '</details>' +
        nota('Simulación &mdash; la identidad no se verifica contra ningún registro real. ' +
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
      if (vista.error) error.textContent = vista.error.texto;

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
        return '<li>' + esc(m.nombre) + ' <span class="dato__nota">' + m.edad + ' años &middot; ' + esc(m.parentesco) + '</span></li>';
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
                '<p class="aviso__texto">Tu reserva incluye un menor de edad. Más adelante te vamos a ' +
                  'preguntar con quien viaja, porque de eso depende la documentación que necesitas.</p>' +
                '<ul class="lista-simple">' + menores + '</ul>' +
              '</div>'
            : '<label class="opcion">' +
                '<input type="checkbox" data-rol="menor" />' +
                '<span><span class="opcion__titulo">Viajo con un menor de edad a mi cargo</span>' +
                '<span class="opcion__nota">Marca esta casilla si un menor viaja bajo tu responsabilidad ' +
                'en este vuelo.</span></span>' +
              '</label>') +
        '</section>' +

        navegacion(vista, 'Continuar');
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

  /* ---------- 3. Declaracion de equipaje ---------- */
  PANTALLAS.equipaje = {
    html: function (vista) {
      var c = vista.config;
      var f = vista.reserva.franquicia;

      return encabezado('Declara tu equipaje',
                        'Pesa tus maletas en cualquier balanza del aeropuerto e ingresa aquí lo que marque.') +

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
            '<p class="medidor__texto">Esta medida es <strong>orientativa</strong>, para que llegues ' +
              'preparado. Quien decide es el gabinete físico del aeropuerto: si tu bolso no entra ahí, ' +
              'lo facturamos en el momento.</p>' +
          '</div>' +

          '<div class="contador">' +
            '<span class="contador__label">Piezas de mano</span>' +
            '<div class="contador__controles">' +
              '<button type="button" class="paso" data-rol="mano-menos" aria-label="Quitar una pieza">&minus;</button>' +
              '<span class="contador__valor" data-rol="mano-valor">0</span>' +
              '<button type="button" class="paso" data-rol="mano-mas" aria-label="Agregar una pieza">+</button>' +
            '</div>' +
          '</div>' +
          '<p class="pista" data-rol="mano-pista" hidden></p>' +
        '</section>' +

        '<section class="bloque">' +
          '<h3 class="bloque__titulo">Equipaje despachado</h3>' +
          '<p class="bloque__bajada">Incluye ' + f.despachadas + ' maleta(s) de hasta ' +
            c.DESPACHADA_PESO_MAX_KG + ' kg. Sobre ese peso se cobra ' + pesos(c.TARIFA_EXCESO_KG) +
            ' por kilo, y el tope por pieza es ' + c.DESPACHADA_PESO_TOPE_KG + ' kg. ' +
            'Puedes corregir el peso hasta que factures.</p>' +

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

        /* La declaracion tiene consecuencias economicas reales (deuda y bloqueo
           de viajes futuros), asi que se advierte y se pide aceptar. */
        '<section class="bloque">' +
          '<div class="aviso aviso--info">' +
            '<h3 class="aviso__titulo">Es tu declaración, bajo tu responsabilidad</h3>' +
            '<p class="aviso__texto">Es tu responsabilidad ingresar el peso real de tu equipaje. ' +
              'En el punto de entrega la maleta se vuelve a pesar.</p>' +
            '<p class="aviso__texto">Si el peso real es <strong>mayor</strong> al declarado se genera ' +
              'una deuda por la diferencia, y si no la regularizas dentro de ' + c.PLAZO_DEUDA_DIAS +
              ' días se bloquean tus viajes futuros con AeroAndes. Si el peso real es ' +
              '<strong>menor</strong>, te devolvemos la diferencia en millas o a tu tarjeta.</p>' +
          '</div>' +

          '<label class="opcion">' +
            '<input type="checkbox" data-rol="condiciones" />' +
            '<span><span class="opcion__titulo">Acepto las condiciones de declaración de equipaje</span>' +
            '<span class="opcion__nota">Declaro que los pesos ingresados son los que marcó la balanza.</span></span>' +
          '</label>' +
          '<p class="alerta alerta--error" data-rol="error-condiciones" hidden></p>' +
        '</section>' +

        /* Controles de demo: dejan mostrar cada desenlace sin depender del azar. */
        '<details class="demo">' +
          '<summary class="demo__titulo">Controles de demo</summary>' +
          '<p class="demo__texto">No son funciones del producto: sirven para elegir que camino ' +
            'mostrar en la presentación. Por defecto los dos resultados son aleatorios.</p>' +
          opcionesDemo('demo-verificacion', 'Segundo pesaje en el punto de entrega', [
            { id: 'aleatorio', texto: 'Aleatorio' },
            { id: 'coincide',  texto: 'Coincide' },
            { id: 'mayor',     texto: 'Pesa más' },
            { id: 'menor',     texto: 'Pesa menos' }
          ], vista.demo.verificacion) +
          opcionesDemo('demo-gabinete', 'Gabinete de equipaje de mano', [
            { id: 'aleatorio', texto: 'Aleatorio' },
            { id: 'pasa',      texto: 'Pasa' },
            { id: 'no-pasa',   texto: 'No pasa' }
          ], vista.demo.gabinete) +
        '</details>' +

        navegacion(vista, 'Continuar') +
        nota('Simulación &mdash; los pesos los declaras tú. No hay balanza ni gabinete conectados: ' +
             'el segundo pesaje también es simulado.');
    },

    montar: function (el) {
      el.querySelector('[data-rol="mano-menos"]').addEventListener('click', function () {
        flujo.setEquipajeMano(flujo.obtenerVista().equipaje.mano - 1);
      });

      el.querySelector('[data-rol="mano-mas"]').addEventListener('click', function () {
        flujo.setEquipajeMano(flujo.obtenerVista().equipaje.mano + 1);
      });

      el.querySelector('[data-rol="agregar"]').addEventListener('click', function () {
        flujo.agregarMaleta();
      });

      el.querySelector('[data-rol="condiciones"]').addEventListener('change', function () {
        flujo.aceptarCondiciones(this.checked);
      });

      /* Delegacion: las maletas se crean y se borran, no conviene enganchar
         cada control por separado. El slider y el campo numerico editan el
         mismo dato: cualquiera de los dos manda. */
      var contenedor = el.querySelector('[data-rol="maletas"]');

      contenedor.addEventListener('input', function (e) {
        var control = e.target.closest('[data-rol="peso"], [data-rol="peso-num"]');
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

      el.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-rol="demo-verificacion"], [data-rol="demo-gabinete"]');
        if (!btn) return;
        if (btn.dataset.rol === 'demo-verificacion') flujo.setDemoVerificacion(btn.dataset.valor);
        else flujo.setDemoGabinete(btn.dataset.valor);
      });
    },

    actualizar: function (el, vista) {
      var c = vista.config;
      var eq = vista.equipaje;
      var f = vista.reserva.franquicia;

      /* --- Equipaje de mano --- */
      el.querySelector('[data-rol="mano-valor"]').textContent = eq.mano;
      el.querySelector('[data-rol="mano-menos"]').disabled = eq.mano <= 0;
      el.querySelector('[data-rol="mano-mas"]').disabled = eq.mano >= 2;

      var pista = el.querySelector('[data-rol="mano-pista"]');
      var sobrantes = Math.max(0, eq.mano - f.mano);
      pista.hidden = sobrantes === 0;
      if (sobrantes > 0) {
        pista.textContent = 'Declaraste ' + sobrantes + ' pieza(s) sobre lo incluido: se facturan en el ' +
          'aeropuerto, ' + pesos(c.TARIFA_GATE_CHECK) + ' cada una.';
      }

      /* --- Maletas: se reconstruyen solo cuando cambia la cantidad. Si se
         reconstruyeran en cada tecla, el control perderia el foco al escribir. */
      var contenedor = el.querySelector('[data-rol="maletas"]');
      if (contenedor.children.length !== eq.despachadas.length) {
        contenedor.innerHTML = eq.despachadas.map(function (peso, i) {
          var incluida = i < f.despachadas;
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
              '<span class="maleta__campo">' +
                '<input type="number" class="maleta__num" data-rol="peso-num" data-indice="' + i + '" ' +
                  'min="0" max="45" step="0.1" value="' + peso + '" ' +
                  'aria-label="Peso en kilos de la maleta ' + (i + 1) + '" />' +
                '<span class="maleta__unidad">kg</span>' +
              '</span>' +
            '</div>' +
            '<span class="maleta__estado" data-rol="estado-' + i + '"></span>' +
          '</div>';
        }).join('');
      }

      /* Peso y etiqueta de cada maleta. No se reescribe el control que el
         pasajero esta usando en ese momento, para no pelear con su edicion. */
      eq.despachadas.forEach(function (peso, i) {
        var rango = el.querySelector('[data-rol="peso"][data-indice="' + i + '"]');
        var numero = el.querySelector('[data-rol="peso-num"][data-indice="' + i + '"]');
        var estado = el.querySelector('[data-rol="estado-' + i + '"]');
        if (!rango) return;

        if (document.activeElement !== rango) rango.value = peso;
        if (document.activeElement !== numero) numero.value = peso;

        var sobreTope = peso > c.DESPACHADA_PESO_TOPE_KG;
        var conExceso = peso > c.DESPACHADA_PESO_MAX_KG;

        numero.classList.toggle('maleta__num--alerta', conExceso);

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

      /* --- Resumen de cargos --- */
      var detalle = el.querySelector('[data-rol="detalle"]');
      detalle.innerHTML = vista.cargos.detalle.length
        ? vista.cargos.detalle.map(function (d) {
            return '<div class="resumen__linea">' +
              '<span>' + d.concepto + '<span class="resumen__nota">' + d.nota + '</span></span>' +
              '<span class="resumen__monto">' + pesos(d.monto) + '</span>' +
            '</div>';
          }).join('')
        : '<p class="resumen__vacio">Tu equipaje declarado está dentro de lo incluido en la tarifa.</p>';

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

      /* --- Bloqueos: no se resuelven pagando, hay que ir a mostrador --- */
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

      /* --- Condiciones y controles de demo --- */
      el.querySelector('[data-rol="condiciones"]').checked = eq.condicionesAceptadas;

      var errorCond = el.querySelector('[data-rol="error-condiciones"]');
      errorCond.hidden = !(vista.error && vista.error.campo === 'condiciones');
      if (!errorCond.hidden) errorCond.textContent = vista.error.texto;

      Array.prototype.forEach.call(el.querySelectorAll('[data-rol="demo-verificacion"]'), function (b) {
        b.classList.toggle('demo__btn--activa', b.dataset.valor === vista.demo.verificacion);
      });
      Array.prototype.forEach.call(el.querySelectorAll('[data-rol="demo-gabinete"]'), function (b) {
        b.classList.toggle('demo__btn--activa', b.dataset.valor === vista.demo.gabinete);
      });

      var avanzar = el.querySelector('[data-rol="avanzar"]');
      avanzar.disabled = vista.cargos.bloqueos.length > 0;
      avanzar.textContent = vista.cargos.total > 0 ? 'Continuar al pago' : 'Continuar';
    }
  };

  /* ---------- 4. Pago del exceso declarado ---------- */
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

      return encabezado('Exceso de equipaje', 'Se paga aquí mismo, para no tener que resolverlo en la fila.') +

        '<div class="monto">' +
          '<span class="monto__label">Total a pagar</span>' +
          '<span class="monto__valor">' + pesos(vista.cargos.total) + '</span>' +
        '</div>' +

        '<section class="resumen resumen--plano">' + detalle + '</section>' +

        '<section class="bloque">' +
          '<h3 class="bloque__titulo">Con qué pagas</h3>' +
          '<div class="medios">' + medios + '</div>' +
        '</section>' +

        '<p class="alerta alerta--error" data-rol="error" hidden></p>' +

        exito('exito', 'Pago simulado como aprobado') +

        '<div class="acciones">' +
          boton('atras', 'Atrás', 'btn--plano') +
          boton('pagar', 'Pagar ' + pesos(vista.cargos.total), 'btn--principal') +
          boton('avanzar', 'Continuar', 'btn--principal') +
        '</div>' +

        '<label class="opcion opcion--demo">' +
          '<input type="checkbox" data-rol="rechazo" />' +
          '<span><span class="opcion__titulo">Simular un pago rechazado</span>' +
          '<span class="opcion__nota">Interruptor de demo: fuerza el camino de error para poder ' +
            'mostrarlo en la presentación.</span></span>' +
        '</label>' +

        nota('Simulación &mdash; sin conexión a medios de pago reales. No se cobra ningún monto ' +
             'y no se guarda ningún dato de tarjeta.');
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

  /* ---------- 5. Verificacion en el punto de entrega ---------- */
  PANTALLAS.verificacion = {
    html: function (vista) {
      var v = vista.verificacion;

      var filas = v.piezas.map(function (p, i) {
        var dif = p.real - p.declarado;
        var igual = Math.abs(dif) < 0.01;
        var clase = igual ? '' : (dif > 0 ? ' pesaje__dif--mas' : ' pesaje__dif--menos');

        return '<div class="pesaje">' +
          '<span class="pesaje__nombre">Maleta ' + (i + 1) + '</span>' +
          '<span class="pesaje__valor">' +
            '<span class="pesaje__label">Declaraste</span>' + kg(p.declarado) +
          '</span>' +
          '<span class="pesaje__valor">' +
            '<span class="pesaje__label">Balanza</span><strong>' + kg(p.real) + '</strong>' +
          '</span>' +
          '<span class="pesaje__dif' + clase + '">' +
            (igual ? 'sin diferencia' : (dif > 0 ? '+' : '') + kg(dif)) +
          '</span>' +
        '</div>';
      }).join('');

      var resumen;
      if (v.resultado === 'coincide') {
        resumen = '<div class="exito exito--grande">' +
            '<span class="exito__check" aria-hidden="true">' +
              '<svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27 l8 8 l15 -16" /></svg>' +
            '</span>' +
            '<p class="exito__texto">Lo que declaraste cuadra con la balanza. No hay nada que ajustar.</p>' +
          '</div>';
      } else if (v.resultado === 'deuda') {
        resumen = '<div class="aviso aviso--alerta">' +
            '<h3 class="aviso__titulo">Tu equipaje pesa más de lo declarado</h3>' +
            '<p class="aviso__texto">La diferencia son ' + pesos(v.monto) + '. En la pantalla ' +
              'siguiente puedes pagarla o dejarla pendiente.</p>' +
          '</div>';
      } else {
        resumen = '<div class="aviso aviso--info">' +
            '<h3 class="aviso__titulo">Pagaste de más</h3>' +
            '<p class="aviso__texto">Tu equipaje pesa menos de lo declarado: te devolvemos ' +
              pesos(v.monto) + '.</p>' +
          '</div>';
      }

      return encabezado('Verificación en el punto de entrega',
                        'Volvimos a pesar tu equipaje al recibirlo. Esto es lo que marcó la balanza.') +
        '<section class="bloque">' + filas + '</section>' +
        resumen +
        navegacion(vista, v.resultado === 'coincide' ? 'Continuar' : 'Ver el detalle') +
        nota('Simulación &mdash; adelantamos el momento en que tu maleta se vuelve a pesar. ' +
             'No hay balanza conectada: el peso verificado lo genera la maqueta.');
    }
  };

  /* ---------- 6a. Deuda por peso declarado de menos ---------- */
  PANTALLAS.deuda = {
    html: function (vista) {
      return encabezado('Diferencia por pagar', 'Tu equipaje pesó más de lo que declaraste.') +

        '<div class="monto monto--alerta">' +
          '<span class="monto__label">Diferencia</span>' +
          '<span class="monto__valor">' + pesos(vista.deuda.monto) + '</span>' +
        '</div>' +

        '<div class="aviso aviso--alerta">' +
          '<p class="aviso__texto">Puedes pagarla ahora con tu cuenta vinculada o dejarla pendiente. ' +
            'Si no la regularizas dentro de <strong>' + vista.config.PLAZO_DEUDA_DIAS + ' días</strong>, ' +
            'se bloquean tus viajes futuros con AeroAndes hasta que quede al día.</p>' +
          '<p class="aviso__texto">Tu check-in no se detiene por esto: puedes seguir y volar igual.</p>' +
        '</div>' +

        exito('exito', 'Pago simulado como aprobado') +

        '<div class="acciones">' +
          boton('aplazar', 'Pagar después', 'btn--plano') +
          boton('pagar', 'Pagar ' + pesos(vista.deuda.monto), 'btn--principal') +
          boton('avanzar', 'Continuar', 'btn--principal') +
        '</div>' +

        nota('Simulación &mdash; no se cobra ningún monto, no se genera ninguna deuda real y ' +
             'ningún viaje se bloquea de verdad.');
    },

    montar: function (el) {
      el.querySelector('[data-rol="pagar"]').addEventListener('click', function () {
        flujo.pagarDeuda();
      });
      el.querySelector('[data-rol="aplazar"]').addEventListener('click', function () {
        flujo.aplazarDeuda();
      });
    },

    actualizar: function (el, vista) {
      var pagada = vista.deuda.estado === 'pagada';
      el.querySelector('[data-rol="exito"]').hidden = !pagada;
      el.querySelector('[data-rol="pagar"]').hidden = pagada;
      el.querySelector('[data-rol="aplazar"]').hidden = pagada;
      el.querySelector('[data-rol="avanzar"]').hidden = !pagada;
    }
  };

  /* ---------- 6b. Reembolso por peso declarado de mas ---------- */
  PANTALLAS.reembolso = {
    html: function (vista) {
      var r = vista.reembolso;

      var medios = APP.checkinDatos.MEDIOS_REEMBOLSO.map(function (m) {
        var tag = m.id === 'millas'
          ? r.millas.toLocaleString('es-CL') + ' millas'
          : pesos(r.monto);

        return '<label class="medio">' +
          '<input type="radio" name="reembolso" value="' + m.id + '" data-rol="medio-reembolso" />' +
          '<span class="medio__cuerpo">' +
            '<span class="medio__nombre">' + m.nombre +
              '<span class="medio__tag">' + tag + '</span>' +
            '</span>' +
            '<span class="medio__detalle">' + m.detalle + '</span>' +
          '</span>' +
        '</label>';
      }).join('');

      return encabezado('Te devolvemos la diferencia', 'Tu equipaje pesó menos de lo que declaraste.') +

        '<div class="monto">' +
          '<span class="monto__label">A tu favor</span>' +
          '<span class="monto__valor">' + pesos(r.monto) + '</span>' +
        '</div>' +

        '<section class="bloque">' +
          '<h3 class="bloque__titulo">Cómo prefieres recibirlo</h3>' +
          '<div class="medios">' + medios + '</div>' +
        '</section>' +

        exito('exito', 'Reembolso simulado como registrado') +

        '<div class="acciones">' +
          boton('confirmar', 'Confirmar reembolso', 'btn--principal') +
          boton('avanzar', 'Continuar', 'btn--principal') +
        '</div>' +

        nota('Simulación &mdash; no hay devolucion real de dinero ni un programa de millas detrás.');
    },

    montar: function (el) {
      el.querySelector('[data-rol="confirmar"]').addEventListener('click', function () {
        flujo.confirmarReembolso();
      });

      Array.prototype.forEach.call(el.querySelectorAll('[data-rol="medio-reembolso"]'), function (radio) {
        radio.addEventListener('change', function () {
          flujo.setMedioReembolso(this.value);
        });
      });
    },

    actualizar: function (el, vista) {
      var listo = vista.reembolso.estado === 'confirmado';

      Array.prototype.forEach.call(el.querySelectorAll('[data-rol="medio-reembolso"]'), function (radio) {
        radio.checked = radio.value === vista.reembolso.medio;
        radio.disabled = listo;
      });

      el.querySelector('[data-rol="exito"]').hidden = !listo;
      el.querySelector('[data-rol="confirmar"]').hidden = listo;
      el.querySelector('[data-rol="avanzar"]').hidden = !listo;
    }
  };

  /* ---------- 6c. Gate-check del equipaje de mano ---------- */
  PANTALLAS.gatecheck = {
    html: function (vista) {
      var g = vista.gate;

      var motivos = [];
      if (g.noPasa) motivos.push('Tu bolso de mano no entró en el gabinete del aeropuerto.');
      if (g.sobrantes > 0) {
        motivos.push('Declaraste ' + g.sobrantes + ' pieza(s) de mano sobre lo que incluye tu tarifa.');
      }

      return encabezado('Facturamos tu equipaje de mano',
                        'Lo despachamos aquí mismo, para no mandarte a otra fila.') +

        '<div class="aviso aviso--info">' +
          motivos.map(function (m) { return '<p class="aviso__texto">' + m + '</p>'; }).join('') +
          '<p class="aviso__texto">Viaja en bodega y lo retiras en la cinta de tu destino. ' +
            'Se cobra con la misma cuenta que ya tienes vinculada.</p>' +
        '</div>' +

        '<div class="monto">' +
          '<span class="monto__label">' + g.piezas + ' pieza(s) a facturar</span>' +
          '<span class="monto__valor">' + pesos(g.monto) + '</span>' +
        '</div>' +

        exito('exito', 'Equipaje facturado, etiqueta emitida') +

        '<div class="acciones">' +
          boton('facturar', 'Facturar por ' + pesos(g.monto), 'btn--principal') +
          boton('avanzar', 'Continuar', 'btn--principal') +
        '</div>' +

        '<p class="adjunto__salida" data-rol="salida">Si prefieres resolverlo con una persona, ' +
          '<button type="button" class="enlace" data-rol="a-mostrador">continúa en un mostrador</button>.</p>' +

        nota('Simulación &mdash; no hay gabinete ni cobro reales. El resultado del gabinete lo ' +
             'genera la maqueta.');
    },

    montar: function (el) {
      el.querySelector('[data-rol="facturar"]').addEventListener('click', function () {
        flujo.facturarEnGate();
      });

      el.querySelector('[data-rol="a-mostrador"]').addEventListener('click', function () {
        flujo.derivarAMostrador(
          'Te esperamos en el mostrador',
          'Tu equipaje de mano tiene que facturarse antes de embarcar.',
          'Un agente puede documentarlo contigo y resolver el cobro en el counter.'
        );
      });
    },

    actualizar: function (el, vista) {
      var listo = vista.gate.estado === 'facturado';
      el.querySelector('[data-rol="exito"]').hidden = !listo;
      el.querySelector('[data-rol="facturar"]').hidden = listo;
      el.querySelector('[data-rol="avanzar"]').hidden = !listo;
      el.querySelector('[data-rol="salida"]').hidden = listo;
    }
  };

  /* ---------- 7. Autorizacion de viaje de un menor ---------- */
  PANTALLAS.menor = {
    html: function (vista) {
      var menores = vista.reserva.menores;

      var lista = menores.length
        ? '<ul class="lista-simple">' + menores.map(function (m) {
            return '<li>' + esc(m.nombre) + ' <span class="dato__nota">' + m.edad +
              ' años &middot; ' + esc(m.parentesco) + '</span></li>';
          }).join('') + '</ul>'
        : '';

      return encabezado('Viaje de un menor de edad', 'De esto depende si puedes cerrar el check-in en línea.') +

        lista +

        '<section class="bloque">' +
          '<h3 class="bloque__titulo">¿El menor viaja con ambos padres o tutores legales?</h3>' +
          '<div class="eleccion" role="group">' +
            '<button type="button" class="eleccion__btn" data-rol="con-ambos">Sí, viaja con ambos</button>' +
            '<button type="button" class="eleccion__btn" data-rol="sin-ambos">No, viaja sin uno o sin ambos</button>' +
          '</div>' +
        '</section>' +

        '<section class="bloque" data-rol="ok" hidden>' +
          '<div class="aviso aviso--ok">' +
            '<p class="aviso__texto">Con ambos padres o tutores presentes no se necesita autorización ' +
              'adicional. Recuerda llevar los documentos de identidad del menor.</p>' +
          '</div>' +
        '</section>' +

        '<section class="bloque" data-rol="pide-autorizacion" hidden>' +
          '<div class="aviso aviso--alerta">' +
            '<p class="aviso__texto">En ese caso se necesita la <strong>autorización notarial de ' +
              'viaje</strong> firmada por el padre, madre o tutor que no viaja. Sin ese documento no ' +
              'podemos cerrar el check-in en línea.</p>' +
          '</div>' +

          '<div class="adjunto" data-rol="sin-archivo">' +
            '<label class="btn btn--suave btn--archivo">' +
              'Adjuntar autorización' +
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
              '<p class="adjunto__nota">Recibido. El contenido no se revisa en esta simulación: ' +
                'en el aeropuerto se compara con el documento físico.</p>' +
            '</div>' +
            '<button type="button" class="quitar" data-rol="quitar-archivo">Quitar</button>' +
          '</div>' +

          '<p class="adjunto__salida">Si no tienes el documento a mano, ' +
            '<button type="button" class="enlace" data-rol="a-mostrador">continúa en un mostrador</button>.</p>' +
        '</section>' +

        navegacion(vista, 'Continuar') +
        nota('Simulación &mdash; el archivo no se sube a ningún servidor ni se valida su contenido. ' +
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
        var nombre = this.files && this.files[0] ? this.files[0].name : 'autorización.pdf';
        flujo.adjuntarAutorizacion(nombre);
        this.value = '';
      });

      el.querySelector('[data-rol="quitar-archivo"]').addEventListener('click', function () {
        flujo.quitarAutorizacion();
      });

      el.querySelector('[data-rol="a-mostrador"]').addEventListener('click', function () {
        flujo.derivarAMostrador(
          'Te esperamos en el mostrador',
          'El viaje de un menor sin ambos padres o tutores necesita la autorización notarial ' +
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

  /* ---------- 8. Restricciones de salida (solo informativo) ---------- */
  PANTALLAS.restricciones = {
    html: function (vista) {
      var v = vista.reserva.vuelo;

      // Un arraigo lo verifica el control migratorio, no la aerolinea. Por eso
      // esta pantalla informa y no pide confirmar nada: no existe una casilla
      // que "acredite" no tener restricciones judiciales.
      var salida = vista.internacional
        ? '<div class="aviso aviso--info">' +
            '<h3 class="aviso__titulo">Salida del país</h3>' +
            '<p class="aviso__texto">Tu vuelo sale de ' + APP.aeropuertos.pais(v.origen) +
              ' hacia ' + APP.aeropuertos.pais(v.destino) + '. La salida del país está sujeta a que no ' +
              'existan restricciones judiciales vigentes a tu nombre, como un arraigo.</p>' +
            '<p class="aviso__texto">Esa validación la realiza el control migratorio de la Policía de ' +
              'Investigaciones en el aeropuerto, contra los registros del Poder Judicial. ' +
              '<strong>AeroAndes no tiene acceso a esos registros y no la verifica aquí</strong>, ' +
              'y tampoco existe una vía pública para consultarlos.</p>' +
          '</div>'
        : '<div class="aviso aviso--info">' +
            '<h3 class="aviso__titulo">Vuelo nacional</h3>' +
            '<p class="aviso__texto">Para volar dentro del país necesitas tu documento de identidad ' +
              'vigente. Si además viaja un menor, lleva su documento.</p>' +
          '</div>';

      var recordatorios = [
        'Documento de identidad vigente, el mismo con que hiciste el check-in.',
        vista.internacional ? 'Pasaporte vigente y, si el destino lo exige, visa.' : null,
        vista.declaraciones.viajaConMenor ? 'Documentos del menor y, si corresponde, la autorización notarial original.' : null,
        'Preséntate en la puerta ' + esc(v.puerta) + ' a la hora de embarque indicada en tu pase.'
      ].filter(Boolean).map(function (t) { return '<li>' + t + '</li>'; }).join('');

      return encabezado('Antes de viajar', 'Un recordatorio, no una verificación.') +
        salida +
        '<section class="bloque">' +
          '<h3 class="bloque__titulo">Lleva contigo</h3>' +
          '<ul class="lista-check">' + recordatorios + '</ul>' +
        '</section>' +
        navegacion(vista, 'Emitir mi pase de abordar') +
        nota('Simulación &mdash; esta pantalla es informativa. No se consulta ninguna base de datos ' +
             'judicial ni migratoria.');
    }
  };

  /* ---------- 9. Pase de abordar ---------- */
  PANTALLAS.pase = {
    html: function (vista) {
      var p = vista.pase;
      var v = p.vuelo;

      // Una deuda aplazada tiene que seguir visible: es la consecuencia que el
      // pasajero acepto al continuar.
      var deuda = (vista.deuda && vista.deuda.estado === 'aplazada')
        ? '<div class="aviso aviso--alerta">' +
            '<h3 class="aviso__titulo">Tienes una diferencia pendiente</h3>' +
            '<p class="aviso__texto">' + pesos(vista.deuda.monto) + ' por la diferencia de peso. ' +
              'Tienes ' + vista.config.PLAZO_DEUDA_DIAS + ' días para regularizarla antes de que se ' +
              'bloqueen tus viajes futuros.</p>' +
          '</div>'
        : '';

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
                      (e.peso !== null
                        ? ' &middot; ' + kg(e.peso) + ' verificados'
                        : ' &middot; facturada en el gabinete') +
                    '</span>' +
                  '</div>' +
                  barrasSimuladas(28) +
                '</article>';
              }).join('') +
            '</div>' +
            '<p class="bloque__bajada">Imprímelas en el aeropuerto o muéstralas en el punto de entrega ' +
              'de equipaje. No pases por el mostrador de documentación.</p>' +
          '</section>'
        : '';

      return '<div class="exito exito--grande">' +
          '<span class="exito__check" aria-hidden="true">' +
            '<svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27 l8 8 l15 -16" /></svg>' +
          '</span>' +
          '<h2 class="panel__titulo">Check-in listo</h2>' +
          '<p class="panel__bajada">Tu pase de abordar simulado está emitido.</p>' +
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

        deuda +
        etiquetas +

        '<div class="acciones">' +
          boton('imprimir', 'Imprimir o guardar', 'btn--suave') +
          boton('reiniciar', 'Hacer otro check-in', 'btn--principal') +
        '</div>' +

        nota('Simulación &mdash; este pase no es válido para embarcar. Los codigos de barras son ' +
             'decorativos y no codifican información.');
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
          '<h3 class="bloque__titulo">Dónde encontrarnos</h3>' +
          '<ul class="lista-simple">' +
            '<li>Counter AeroAndes &middot; nivel de salidas, módulos 12 a 18</li>' +
            '<li>Atención continua desde 3 horas antes de cada vuelo</li>' +
          '</ul>' +
        '</section>' +

        '<div class="acciones">' +
          boton('reiniciar', 'Volver a intentar', 'btn--principal') +
        '</div>' +

        nota('Simulación &mdash; los módulos y horarios de atencion son ficticios.');
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
      dom.totem.textContent = activo ? 'Salir del modo tótem' : 'Modo tótem';
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
