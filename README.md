# Plataforma de Gestión Operacional — Línea Aérea (Caso 12)

Maqueta funcional (front-end con datos simulados) del panel operacional de vuelos.
Primera entrega del proyecto: sirve para mostrar algo vivo en la presentación y para
iterar sobre él según el feedback del profesor/cliente.

> Todos los datos son ficticios. Ninguna regla de este prototipo representa aún la
> operación real de la aerolínea.

## Cómo verlo

Basta abrir `index.html` en el navegador (doble clic). No hay build ni dependencias.

Si prefieres servirlo por HTTP (recomendado para probar como se verá desplegado):

```bash
python -m http.server 5500
```

Y entrar a `http://localhost:5500`.

## Qué hace hoy

- Tablero de vuelos del día con código, ruta, salida, llegada estimada y puerta.
- Estados que avanzan solos: **Programado → Embarcando → En camino → Aterrizado**,
  más **Cancelado**.
- Reloj simulado con control de velocidad (1× / 60× / 300×) para que en una demo de
  pocos minutos se vea la jornada completa cambiando en vivo.
- Atrasos aleatorios: un vuelo puede reprogramarse solo. Cuando pasa, la fila muestra
  la nueva hora, la hora original tachada y la etiqueta **Atrasado** en rojo.
- Resumen arriba (total, en camino, atrasados, cancelados) y filtros por estado + búsqueda.
- Modo claro/oscuro automático según el sistema.

## Estructura

```
index.html                 Estructura de la pantalla
assets/css/styles.css      Estilos (tokens de color, claro/oscuro, layout)
assets/js/mock-flights.js  Datos simulados. Se reemplaza por el API cuando exista backend.
assets/js/simulator.js     Reloj simulado, reglas de estado y eventos aleatorios. No toca el DOM.
assets/js/ui.js            Render del tablero. No decide reglas de negocio.
assets/js/main.js          Arranque: une datos + simulador + render.
```

La separación es a propósito: la lógica de estados vive en un solo lugar
(`simulator.js`) y no está mezclada con el HTML, así que cuando lleguen las reglas
reales del profesor se ajustan ahí sin tocar el resto.

## Stack propuesto

**Ahora:** HTML + CSS + JavaScript sin framework ni build. Es lo más rápido para
iterar en esta etapa, se abre en cualquier computador sin instalar nada y no arrastra
decisiones que después haya que deshacer.

**Después, cuando haya backend:** Node + Express desplegado en Render, con este
front servido como estático desde el mismo servicio o desde un static site aparte.
La estructura ya deja espacio para agregar una carpeta `server/` sin mover nada de lo
existente. Si más adelante la UI crece (reservas, check-in, equipaje), migrar a Vite +
un framework es un paso incremental, no una reescritura.

## Parámetros de la simulación

Están todos juntos en `CONFIG`, dentro de `assets/js/simulator.js`:

| Parámetro | Hoy | Qué representa |
|---|---|---|
| `MINUTOS_EMBARQUE` | 40 | Cuánto antes de la salida el vuelo pasa a *Embarcando* |
| `PROB_ATRASO` | 0.0012 | Probabilidad de atraso, por vuelo y por minuto simulado |
| `PROB_CANCELACION` | 0.00005 | Ídem, para cancelaciones |
| `ATRASO_MIN` / `ATRASO_MAX` | 10 / 75 min | Rango del atraso aleatorio |

Son valores elegidos para que la demo se vea interesante, no datos operacionales.
Es justamente lo que hay que reemplazar con lo que responda el profesor.

## Decisiones de diseño

- Un solo color de acento (azul) para *Embarcando* y *En camino*.
- El rojo está reservado para atraso y cancelación: si se usara en más lugares,
  dejaría de saltar a la vista cuando algo se sale de lo normal.
- *Programado* y *Aterrizado* quedan en gris neutro a propósito: son el estado
  esperado y no deberían competir por atención.
- Jerarquía por tipografía y espacio, no por bordes ni cajas.
- El cambio de estado hace un destello suave en la fila, para que en la presentación
  se note el momento exacto en que un vuelo cambia.

## Fuera del alcance de esta maqueta

Quedan para fases siguientes, una vez definidos con el cliente:

- Reserva y emisión de pasajes.
- Check-in online paso a paso.
- Administración de equipaje.
- Lógica ligada a normativas aeronáuticas.
- Manejo de alta concurrencia (por ahora no hay backend que soportar).

## Preguntas abiertas con el cliente (profesor)

Están pendientes y afectan decisiones de diseño, así que conviene no cerrarlas por cuenta propia:

1. ¿En qué momento del día / semana / temporada se concentra la aglomeración de
   pasajeros, y en qué proceso (check-in, seguridad/migración, embarque)?
2. ¿Cómo se administra hoy el equipaje?
3. ¿Qué normativas aeronáuticas específicas debe cumplir la plataforma?
4. ¿Cómo se comunica hoy una reprogramación de vuelo a los pasajeros?

Además, de esta maqueta salen dos preguntas nuevas que sirven para la próxima reunión:

5. ¿Cuánto antes de la salida se abre y se cierra el embarque? (hoy asumimos 40 min)
6. ¿Qué otros estados usa la operación real además de estos cinco (por ejemplo
   *última llamada*, *en plataforma*, *desviado*)?
