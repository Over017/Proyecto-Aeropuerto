/* =========================================================================
   RENDER
   -------------------------------------------------------------------------
   Responsabilidad unica: pintar en pantalla la vista que entrega el
   simulador. No decide reglas de negocio.

   Criterio de rendimiento: las filas se crean una sola vez y despues solo se
   actualiza su contenido. Asi el DOM no se reconstruye 4 veces por segundo y
   las animaciones de cambio de estado no se cortan.
   ========================================================================= */

window.APP = window.APP || {};

APP.ui = (function () {
  'use strict';

  var E = APP.ESTADOS;

  var FILTROS = ['Todos', E.PROGRAMADO, E.EMBARCANDO, E.EN_CAMINO, E.ATRASADO, E.ATERRIZADO, E.CANCELADO];

  var dom = {};          // referencias cacheadas al DOM
  var filas = {};        // codigo de vuelo -> elemento de fila
  var etiquetasPrevias = {}; // codigo -> ultima etiqueta pintada (para detectar cambios)
  var filtroActivo = 'Todos';
  var busqueda = '';
  var ultimaVista = null;

  /** "En camino" -> "en-camino": sirve para construir la clase CSS del pill. */
  function slug(texto) {
    return texto.toLowerCase().replace(/\s+/g, '-');
  }

  /* ---------- Construccion de una fila ---------- */
  function crearFila(vuelo) {
    var fila = document.createElement('div');
    fila.className = 'fila';
    fila.dataset.codigo = vuelo.codigo;

    fila.innerHTML =
      '<div class="fila__codigo">' + vuelo.codigo +
        '<span class="fila__equipo">' + vuelo.equipo + '</span>' +
      '</div>' +
      '<div class="fila__ruta">' + vuelo.origen + ' &rarr; ' + vuelo.destino +
        '<span class="fila__ruta-detalle">' +
          APP.datos.ciudad(vuelo.origen) + ' &middot; ' + APP.datos.ciudad(vuelo.destino) +
        '</span>' +
      '</div>' +
      '<div class="fila__salida fila__hora">' +
        '<span data-rol="salida"></span>' +
        '<span class="fila__hora-original" data-rol="salida-original" hidden></span>' +
      '</div>' +
      '<div class="fila__llegada fila__hora" data-rol="llegada"></div>' +
      '<div class="fila__puerta" data-rol="puerta"></div>' +
      '<div class="estado">' +
        '<span class="estado__pill" data-rol="pill"></span>' +
        '<span class="estado__detalle" data-rol="detalle"></span>' +
      '</div>';

    return fila;
  }

  /* ---------- Actualizacion de una fila ---------- */
  function actualizarFila(fila, vuelo) {
    var hora = APP.tiempo.aTexto;

    var salida = fila.querySelector('[data-rol="salida"]');
    var salidaOriginal = fila.querySelector('[data-rol="salida-original"]');
    var llegada = fila.querySelector('[data-rol="llegada"]');
    var puerta = fila.querySelector('[data-rol="puerta"]');
    var pill = fila.querySelector('[data-rol="pill"]');
    var detalle = fila.querySelector('[data-rol="detalle"]');

    // Si hay atraso mostramos la hora nueva y, debajo, la original tachada.
    salida.textContent = hora(vuelo.salidaEstimada);
    salida.classList.toggle('fila__hora--atrasada', vuelo.atrasado);
    salidaOriginal.textContent = hora(vuelo.salidaProgramada);
    salidaOriginal.hidden = !vuelo.atrasado;

    llegada.textContent = vuelo.cancelado ? '--:--' : hora(vuelo.llegadaEstimada);

    // La puerta deja de tener sentido una vez que el vuelo despego.
    var yaVolo = vuelo.estado === E.EN_CAMINO || vuelo.estado === E.ATERRIZADO;
    puerta.textContent = (vuelo.cancelado || yaVolo) ? '--' : vuelo.puerta;

    pill.textContent = vuelo.etiqueta;
    pill.className = 'estado__pill estado__pill--' + slug(vuelo.etiqueta);

    // Texto secundario: el estado operativo real cuando el pill dice "Atrasado".
    if (vuelo.etiqueta === E.ATRASADO) {
      detalle.innerHTML = vuelo.estado + ' &middot; +' + vuelo.retrasoMin + ' min';
    } else if (vuelo.atrasado && vuelo.estado === E.ATERRIZADO) {
      detalle.innerHTML = 'Llego con +' + vuelo.retrasoMin + ' min';
    } else {
      detalle.textContent = '';
    }

    fila.classList.toggle('fila--atrasada', vuelo.atrasado);
    fila.classList.toggle('fila--cancelada', vuelo.cancelado);

    // Destello discreto cuando la etiqueta cambia respecto del tick anterior.
    if (etiquetasPrevias[vuelo.codigo] && etiquetasPrevias[vuelo.codigo] !== vuelo.etiqueta) {
      fila.classList.remove('fila--cambio');
      void fila.offsetWidth; // reinicia la animacion CSS
      fila.classList.add('fila--cambio');
    }
    etiquetasPrevias[vuelo.codigo] = vuelo.etiqueta;
  }

  /* ---------- Filtros ---------- */
  function pasaFiltro(vuelo) {
    if (filtroActivo !== 'Todos') {
      var coincide = (filtroActivo === E.ATRASADO)
        ? vuelo.etiqueta === E.ATRASADO
        : vuelo.estado === filtroActivo;
      if (!coincide) return false;
    }

    if (!busqueda) return true;

    var texto = [
      vuelo.codigo,
      vuelo.origen,
      vuelo.destino,
      APP.datos.ciudad(vuelo.origen),
      APP.datos.ciudad(vuelo.destino)
    ].join(' ').toLowerCase();

    return texto.indexOf(busqueda) !== -1;
  }

  /* ---------- Pintado completo ---------- */
  function pintar(vista) {
    ultimaVista = vista;
    var visibles = 0;

    vista.vuelos.forEach(function (vuelo, indice) {
      var fila = filas[vuelo.codigo];

      if (!fila) {
        fila = crearFila(vuelo);
        filas[vuelo.codigo] = fila;
        dom.lista.appendChild(fila);
      }

      actualizarFila(fila, vuelo);

      // Reordena solo si hace falta (un atraso puede mover el vuelo de lugar).
      if (dom.lista.children[indice] !== fila) {
        dom.lista.insertBefore(fila, dom.lista.children[indice] || null);
      }

      var visible = pasaFiltro(vuelo);
      fila.hidden = !visible;
      if (visible) visibles++;
    });

    dom.vacio.hidden = visibles > 0;

    // Reloj y KPIs
    dom.reloj.textContent = APP.tiempo.aTexto(vista.ahora);
    dom.kpiTotal.textContent = vista.resumen.total;
    dom.kpiAire.textContent = vista.resumen.enCamino;
    dom.kpiAtrasados.textContent = vista.resumen.atrasados;
    dom.kpiCancelados.textContent = vista.resumen.cancelados;
    dom.kpiAtrasados.classList.toggle('esta-activo', vista.resumen.atrasados > 0);
  }

  /* ---------- Controles ---------- */
  function montarChips() {
    FILTROS.forEach(function (nombre) {
      var chip = document.createElement('button');
      chip.className = 'chip';
      chip.type = 'button';
      chip.textContent = nombre;
      chip.setAttribute('aria-pressed', String(nombre === filtroActivo));

      chip.addEventListener('click', function () {
        filtroActivo = nombre;
        Array.prototype.forEach.call(dom.chips.children, function (c) {
          c.setAttribute('aria-pressed', String(c === chip));
        });
        if (ultimaVista) pintar(ultimaVista);
      });

      dom.chips.appendChild(chip);
    });
  }

  function montarBuscador() {
    dom.buscador.addEventListener('input', function (e) {
      busqueda = e.target.value.trim().toLowerCase();
      if (ultimaVista) pintar(ultimaVista);
    });
  }

  function montarVelocidad(simulador) {
    Array.prototype.forEach.call(dom.botonesVelocidad, function (btn) {
      var valor = Number(btn.dataset.velocidad);
      btn.type = 'button';
      btn.setAttribute('aria-pressed', String(valor === simulador.getVelocidad()));

      btn.addEventListener('click', function () {
        simulador.setVelocidad(valor);
        Array.prototype.forEach.call(dom.botonesVelocidad, function (b) {
          b.setAttribute('aria-pressed', String(b === btn));
        });
      });
    });
  }

  /* ---------- API publica ---------- */
  return {
    iniciar: function (simulador) {
      dom = {
        lista: document.getElementById('lista-vuelos'),
        vacio: document.getElementById('tablero-vacio'),
        reloj: document.getElementById('reloj-hora'),
        chips: document.getElementById('chips'),
        buscador: document.getElementById('buscador'),
        botonesVelocidad: document.querySelectorAll('.velocidad__btn'),
        kpiTotal: document.getElementById('kpi-total'),
        kpiAire: document.getElementById('kpi-aire'),
        kpiAtrasados: document.getElementById('kpi-atrasados'),
        kpiCancelados: document.getElementById('kpi-cancelados')
      };

      montarChips();
      montarBuscador();
      montarVelocidad(simulador);

      simulador.alActualizar(pintar);
    }
  };
})();
