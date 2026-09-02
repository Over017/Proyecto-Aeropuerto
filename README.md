# Portal de pasajeros y gestión operacional — Línea Aérea (Caso 12)

Maqueta funcional (front-end con datos simulados) de AeroAndes. Tiene dos partes:

- **Portal del pasajero**, con el **check-in en línea paso a paso** — la entrega de esta etapa.
- **Panel operacional de vuelos**, el tablero de la entrega anterior, intacto en lo que hace.

> Todos los datos son ficticios. No hay backend, no hay pagos, no hay básculas ni
> gabinetes conectados, no hay validación real de identidad ni conexión con ningún
> servicio externo. Ninguna regla de este prototipo representa aún la operación real
> de la aerolínea.

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

El sitio nació como panel interno y pasó a ser, sobre todo, una web orientada al
pasajero: por eso `index.html` es la portada y el panel operacional vive en
`operaciones.html`. El tablero no cambió de comportamiento: mismos estados, mismo
reloj simulado, mismos filtros.

## El modelo de equipaje (lo más importante de esta etapa)

Es la parte que más se aleja de un check-in "clásico", así que conviene tenerla clara
antes de la demo.

**Lo que el pasajero declara es una declaración bajo su responsabilidad, no un dato
verificado.** Él pesa su maleta en cualquier báscula del aeropuerto e ingresa el
valor; el campo queda editable hasta que factura. La pantalla se lo advierte y le
pide aceptar las condiciones antes de continuar.

**La verificación de referencia ocurre después**, cuando entrega la maleta:

| Resultado del segundo pesaje | Qué pasa |
|---|---|
| Coincide | No hay nada que ajustar, el flujo sigue |
| Pesa **más** de lo declarado | Se genera una **deuda** por la diferencia. Se puede pagar en el momento o dejar pendiente; si no se regulariza dentro del plazo, se bloquean los viajes futuros |
| Pesa **menos** de lo declarado | Se genera un **reembolso**, a elección del pasajero: millas o a su tarjeta |

Una decisión de diseño que vale la pena defender en la presentación: **el check-in no
se bloquea por una diferencia de peso.** Como la diferencia se cobra o se devuelve
igual después, no hay nada que ganar declarando de menos, y no bloquear es justamente
lo que mantiene la fila avanzando — que era el problema original del cliente.

La diferencia se calcula sobre los **cargos**, no sobre los kilos: si tanto el peso
declarado como el verificado caen dentro de la franquicia incluida, no se debe ni se
devuelve nada aunque los kilos no sean idénticos.

**El equipaje de mano funciona igual.** La guía de medidas de la web es orientativa;
quien decide es el gabinete físico del aeropuerto. Si el bolso no pasa (o si se
declararon más piezas de las incluidas), el flujo ofrece **facturarlo en el momento**
con la misma cuenta ya vinculada, en vez de mandar al pasajero a otra fila.

## Check-in: cómo recorrer la demo

En la primera pantalla, el desplegable **"Reservas de ejemplo"** lista las cuatro
reservas ficticias y completa el formulario al tocar una:

| Código | Documento | Qué muestra |
|---|---|---|
| `AN7K2P` | `12.345.678-9` | Camino principal, vuelo nacional (SCL–PMC) |
| `AN9QLM` | `9.871.234-K` | Menor de edad en la reserva + vuelo internacional (SCL–EZE) |
| `AN3TZ8` | `P4471902` | Larga distancia con franquicia mayor (SCL–MAD) |
| `AN5RB1` | `17.203.556-4` | El vuelo sale en 38 min: el check-in ya está cerrado |

Pasos del flujo: **identificación → confirmación del vuelo → equipaje → [pago del
exceso declarado] → verificación en el punto de entrega → [deuda o reembolso] →
[gate-check] → [autorización de menor] → aviso de restricciones → pase de abordar.**
Los pasos entre corchetes aparecen solo si corresponden.

### Controles de demo

La pantalla de equipaje trae un desplegable **"Controles de demo"** que fuerza el
resultado de los dos eventos que en la simulación son aleatorios:

- **Segundo pesaje**: aleatorio · coincide · pesa más · pesa menos.
- **Gabinete de equipaje de mano**: aleatorio · pasa · no pasa.

Y la pantalla de pago tiene una casilla **"Simular un pago rechazado"**.

Los tres están marcados en la interfaz como controles de demo, no como funciones del
producto. Existen para poder mostrar cualquier camino a voluntad en clase, sin
depender de la suerte.

### Qué conviene mostrar

- **Deuda**: forzar "pesa más", declarar una maleta de 23 kg y llegar a la pantalla de
  diferencia. Probar *Pagar después* para ver que el pase igual se emite, con el aviso
  de deuda pendiente arriba.
- **Reembolso**: forzar "pesa menos", declarar 30 kg (paga exceso) y elegir millas o
  tarjeta.
- **Gate-check**: forzar "no pasa" — es la versión digital del gabinete que hoy está en
  el mostrador, y el momento donde se ve el cobro sin sacar la tarjeta.
- **Exceso sobre el tope**: subir una maleta sobre 32 kg. Ahí no se cobra: se deriva a
  mostrador, porque no es cuestión de pagar.
- **Menor de edad**: con `AN9QLM`, responder *"viaja sin uno o sin ambos"* obliga a
  adjuntar la autorización notarial antes de continuar.
- **Modo tótem**: el botón del menú (o `checkin.html?totem=1`) agranda tipografía y
  controles y pide pantalla completa. Es la misma página, no un segundo front-end.

## Estructura

```
index.html                    Portada del pasajero
checkin.html                  Flujo de check-in
operaciones.html              Panel operacional de vuelos

assets/css/styles.css         Paleta, tokens claro/oscuro, navegación, portada y tablero
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
de render decide reglas. Cuando lleguen las reglas reales del cliente se ajustan ahí
sin tocar el resto.

## Stack

**Ahora:** HTML + CSS + JavaScript sin framework ni build. Es lo más rápido para iterar
en esta etapa, se abre en cualquier computador sin instalar nada y no arrastra
decisiones que después haya que deshacer.

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
| `MANO_PESO_MAX_KG` / `MANO_MEDIDAS_CM` | 10 kg / 55×35×25 | Guía orientativa del equipaje de mano |
| `DESPACHADA_PESO_MAX_KG` | 23 kg | Peso incluido por maleta despachada |
| `DESPACHADA_PESO_TOPE_KG` | 32 kg | Sobre esto no se acepta en autoservicio |
| `TARIFA_EXCESO_KG` | $8.500 | Cargo por kilo sobre el límite |
| `TARIFA_MALETA_EXTRA` | $45.000 | Cargo por maleta fuera de la franquicia |
| `TARIFA_GATE_CHECK` | $25.000 | Cargo por facturar una pieza de mano en el momento |
| `PROB_PESO_COINCIDE` | 0.45 | Probabilidad de que el segundo pesaje coincida |
| `DESVIACION_PESO_MAX_KG` | 5 kg | Cuánto puede alejarse el peso verificado del declarado |
| `PROB_MANO_NO_PASA` | 0.25 | Probabilidad de que el bolso no pase el gabinete |
| `PLAZO_DEUDA_DIAS` | 30 días | Plazo para regularizar antes de bloquear viajes futuros |
| `MILLAS_POR_PESO` | 0.5 | Millas por peso al elegir reembolso en millas |
| `MAX_INTENTOS_IDENTIDAD` | 3 | Intentos antes de derivar a mostrador |
| `DEMORA_*_MS` | 1100–1800 ms | Duración de las esperas simuladas |

**Ninguno de estos valores es política real de la aerolínea.** Son ejemplos elegidos
para que la demo se vea creíble, y están todos juntos justamente porque son lo primero
que hay que reemplazar cuando el cliente confirme sus límites (ver preguntas abiertas).

## Diseño

### Paleta

El sitio usa un degradado de azules, declarado una sola vez en `styles.css` y mapeado
después a roles (fondo, texto, acento):

```
#03045e  #023e8a  #0077b6  #0096c7  #00b4d8  #48cae4  #90e0ef  #ade8f4  #caf0f8
 oscuro  ────────────────────────────────────────────────────────────────►  claro
```

- **Modo claro**: fondo blanco con tinte cian, texto en `#03045e`, acento `#0077b6`.
- **Modo oscuro**: se invierte — el azul más oscuro pasa a fondo y los cianes claros a
  texto y acento. Cambia automáticamente según el sistema.
- El token `--sobre-acento` existe porque el color del texto *encima* del acento tiene
  que cambiar con el tema: en oscuro el acento es celeste claro y el blanco encima
  sería ilegible.

**El rojo no sale de la paleta a propósito.** Es el único color que no es azul, y está
reservado para atraso, cancelación, exceso de equipaje, deuda pendiente y errores. Si
se usara en otros lugares dejaría de saltar a la vista cuando algo se sale de lo normal.

### Otros criterios

- Jerarquía por tipografía y espacio, no por bordes ni cajas.
- Las micro-animaciones son cortas y siempre explican un cambio: el panel del paso nuevo
  entra desde el lado hacia el que se avanza, un total que cambia destella una vez, y
  las esperas simuladas tienen giro y check al terminar. Se apagan solas si el sistema
  pide menos movimiento.
- El modo tótem es la misma página con la tipografía y los controles más grandes: sirve
  al pasajero en su celular y en la pantalla del aeropuerto sin mantener dos front-ends.
- El peso se edita con slider **y** con campo numérico: el slider sirve para el dedo en
  el tótem, el campo para teclear exactamente lo que marcó la báscula.

## Qué es simulación y qué no

Esta distinción es deliberada y está escrita también en la interfaz, en cada pantalla
sensible:

- **La identidad no se verifica.** Solo se compara el documento tecleado con el de la
  reserva ficticia. No hay cámara, ni OCR, ni biometría.
- **No hay báscula ni gabinete.** El peso lo declara el pasajero y el "peso verificado"
  del segundo pesaje lo genera la maqueta a partir de `CONFIG`.
- **No se cobra nada.** No hay pasarela de pago, no se guarda ningún dato de tarjeta, no
  se genera ninguna deuda real, no se bloquea ningún viaje y no existe un programa de
  millas detrás.
- **La autorización notarial no se valida.** Se registra que un archivo fue adjuntado;
  su contenido no se lee y el archivo nunca sale del navegador.
- **El arraigo no se verifica, y no se simula que sí.** Un impedimento judicial de salida
  lo controla la PDI en el control migratorio contra registros del Poder Judicial, a los
  que una aerolínea no tiene acceso — y tampoco existe hoy una vía pública para
  consultarlos. Por eso la pantalla es un recordatorio informativo y **no existe ninguna
  casilla donde el pasajero "confirme" no tener restricciones**: sería una validación
  falsa.
- **El pase de abordar no sirve para embarcar** y sus códigos de barras son decorativos.

## Fuera del alcance de esta maqueta

Quedan para fases siguientes, una vez definidas con el cliente:

- Reserva y emisión de pasajes.
- Selección de asiento y cambios de vuelo.
- Backend, persistencia, cuenta de pasajero real y manejo de alta concurrencia.
- Integraciones reales: medios de pago, básculas, control migratorio, notarías.

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
6. ¿Cuáles son los límites reales de peso y tamaño de equipaje, y las tarifas de exceso?
7. ¿Qué medios de pago se vincularían a la cuenta del pasajero?
8. ¿Qué formato de autorización notarial acepta la aerolínea, y en qué momento se
   verifica el documento físico?
9. **¿En qué momento y con qué instrumento se hace la verificación posterior del peso**
   (al facturar, al embarcar, controles aleatorios)?
10. **¿Qué plazo y qué medios de pago se ofrecen para regularizar una deuda** antes de
    bloquear viajes futuros? (hoy asumimos 30 días)
11. ¿Cuándo abre y cierra el check-in en línea, y qué pasa con quien lo intenta fuera de
    esa ventana?
