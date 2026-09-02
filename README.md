# Portal de pasajeros y gestión operacional — Línea Aérea (Caso 12)

Maqueta funcional (front-end con datos simulados) de AeroAndes. Tiene dos partes:

- **Portal del pasajero**, con el **check-in en línea paso a paso** — la entrega de esta etapa.
- **Panel operacional de vuelos**, el tablero de la entrega anterior, intacto en cuanto a lo que hace.

> Todos los datos son ficticios. No hay backend, no hay pagos, no hay validación real de
> identidad ni conexión con ningún servicio externo. Ninguna regla de este prototipo
> representa aún la operación real de la aerolínea.

## Cómo verlo

Basta abrir `index.html` en el navegador (doble clic). No hay build ni dependencias.

Si prefieres servirlo por HTTP (recomendado para probar como se verá desplegado):

```bash
python -m http.server 5500
```

Y entrar a `http://localhost:5500`.

## Las tres pantallas

| Archivo | Qué es | Para quién |
|---|---|---|
| `index.html` | Portada del portal | Pasajero |
| `checkin.html` | Flujo de check-in paso a paso | Pasajero |
| `operaciones.html` | Tablero de vuelos del día | Personal de tierra |

El sitio nació como panel interno y en esta etapa pasa a ser, sobre todo, una web
orientada al pasajero: por eso `index.html` es ahora la portada y el panel operacional
se movió a `operaciones.html`. El tablero no cambió: mismos estados, mismo reloj
simulado, mismos filtros.

## Check-in: cómo recorrer la demo

En la primera pantalla, el desplegable **"Reservas de ejemplo"** lista las cuatro
reservas ficticias y completa el formulario al tocar una. Cada una existe para mostrar
un camino distinto:

| Código | Documento | Qué muestra |
|---|---|---|
| `AN7K2P` | `12.345.678-9` | Camino feliz, vuelo nacional (SCL–PMC) |
| `AN9QLM` | `9.871.234-K` | Menor de edad en la reserva + vuelo internacional (SCL–EZE) |
| `AN3TZ8` | `P4471902` | Larga distancia con franquicia mayor (SCL–MAD) |
| `AN5RB1` | `17.203.556-4` | El vuelo sale en 38 min: el check-in ya está cerrado |

Pasos del flujo: **identificación → confirmación del vuelo → equipaje → [pago del
exceso] → [autorización de menor] → aviso de restricciones → pase de abordar.** Los dos
pasos entre corchetes aparecen solo si corresponden.

Cosas que conviene mostrar en la presentación:

- **Exceso de equipaje**: mueve el peso de una maleta sobre 23 kg y mira cómo el total
  se recalcula en vivo. Sobre 32 kg deja de ser un cobro y pasa a ser una derivación a
  mostrador.
- **"Mi bolso no cabe en el medidor"**: es la versión digital del gabinete que hoy está
  en el counter.
- **Pago rechazado**: la casilla *"Simular un pago rechazado"* en la pantalla de pago
  fuerza el camino de error. Es un interruptor de demo, no una función del producto.
- **Menor de edad**: con `AN9QLM`, responder *"viaja sin uno o sin ambos"* obliga a
  adjuntar la autorización notarial antes de continuar.
- **Modo tótem**: el botón del menú (o `checkin.html?totem=1`) agranda tipografía y
  controles y pide pantalla completa. Es la misma página, no un segundo front-end.

## Estructura

```
index.html                    Portada del pasajero
checkin.html                  Flujo de check-in
operaciones.html              Panel operacional de vuelos

assets/css/styles.css         Tokens de color, claro/oscuro, navegación, portada y tablero
assets/css/checkin.css        Estilos propios del flujo de check-in

assets/js/core.js             Namespace APP, helpers de tiempo y catálogo de aeropuertos
assets/js/home.js             Portada: escribe los límites de equipaje leyéndolos de CONFIG

assets/js/mock-flights.js     Datos simulados del tablero
assets/js/simulator.js        Reloj simulado y reglas de estado del tablero. No toca el DOM.
assets/js/ui.js               Render del tablero. No decide reglas de negocio.
assets/js/main.js             Arranque del panel operacional

assets/js/checkin-mock.js     Reservas, tarifas y parámetros del check-in
assets/js/checkin-flow.js     Estado y reglas del flujo. No toca el DOM.
assets/js/checkin-ui.js       Render de cada pantalla del flujo
assets/js/checkin-main.js     Arranque del check-in
```

La separación es a propósito y se repite igual en las dos partes: **datos / lógica /
render / arranque**. La lógica de negocio vive en un solo archivo por módulo
(`simulator.js` y `checkin-flow.js`), ninguno de los dos toca el DOM, y ningún archivo
de render decide reglas. Cuando lleguen las reglas reales del cliente se ajustan ahí sin
tocar el resto.

## Stack

**Ahora:** HTML + CSS + JavaScript sin framework ni build. Es lo más rápido para iterar
en esta etapa, se abre en cualquier computador sin instalar nada y no arrastra decisiones
que después haya que deshacer.

**Después, cuando haya backend:** Node + Express desplegado en Render, con este front
servido como estático. La estructura ya deja espacio para agregar una carpeta `server/`
sin mover nada. Lo primero que cambiaría: `mock-flights.js` y `checkin-mock.js` pasan a
ser llamadas al API manteniendo la misma forma de objeto.

## Parámetros de la simulación

Los del tablero están en `CONFIG`, dentro de `assets/js/simulator.js`:

| Parámetro | Hoy | Qué representa |
|---|---|---|
| `MINUTOS_EMBARQUE` | 40 | Cuánto antes de la salida el vuelo pasa a *Embarcando* |
| `PROB_ATRASO` | 0.0006 | Probabilidad de atraso, por vuelo y por minuto simulado |
| `PROB_CANCELACION` | 0.00005 | Ídem, para cancelaciones |
| `ATRASO_MIN` / `ATRASO_MAX` | 10 / 75 min | Rango del atraso aleatorio |

Los del check-in están en `CONFIG`, dentro de `assets/js/checkin-mock.js`:

| Parámetro | Hoy | Qué representa |
|---|---|---|
| `APERTURA_CHECKIN_MIN` / `CIERRE_CHECKIN_MIN` | 2880 / 60 min | Ventana en que se puede hacer check-in |
| `MANO_PESO_MAX_KG` / `MANO_MEDIDAS_CM` | 10 kg / 55×35×25 | Límite del equipaje de mano |
| `DESPACHADA_PESO_MAX_KG` | 23 kg | Peso incluido por maleta despachada |
| `DESPACHADA_PESO_TOPE_KG` | 32 kg | Sobre esto no se acepta en autoservicio |
| `TARIFA_EXCESO_KG` | $8.500 | Cargo por kilo sobre el límite |
| `TARIFA_MALETA_EXTRA` | $45.000 | Cargo por maleta fuera de la franquicia |
| `TARIFA_MANO_A_BODEGA` | $25.000 | Cargo por pieza de mano que va a bodega |
| `MAX_INTENTOS_IDENTIDAD` | 3 | Intentos antes de derivar a mostrador |
| `DEMORA_*_MS` | 1100–1600 ms | Duración de las esperas simuladas |

**Ninguno de estos valores es política real de la aerolínea.** Son ejemplos elegidos
para que la demo se vea creíble, y están todos juntos justamente porque son lo primero
que hay que reemplazar cuando el cliente confirme sus límites (ver preguntas abiertas).

## Decisiones de diseño

- Un solo color de acento (azul) en todo el sitio. El rojo está reservado para lo que
  de verdad se sale de lo normal: atraso, cancelación, exceso de equipaje y error. Si se
  usara en más lugares, dejaría de saltar a la vista.
- Jerarquía por tipografía y espacio, no por bordes ni cajas.
- Las micro-animaciones son cortas y siempre explican un cambio: el panel del paso nuevo
  entra desde el lado hacia el que se avanza, un total que cambia destella una vez, y las
  esperas simuladas tienen giro y check al terminar. Se apagan solas si el sistema pide
  menos movimiento.
- Modo claro/oscuro automático según el sistema, en las tres pantallas.
- El modo tótem es la misma página con la tipografía y los controles más grandes: sirve
  al pasajero en su celular y en la pantalla del aeropuerto sin mantener dos front-ends.

## Qué es simulación y qué no

Esta distinción es deliberada y está escrita también en la interfaz, en cada pantalla
sensible:

- **La identidad no se verifica.** Solo se compara el documento tecleado con el de la
  reserva ficticia. No hay cámara, ni OCR, ni biometría.
- **No se cobra nada.** No hay pasarela de pago ni se guarda ningún dato de tarjeta. El
  resultado del pago sale de un interruptor de demo.
- **La autorización notarial no se valida.** Se registra que un archivo fue adjuntado;
  su contenido no se lee y el archivo nunca sale del navegador.
- **El arraigo no se verifica, y no se simula que sí.** Un impedimento judicial de salida
  lo controla la PDI en el control migratorio contra registros del Poder Judicial, a los
  que una aerolínea no tiene acceso. Por eso la pantalla es un recordatorio informativo
  y **no existe ninguna casilla donde el pasajero "confirme" no tener restricciones**:
  sería una validación falsa.
- **El pase de abordar no sirve para embarcar** y sus códigos de barras son decorativos.

## Fuera del alcance de esta maqueta

Quedan para fases siguientes, una vez definidas con el cliente:

- Reserva y emisión de pasajes.
- Selección de asiento y cambios de vuelo.
- Backend, persistencia y manejo de alta concurrencia.
- Integraciones reales: medios de pago, control migratorio, notarías.

## Preguntas abiertas con el cliente (profesor)

Están pendientes y afectan decisiones de diseño, así que conviene no cerrarlas por
cuenta propia:

1. ¿En qué momento del día / semana / temporada se concentra la aglomeración, y en qué
   proceso (check-in, seguridad/migración, embarque)?
2. ¿Qué normativas aeronáuticas específicas debe cumplir la plataforma?
3. ¿Cómo se comunica hoy una reprogramación de vuelo a los pasajeros?
4. ¿Cuánto antes de la salida se abre y se cierra el embarque? (hoy asumimos 40 min)
5. ¿Qué otros estados usa la operación real además de estos cinco (por ejemplo
   *última llamada*, *en plataforma*, *desviado*)?

Y las que salen de esta etapa, para la próxima reunión:

6. ¿Cuáles son los límites reales de peso y tamaño de equipaje, y las tarifas de exceso?
7. ¿Qué medios de pago se vincularían a la cuenta del pasajero?
8. ¿Qué formato de autorización notarial acepta la aerolínea, y en qué momento se
   verifica el documento físico?
9. ¿Cuándo abre y cierra el check-in en línea, y qué pasa con quien lo intenta fuera de
   esa ventana?
