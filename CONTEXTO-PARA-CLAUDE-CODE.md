---
Proyecto: Caso 12 — Línea aérea AeroAndes
Etapa: Portal de check-in web (SIMULACIÓN, no funcional real)
Fecha: 2 de septiembre de 2026
Para: Claude Code (agente de desarrollo)
---

# Brief de desarrollo — Portal de check-in (simulación)

> Este documento es el contexto completo para empezar a construir. Está pensado para
> que un agente de desarrollo (Claude Code) no necesite preguntar nada más para
> arrancar. Si algo no está definido aquí, es porque todavía no está decidido con el
> cliente (ver sección 10) — en ese caso, resuelve con un criterio razonable y
> coméntalo, no lo dejes bloqueando el avance.

## 0. Resumen ejecutivo (léelo primero)

- Es un proyecto universitario (Caso 12): una aerolínea ficticia, **AeroAndes**.
- Ya existe un prototipo funcionando: un **panel operacional de vuelos** (front-end
  puro, sin backend, datos simulados). No se debe romper ni desarmar.
- Ahora toca construir la **siguiente pieza**: un **portal de check-in de
  autoservicio** orientado al pasajero (no al personal de la aerolínea).
- Es **100% simulación**, igual que el panel operacional ya existente: no hay
  backend real, no hay pagos reales, no hay validación real de documentos ni de
  identidad. Todo se simula con datos falsos, temporizadores y estados ficticios.
- El diseño debe ser **minimalista** y usar **micro-animaciones** sutiles, con la
  paleta de colores definida en la sección 5.
- **El sitio cambia de enfoque**: nació como un panel interno para el personal de
  la aerolínea y ahora pasa a ser, sobre todo, una **web orientada a los pasajeros**.
  Si mantener la estructura o el código actual no calza bien con eso, **está
  permitido reconstruir el sitio completo** (HTML, CSS y JS) en vez de forzar la
  nueva sección de check-in dentro de lo que ya existe. Lo único que no puede
  perderse es lo que ya funciona del panel operacional (el tablero de vuelos con
  sus estados) — puede reimplementarse dentro del nuevo sitio, no necesita
  sobrevivir archivo por archivo tal cual está hoy.

## 1. Contexto del proyecto

### 1.1 Qué existe hoy en el repositorio

```
index.html                 Panel operacional de vuelos (ya construido)
assets/css/styles.css      Estilos: tokens de color, claro/oscuro, layout
assets/js/mock-flights.js  Datos simulados de vuelos
assets/js/simulator.js     Reloj simulado y reglas de estado. No toca el DOM.
assets/js/ui.js            Render del tablero. No decide reglas de negocio.
assets/js/main.js          Arranque: une datos + simulador + render.
README.md                  Documentación del prototipo actual
trascripcion entrevista.txt   Entrevista original con el cliente
Propuesta_Solucion_CheckIn_Web.docx   Propuesta de solución completa (para el profesor)
```

Stack: **HTML + CSS + JavaScript sin framework ni build**, tal como define el
README del proyecto. Cuando exista backend, será Node + Express. Por ahora no hay
backend: todo corre en el navegador.

La separación de responsabilidades del prototipo actual es intencional y **hay que
mantenerla** en lo nuevo que se construya (o reconstruya):

- Datos (mock) en su propio archivo.
- Lógica de simulación/estados en su propio archivo, sin tocar el DOM.
- Render/UI en su propio archivo, sin decidir reglas de negocio.
- Un archivo de arranque que conecta todo.

### 1.2 El problema real, según la entrevista con el cliente

El cliente (representando a la aerolínea) identificó como problema central la
**aglomeración de pasajeros en el check-in**, que genera reclamos y hasta demandas.
Dos causas concretas:

1. **Validación de identidad manual**: hoy una persona revisa cédula + ticket de
   cada pasajero, uno por uno. Es lento.
2. **Equipaje**: el equipaje de mano se valida con un gabinete/"jaula" física
   (si cabe, va a bordo; si no, a bodega). El equipaje despachado se pesa; si
   excede el límite, el pasajero paga un cargo adicional — y muchas veces no trae
   efectivo ni tiene la tarjeta a mano, lo que atrasa aún más la fila.

El cliente planteó como idea (no como decisión cerrada) un mecanismo tecnológico
—mencionó tótems con cámara— y que el cobro del exceso de equipaje se resuelva
desde una app/cuenta vinculada a una tarjeta, sin buscar efectivo ni tarjeta física.

### 1.3 Resumen de la propuesta de solución ya validada

Un frente orientado al pasajero, usable desde el celular del pasajero **y** en modo
"tótem" en el aeropuerto (misma página, en pantalla completa). Módulos funcionales:

1. **Identificación del pasajero** — código de reserva/n.° de vuelo + documento.
2. **Confirmación de vuelo** — muestra los datos del vuelo (puede reutilizar/objeto
   similar a `mock-flights.js`).
3. **Declaración y verificación de equipaje** — ver detalle completo en la sección 2.
4. **Validación legal (menores y restricciones de viaje)** — ver sección 3.
5. **Pase de abordar y etiqueta de equipaje** — pantalla final del flujo.
6. **Panel operacional** — el que ya existe; se reimplementa dentro del nuevo sitio
   (ver nota de reconstrucción en la sección 0), sin perder lo que ya hace.

## 2. Equipaje: cómo se declara, cómo se verifica y qué pasa si no coincide

Este es uno de los puntos más importantes del encargo — léelo con calma antes de
diseñar las pantallas de equipaje.

### 2.1 Principio general

Lo que el pasajero ingresa en la web o la app es una **declaración bajo su
responsabilidad**, no un dato verificado en el momento. La verificación de
referencia ocurre después, con instrumentos físicos reales en el aeropuerto — el
mismo criterio que ya usa la industria (kioscos de bag-drop con báscula integrada,
gabinetes físicos para equipaje de mano).

### 2.2 Equipaje despachado (peso)

- En el aeropuerto hay **básculas físicas para pesar maletas**, tanto en los
  tótems como distribuidas en distintos puntos del terminal.
- El pasajero pesa su maleta en cualquiera de ellas y luego **ingresa o ajusta ese
  peso** en su registro online. El campo de peso debe quedar **editable** hasta el
  momento de facturar, no ser un valor que se escribe una sola vez y queda fijo.
- En el mismo formulario debe verse una **advertencia de responsabilidad**, por
  ejemplo: *"Es tu responsabilidad ingresar el peso real de tu equipaje. Un valor
  distinto al real puede generar un cargo adicional o un reembolso."*
- **Si la verificación posterior detecta que el peso real es mayor** al
  declarado: se genera una **deuda** por la diferencia. Si esa deuda no se paga,
  se **bloquean los viajes futuros** de ese pasajero con la aerolínea hasta que se
  regularice.
- **Si el peso declarado fue mayor al real** (el pasajero declaró o pagó de más):
  se genera un **reembolso**, a elección del pasajero — en **millas de la
  aerolínea** o **directo a su tarjeta**.
- Este mecanismo es intencional: como la diferencia siempre se cobra después (no
  hay forma de "salirse con la suya" declarando menos), no hace falta bloquear el
  check-in en el momento por una diferencia de peso — eso ayuda a mantener el
  proceso ágil, que es justamente el objetivo original.
- Por tratarse de una consecuencia financiera real para el pasajero (deuda +
  bloqueo de viajes futuros), la pantalla de declaración de equipaje debería
  incluir una **aceptación explícita de estos términos** (un check de "acepto
  las condiciones de declaración de equipaje"), simulada como el resto del flujo,
  pero presente en el diseño.

### 2.3 Equipaje de mano (tamaño)

- La guía visual en la web (dimensiones máximas) es orientativa, para que el
  pasajero llegue mejor preparado — no aprueba nada por sí sola.
- La validación de referencia sigue siendo el **gabinete físico** ("jaula"), en el
  tótem o en el mostrador/puerta de embarque.
- Si un bolso no pasa el gabinete: se ofrece **facturarlo en el momento**
  (gate-check), con el cargo correspondiente, usando el mismo mecanismo de cobro
  ya vinculado a la cuenta — para no generar una fila nueva por ese caso.

### 2.4 Cómo simular todo esto (recordatorio)

Nada de esto se conecta a una báscula real ni a un lector real. Para la
simulación:

- El "peso real" de la verificación posterior puede generarse con datos mock
  (por ejemplo, un valor aleatorio o editable en `CONFIG`, similar a como
  `simulator.js` ya genera atrasos aleatorios) que a veces coincide con lo
  declarado y a veces no, para poder mostrar los tres casos: coincide, deuda,
  reembolso.
- Las pantallas de deuda y reembolso son solo de interfaz (mensajes, montos
  ficticios, animación de confirmación) — no hay pasarela de pago ni sistema de
  millas real detrás.

## 3. Requisitos legales y de seguridad a simular

El cliente pidió expresamente cubrir dos situaciones sensibles. **En esta etapa se
simulan como flujo de pantallas, sin verificación real de ningún tipo**:

### 3.1 Menores de edad sin ambos padres o tutores

Si el pasajero declara que viaja un menor de edad sin ambos padres/tutores
legales, el flujo debe pedir **adjuntar la autorización notarial de viaje** antes
de continuar (simular con un input de archivo o un código de verificación
ficticio). Si no se "adjunta", el check-in no se completa y se muestra un mensaje
de derivación a mostrador. **No se valida el contenido real del documento** — es
una simulación de la interacción, no un verificador real.

### 3.2 Pasajeros con arraigo (impedimento judicial de salida)

Un arraigo es una orden judicial que impide a alguien salir del país. **Esto no se
puede verificar de verdad desde una plataforma privada**: en la realidad lo hace
la PDI en el control migratorio, contra bases de datos del Poder Judicial, a las
que la aerolínea no tiene acceso (el propio Poder Judicial restringió en los
últimos años las búsquedas públicas de causas, así que hoy tampoco existe una vía
pública que la plataforma pudiera consultar por su cuenta). Por eso, en la
simulación esto se representa como una **pantalla informativa/recordatorio**
("recuerda que la salida del país está sujeta a que no existan restricciones
judiciales vigentes; la validación final la hace el control migratorio"), nunca
como una casilla que "confirma" que el pasajero no tiene arraigo. No inventar una
validación falsa de esto.

### 3.3 Cómo mostrarlo en la UI

Cada pantalla sensible (equipaje, autorización de menor, aviso de arraigo) debe
dejar claro con un texto pequeño que es una simulación — el mismo espíritu del
aviso que ya tiene el README: *"Todos los datos son ficticios."* Por ejemplo:
*"Simulación — sin conexión a básculas, pasarelas de pago ni bases de datos
reales."*

## 4. Encargo para esta etapa

Construir el **flujo de check-in de autoservicio como simulación navegable de
principio a fin**, con datos falsos, sin backend, integrado visualmente con el
panel operacional. Nada de esto se conecta a servicios reales.

### 4.1 Qué SÍ hacer

- Flujo completo, pantalla por pantalla, de los módulos de la sección 1.3.
- Datos simulados (nombres, vuelos, pesos, montos) con la misma lógica de "mock"
  que ya usa `mock-flights.js`.
- El caso completo de equipaje: declarar, "pesar" (simulado), y mostrar los tres
  desenlaces posibles (coincide / deuda / reembolso), como se explica en la
  sección 2.
- Estados y transiciones falsas pero creíbles: por ejemplo, un botón "Pagar" que
  muestra un spinner breve y luego un check de éxito, sin pasarela real.
- Casos de error simulados (documento no coincide, autorización de menor
  faltante, equipaje de mano que no pasa el gabinete) que deriven a una pantalla
  de "acércate a un mostrador".
- Micro-animaciones (ver sección 6).
- Responsive: debe verse bien tanto en el celular del pasajero como en una
  pantalla grande tipo tótem.
- Mantener el modo claro/oscuro automático que ya tiene el sitio.

### 4.2 Qué NO hacer

- No implementar pagos reales ni conectar ninguna pasarela.
- No implementar validación real de identidad, OCR, cámara real ni biometría.
- No conectar con ningún servicio externo real (PDI, notarías, bases de datos
  judiciales, APIs de pago, básculas reales).
- No agregar frameworks ni herramientas de build (seguir HTML/CSS/JS vanilla, sin
  npm ni bundlers), tal como define el README del proyecto — esto aplica incluso
  si se reconstruye el sitio completo (ver nota de la sección 0).
- No prometer en la UI algo que la simulación no hace de verdad (por ejemplo, un
  texto que diga "identidad verificada" sin más — mejor "identidad simulada como
  verificada").

## 5. Requisitos de diseño

- **Minimalista**: mucho espacio en blanco, jerarquía por tipografía y tamaño más
  que por bordes o cajas.
- **Micro-animaciones**: transiciones suaves entre pasos del flujo (fade/slide al
  avanzar o retroceder), un pequeño destello o check animado al completar una
  acción (como el destello que ya usa el tablero al cambiar de estado), un
  feedback visual breve durante las esperas simuladas (pago "procesando",
  validación "en curso"). Deben ser sutiles, nunca vistosas ni lentas.
- **Responsive**, sin necesidad de instalar nada: se abre en el navegador igual
  que `index.html` hoy.

### 5.1 Paleta de colores

Usar esta paleta como base estética del sitio (degradado de azules, de más oscuro
a más claro):

```css
:root {
  --deep-twilight:   #03045e; /* azul muy oscuro */
  --french-blue:     #023e8a;
  --bright-teal-blue:#0077b6;
  --blue-green:      #0096c7;
  --turquoise-surf:  #00b4d8;
  --sky-aqua:        #48cae4;
  --frosted-blue:    #90e0ef;
  --frosted-blue-2:  #ade8f4;
  --light-cyan:      #caf0f8; /* azul muy claro, casi blanco */
}
```

Mapeo sugerido (ajustar si al implementar se ve mejor otra combinación, pero
manteniendo la lógica: oscuro para texto/modo oscuro, claro para fondos, un tono
intermedio como acento):

- Fondo modo claro: `--light-cyan` / `--frosted-blue-2` como tinte, blanco de base.
- Texto principal (modo claro): `--deep-twilight` o `--french-blue`.
- Acento interactivo (botones, links, estados activos, elementos "Embarcando"/"En
  camino"): `--bright-teal-blue` o `--turquoise-surf`.
- Modo oscuro: invertir — `--deep-twilight` de fondo, `--sky-aqua`/`--light-cyan`
  para texto y acentos.

**Importante — color de alerta**: toda esta paleta es azul; no trae un color para
alertas. **Se mantiene el rojo** (el mismo criterio que ya usa `styles.css` hoy)
reservado exclusivamente para: atrasos, cancelaciones, exceso de equipaje, deuda
pendiente y errores. No usar rojo en ningún otro lugar de la interfaz, para que
siga funcionando como señal de alerta.

## 6. Estructura de archivos sugerida

Mantener el patrón ya usado en el prototipo (datos / lógica / UI / arranque,
separados). Punto de partida — no es obligatorio si se reconstruye el sitio (ver
sección 0), pero sí mantener el mismo criterio de separación:

```
checkin.html                    Nueva pantalla, o sección dentro del mismo sitio
assets/css/styles.css           Tokens de color (incluida la paleta de la sección 5.1)
assets/js/checkin-mock.js       Datos simulados: pasajeros, vuelos de referencia,
                                 tarifas de exceso, "peso real" simulado, etc.
assets/js/checkin-flow.js       Lógica del flujo y sus estados (sin tocar el DOM)
assets/js/checkin-ui.js         Render de cada pantalla del flujo
assets/js/checkin-main.js       Arranque: une datos + flujo + render
```

## 7. Flujo de pantallas (referencia)

1. Ingreso al portal (celular o tótem).
2. Identificación: código de reserva/n.° de vuelo + documento (simulado).
3. Confirmación de los datos del vuelo.
4. Declaración de equipaje: cuántas maletas, peso pesado en báscula física e
   ingresado por el pasajero (ver sección 2.2), tamaño de mano orientativo.
5. Verificación posterior simulada del peso: si coincide, sigue; si no, muestra
   la pantalla de deuda o de reembolso (sección 2.2).
6. Si el equipaje de mano no pasa el gabinete físico: pantalla de gate-check.
7. Si viaja un menor sin ambos padres/tutores: pantalla de autorización notarial
   (simulada).
8. Aviso informativo sobre restricciones de salida (arraigo) — solo informativo.
9. Pantalla final: pase de abordar simulado + etiqueta de equipaje.
10. Camino alternativo en cualquier paso: si algo "falla", pantalla de derivación
    a mostrador con personal.

## 8. Entregable esperado de esta etapa

Un flujo de check-in navegable de principio a fin, con datos simulados, integrado
visualmente con el panel operacional, con la paleta de colores definida, micro-
animaciones y diseño minimalista, listo para mostrarse en una demo de clase.

## 9. Documentos de referencia (en el mismo repositorio)

- `README.md` — documentación del prototipo actual.
- `trascripcion entrevista.txt` — entrevista original con el cliente.
- `Propuesta_Solucion_CheckIn_Web.docx` — propuesta de solución completa, para
  presentar al profesor (este documento resume y detalla lo esencial para
  construir; el .docx tiene el enfoque formal/académico, incluidas las preguntas
  abiertas y las fuentes consultadas).

## 10. Preguntas todavía abiertas con el cliente (no inventar respuestas)

Estas quedaron pendientes y no deberían cerrarse por cuenta propia al momento de
diseñar el detalle visual o los textos de la simulación:

- Medios de pago que se vincularían a la cuenta del pasajero.
- Límites exactos de tamaño/peso de equipaje.
- Formato exacto de la autorización notarial que la aerolínea aceptaría.
- Normativas aeronáuticas específicas a cumplir.
- Momentos de mayor aglomeración (día/semana/temporada) y en qué proceso puntual.
- En qué momento y con qué instrumento se hace la verificación posterior del peso
  real (al facturar, al embarcar, controles aleatorios).
- Qué plazo y medios de pago se ofrecen para regularizar una deuda antes de
  bloquear viajes futuros.

Para la simulación, donde falte un dato concreto, usar un valor de ejemplo
razonable y dejarlo fácil de cambiar (por ejemplo, en un objeto `CONFIG`, como ya
hace `simulator.js` con sus parámetros).
