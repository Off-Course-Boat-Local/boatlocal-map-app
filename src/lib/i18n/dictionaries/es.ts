// Español — informal "tú", friendly consumer-app tone (tourism register).
// Typed as `Dictionary`, so a missing key is a TYPE error, never a runtime
// fallback.

import type { Dictionary } from "./en";

const es: Dictionary = {
  common: {
    all: "Todo",
    yourGuide: "tu guía",
    close: "Cerrar",
    back: "Atrás",
    cancel: "Cancelar",
    bookTour: "Reservar este tour",
    walkingDirections: "Cómo llegar a pie",
    savePlace: (name) => `Guardar ${name}`,
    removeSaved: (name) => `Quitar ${name} de guardados`,
    scanAside: "Escanéalo para abrirlo en tu móvil — ahí es donde mejor funciona.",
    languageLabel: "Idioma",
  },

  categories: {
    boats: "Barcos",
    breakfast: "Desayuno",
    lunch: "Almuerzo",
    coffee: "Café",
    drinks: "Bebidas",
    see: "Qué ver",
    photo: "Fotos",
    shop: "Compras",
  },

  nav: {
    ariaLabel: "Navegación para huéspedes",
    map: "Mapa",
    list: "Lista",
    saved: "Guardados",
    review: "Reseña",
    install: "Instalar",
    savedBadge: (n) => ` (${n} guardados)`,
  },

  list: {
    recommendationsFrom: (n, guide) => `${n} recomendaciones de ${guide}`,
    filterAriaLabel: "Filtrar lugares por categoría",
    emptyCategory: "Aún no hay recomendaciones en esta categoría.",
    viewDetails: (name) => `Ver detalles de ${name}`,
  },

  map: {
    locationOff: "La ubicación está desactivada — no podemos mostrarte las distancias.",
    locationUnavailable: "Ahora mismo no podemos obtener tu ubicación.",
    tryAgain: "Reintentar",
    turnOnLocation: "Activa la ubicación para ver a qué distancia está",
    ferryLine: "Ferry desde Centraal y un paseo corto",
    ferryCaveat: "El IJ no tiene puente — toma el ferry gratuito.",
    longWalkCaveat:
      "Estimación en línea recta — la ruta real puede cruzar agua. Consulta cómo llegar.",
    rightHere: "Aquí mismo",
    walkLine: (minutes, distance) => `~${minutes} min a pie · ${distance}`,
    tripSummary: (dateLabel, guests) =>
      `${dateLabel} · ${guests} ${guests === 1 ? "persona" : "personas"}`,
    noTripDetails: "Aún no has guardado los datos del viaje",
    edit: "Editar",
    addDetails: "Añadir datos",
  },

  placeDetail: {
    photoAlt: (name) => `Foto de ${name}`,
    closeItem: (name) => `Cerrar ${name}`,
    showPhotos: (n, name) => `Mostrar ${n} fotos de ${name}`,
    hidePhotos: "Ocultar fotos",
    photosDialogLabel: (name) => `Fotos de ${name}`,
    closePhotos: "Cerrar fotos",
    viewPhotosFullScreen: (n, name) =>
      `Ver ${n} foto${n === 1 ? "" : "s"} de ${name} a pantalla completa`,
  },

  saved: {
    eyebrow: "Tu selección",
    title: "Guardados",
    emptySubtitle: (app) => `Aún no has guardado nada de ${app}`,
    countSubtitle: (n, app) => `${n} guardados de ${app}`,
    emptyTitle: "Aún no hay nada guardado",
    emptyBody:
      "Toca el corazón en cualquier lugar o paseo en barco y aparecerá aquí — tu selección del día.",
    browseList: "Ver la lista",
    exploreMap: "Explorar el mapa",
  },

  review: {
    eyebrow: "Tu opinión",
    title: "¿Qué tal ha ido?",
    subtitle: (company) =>
      `${company} lee todas las opiniones, una por una — te llevará unos 20 segundos.`,
    rateTitle: "Valora tu experiencia",
    starLabel: (n) => `${n} estrella${n > 1 ? "s" : ""}`,
    positiveCaption: "Nos alegra que lo hayas disfrutado.",
    negativeCaption: "Sentimos que no estuviera a la altura — cuéntanos qué pasó.",
    eyebrowNeutral: "Luego compártelo",
    eyebrowPositive: "Compártelo",
    eyebrowNegative: "¿Adónde lo enviamos?",
    reviewOn: (platform) => `Déjanos una reseña en ${platform}`,
    publicSubtitle: "Pública, ayuda a otros huéspedes a encontrarnos",
    bestBadge: "Mejor",
    placeholderNotice: (company) =>
      `${company} aún no ha configurado un enlace de reseñas — esto abre una búsqueda normal de Google.`,
    privateTitle: "Comparte tus comentarios en privado",
    privateSubtitle: (company) => `Solo ${company} lo verá`,
    tellDirectly: (company) => `Cuéntaselo directamente a ${company}`,
    feedbackPlaceholder: "¿Qué podría haber sido mejor?",
    contactLabel: "Email o teléfono (opcional)",
    contactPlaceholder: "Para que puedan responderte, si quieres",
    send: "Enviar comentarios",
    thanks: (company) => `Gracias — se lo hemos hecho llegar a ${company}.`,
    maybeLater: "Quizá más tarde",
  },

  install: {
    eyebrow: "Dos toques",
    title: "Llévalo en tu móvil",
    subtitle: (app) => `${app} en tu pantalla de inicio — sin app store, sin cuenta.`,
    identityCaption: "Guía local · pantalla completa",
    iphone: "iPhone",
    android: "Android",
    installedJustNow: (app) => `Listo — ${app} ya está en tu pantalla de inicio.`,
    alreadyInstalled: "Ya estás usando la app instalada. Bien hecho.",
    genericInstructions: (app) =>
      `Abre el menú de tu navegador y busca “Añadir a pantalla de inicio” o “Instalar aplicación” para añadir ${app} aquí.`,
    scanTitle: "Escanea para instalar",
    scanBody:
      "Esto está pensado para el móvil, no para el ordenador. Tu código QR está en el panel junto a esta pantalla.",
    microSteps: [
      "Apunta con la cámara de tu móvil al código QR del panel lateral.",
      "Toca el enlace que aparecerá en tu móvil.",
      "Sigue los pasos de instalación desde ahí.",
    ],
    oneTapHint: "Tu navegador puede instalarlo con un solo toque.",
    oneTapCta: "Añadir a pantalla de inicio",
    ios: {
      step1Title: "Abre el menú Compartir",
      step1Before: "Toca el icono de compartir ",
      step1After: " en la barra del navegador.",
      step2Title: "Añadir a pantalla de inicio",
      step2Before: "Desplázate hacia abajo y toca ",
      step2Strong: "“Añadir a pantalla de inicio”",
      step2After: ".",
      step3Title: "Confirma",
      step3Before: "Toca ",
      step3Strong: "“Añadir”",
      step3After: " arriba a la derecha.",
    },
    androidSteps: {
      step1Title: "Abre el menú del navegador",
      step1Before: "Toca el menú ",
      step1After: " arriba a la derecha del navegador.",
      step2Title: "Añadir a pantalla de inicio",
      step2Before: "Toca ",
      step2Strong: "“Añadir a pantalla de inicio”",
      step2After: " (o “Instalar aplicación”).",
      step3Title: "Confirma",
      step3Before: "Confirma con ",
      step3Strong1: "“Añadir”",
      step3Middle: " / ",
      step3Strong2: "“Instalar”",
      step3After: ".",
    },
  },

  booking: {
    dialogLabel: "Datos del viaje para reservar un barco",
    title: "¿Planeando un paseo en barco?",
    body: "Añade fecha y número de personas para tenerlo listo cuando encuentres un tour que te guste — o sáltatelo y hazlo más tarde.",
    dateLabel: "Fecha",
    guestsLabel: "Personas",
    fewerGuests: "Menos personas",
    moreGuests: "Más personas",
    save: "Guardar datos del viaje",
  },

  datePicker: {
    pickDate: "Elige una fecha",
    prevMonth: "Mes anterior",
    nextMonth: "Mes siguiente",
    monthNames: [
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ],
    monthNamesShort: [
      "ene",
      "feb",
      "mar",
      "abr",
      "may",
      "jun",
      "jul",
      "ago",
      "sep",
      "oct",
      "nov",
      "dic",
    ],
    weekdayNames: [
      "domingo",
      "lunes",
      "martes",
      "miércoles",
      "jueves",
      "viernes",
      "sábado",
    ],
    weekdayNamesShort: ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"],
    weekdayHeader: ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"],
  },

  welcome: {
    installBanner: "Añádelo a tu pantalla de inicio y ábrelo con un toque la próxima vez.",
    installCta: "Instalar",
    dismiss: "Descartar",
    openMap: "Abrir el mapa",
    browseList: "Ver la lista",
    spotsFrom: (n, guide) =>
      `${n} lugares elegidos a mano por ${guide}, más paseos en barco para reservar.`,
    topPick: (guide) => `El favorito de ${guide}`,
    shareTitle: "Comparte con tu acompañante de viaje",
    copyLink: "Copiar enlace",
    linkCopied: "Enlace copiado",
    defaultWelcome:
      "¡Bienvenido a Ámsterdam! Descubre nuestros rincones favoritos, joyas escondidas junto a los canales y paseos en barco seleccionados para ti.",
  },
};

export default es;
