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
> cliente (ver sección 9) — en ese caso, resuelve con un criterio razonable y
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
- El diseño debe ser **minimalista** y usar **micro-animaciones** sutiles, siguiendo
  la misma línea visual que ya tiene el panel operacional.
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
Propuesta_Solucion_CheckIn_Web.docx   Propuesta de solución (resumida en este doc)
```

Stack: **HTML + CSS + JavaScript sin framework ni build**, tal como define el
README del proyecto. Cuando exista backend, será Node + Express. Por ahora no hay
backend: todo corre en el navegador.

La separación de responsabilidades del prototipo actual es intencional y **hay que
mantenerla** en lo nuevo que se construya:

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

Se decidió extender el mismo sitio web (mismo stack, mismos estilos) con un frente
orientado al pasajero, usable desde el celular del pasajero **y** en modo "tótem"
en el aeropuerto (misma página, en pantalla completa). Módulos funcionales:

1. **Identificación del pasajero** — código de reserva/n° de vuelo + documento.
2. **Confirmación de vuelo** — muestra los datos del vuelo (puede reutilizar/objeto
   similar a `mock-flights.js`).
3. **Declaración de equipaje** — cuántas maletas de mano y despachadas, con guía
   visual de tamaño máximo.
4. **Peso y cobro de exceso** — si se supera el límite, cobro simulado en la misma
   pantalla, sin pedir efectivo ni tarjeta física en la mano.
5. **Validación legal (menores y restricciones de viaje)** — ver sección 2.
6. **Pase de abordar y etiqueta de equipaje** — pantalla final del flujo.
7. **Panel operacional** — el que ya existe; no se modifica en esta etapa salvo que
   se pida explícitamente.

## 2. Requisitos legales y de seguridad a simular (importante)

El cliente pidió expresamente cubrir dos situaciones sensibles. **En esta etapa se
simulan como flujo de pantallas, sin verificación real de ningún tipo**:

### 2.1 Menores de edad sin ambos padres o tutores

Si el pasajero declara que viaja un menor de edad sin ambos padres/tutores
legales, el flujo debe pedir **adjuntar la autorización notarial de viaje** antes
de continuar (simular con un input de archivo o un código de verificación
ficticio). Si no se "adjunta", el check-in no se completa y se muestra un mensaje
de derivación a mostrador. **No se valida el contenido real del documento** — es
una simulación de la interacción, no un verificador real.

### 2.2 Pasajeros con arraigo (impedimento judicial de salida)

Un arraigo es una orden judicial que impide a alguien salir del país. **Esto no se
puede verificar de verdad desde una plataforma privada** (en la realidad lo hace
la PDI en el control migratorio, contra bases de datos del Poder Judicial, a las
que la aerolínea no tiene acceso). Por eso, en la simulación esto se representa
como una **pantalla informativa/recordatorio** ("recuerda que la salida del país
está sujeta a que no existan restricciones judiciales vigentes; la validación
final la hace el control migratorio"), nunca como una casilla que "confirma" que
el pasajero no tiene arraigo. No inventar una validación falsa de esto.

### 2.3 Cómo mostrarlo en la UI

Cada pantalla sensible (pago, autorización de menor, aviso de arraigo) debe dejar
claro con un texto pequeño que es una simulación — el mismo espíritu del aviso que
ya tiene el README: *"Todos los datos son ficticios."* Por ejemplo: *"Simulación —
sin conexión a medios de pago ni a bases de datos reales."*

## 3. Encargo para esta etapa

Construir el **flujo de check-in de autoservicio como simulación navegable de
principio a fin**, con datos falsos, sin backend, integrado visualmente con el
panel operacional ya existente. Nada de esto se conecta a servicios reales.

### 3.1 Qué SÍ hacer

- Flujo completo, pantalla por pantalla, de los módulos 1 a 6 de la sección 1.3.
- Datos simulados (nombres, vuelos, pesos, montos) con la misma lógica de "mock"
  que ya usa `mock-flights.js`.
- Estados y transiciones falsas pero creíbles: por ejemplo, un botón "Pagar" que
  muestra un spinner breve y luego un check de éxito, sin pasarela real.
- Casos de error simulados (documento no coincide, pago "rechazado", autorización
  de menor faltante) que deriven a una pantalla de "acércate a un mostrador".
- Micro-animaciones (ver sección 4).
- Responsive: debe verse bien tanto en el celular del pasajero como en una
  pantalla grande tipo tótem.
- Mantener el modo claro/oscuro automático que ya tiene el sitio.

### 3.2 Qué NO hacer

- No implementar pagos reales ni conectar ninguna pasarela.
- No implementar validación real de identidad, OCR, cámara real ni biometría.
- No conectar con ningún servicio externo real (PDI, notarías, bases de datos
  judiciales, APIs de pago).
- No agregar frameworks ni herramientas de build (seguir HTML/CSS/JS vanilla, sin
  npm ni bundlers), tal como define el README del proyecto — esto aplica incluso
  si se reconstruye el sitio completo (ver nota de la sección 0).
- No prometer en la UI algo que la simulación no hace de verdad (por ejemplo, un
  texto que diga "identidad verificada" sin más — mejor "identidad simulada como
  verificada").

## 4. Requisitos de diseño

- **Minimalista**: mucho espacio en blanco, jerarquía por tipografía y tamaño más
  que por bordes o cajas (mismo criterio que ya usa `styles.css`). Pocas piezas de
  color: un acento (el mismo azul que ya se usa para "Embarcando"/"En camino"),
  rojo reservado solo para alertas reales (exceso de equipaje, error, atraso), y
  grises neutros para todo lo demás.
- **Micro-animaciones**: transiciones suaves entre pasos del flujo (fade/slide al
  avanzar o retroceder), un pequeño destello o check animado al completar una
  acción (como el destello que ya usa el tablero al cambiar de estado), un
  feedback visual breve durante las esperas simuladas (pago "procesando",
  validación "en curso"). Deben ser sutiles, nunca vistosas ni lentas — el
  objetivo es que se sienta pulido, no que llame la atención por sí mismo.
- **Consistencia visual** con el panel operacional: mismos tokens de color y
  tipografía de `assets/css/styles.css`. Si hace falta extender la paleta, sumar
  variables nuevas en el mismo archivo o en uno equivalente, no crear un sistema
  de diseño paralelo.
- **Sin necesidad de instalar nada**: se abre en el navegador igual que
  `index.html` hoy.

## 5. Estructura de archivos sugerida

Mantener el patrón ya usado en el prototipo (datos / lógica / UI / arranque,
separados):

```
checkin.html                    Nueva pantalla, o sección dentro del mismo sitio
assets/css/styles.css           Reutilizar tokens existentes; extender si hace falta
assets/js/checkin-mock.js       Datos simulados propios del check-in (pasajeros,
                                 vuelos de referencia, tarifas de exceso, etc.)
assets/js/checkin-flow.js       Lógica del flujo y sus estados (sin tocar el DOM)
assets/js/checkin-ui.js         Render de cada pantalla del flujo
assets/js/checkin-main.js       Arranque: une datos + flujo + render
```

Ajustar nombres si Claude Code encuentra una organización mejor, pero manteniendo
la misma idea de separación que ya está documentada en el README del proyecto. Si
se opta por reconstruir el sitio completo (ver sección 0), esta estructura es solo
un punto de partida, no una obligación: lo importante es mantener el mismo
criterio de separación (datos / lógica / UI / arranque), no los nombres exactos.

## 6. Flujo de pantallas (referencia)

1. Ingreso al portal (celular o tótem).
2. Identificación: código de reserva/n° de vuelo + documento (simulado).
3. Confirmación de los datos del vuelo.
4. Declaración de equipaje (mano y despachado).
5. Si hay exceso de peso/tamaño: pantalla de cobro simulado.
6. Si viaja un menor sin ambos padres/tutores: pantalla de autorización notarial
   (simulada).
7. Aviso informativo sobre restricciones de salida (arraigo) — solo informativo.
8. Pantalla final: pase de abordar simulado + etiqueta de equipaje.
9. Camino alternativo en cualquier paso: si algo "falla", pantalla de derivación a
   mostrador con personal.

## 7. Entregable esperado de esta etapa

Un flujo de check-in navegable de principio a fin, con datos simulados, integrado
visualmente con el panel operacional existente, con micro-animaciones y diseño
minimalista, listo para mostrarse en una demo de clase — de la misma forma en que
hoy se puede mostrar el panel operacional abriendo `index.html`.

## 8. Documentos de referencia (en el mismo repositorio)

- `README.md` — documentación del prototipo actual.
- `trascripcion entrevista.txt` — entrevista original con el cliente.
- `Propuesta_Solucion_CheckIn_Web.docx` — propuesta de solución completa (este
  documento resume lo esencial; el .docx tiene el detalle completo, incluidas las
  preguntas abiertas y las fuentes consultadas).

## 9. Preguntas todavía abiertas con el cliente (no inventar respuestas)

Estas quedaron pendientes en la propuesta y no deberían cerrarse por cuenta propia
al momento de diseñar el detalle visual o los textos de la simulación:

- Medios de pago que se vincularían a la cuenta del pasajero.
- Límites exactos de tamaño/peso de equipaje.
- Formato exacto de la autorización notarial que la aerolínea aceptaría.
- Normativas aeronáuticas específicas a cumplir.
- Momentos de mayor aglomeración (día/semana/temporada) y en qué proceso puntual.

Para la simulación, donde falte un dato concreto, usar un valor de ejemplo
razonable y dejarlo fácil de cambiar (por ejemplo, en un objeto `CONFIG`, como ya
hace `simulator.js` con sus parámetros).
