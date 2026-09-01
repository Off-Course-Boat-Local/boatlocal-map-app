// Nederlands — informal "je", friendly consumer-app tone (tourism register).
// The most important market: wording tuned to sound like a local host, not a
// literal translation. Typed as `Dictionary`, so a missing key is a TYPE
// error, never a runtime fallback.

import type { Dictionary } from "./en";

const nl: Dictionary = {
  common: {
    all: "Alles",
    yourGuide: "je gids",
    close: "Sluiten",
    back: "Terug",
    cancel: "Annuleren",
    bookTour: "Boek deze tour",
    walkingDirections: "Looproute",
    savePlace: (name) => `${name} bewaren`,
    removeSaved: (name) => `${name} niet meer bewaren`,
    scanAside: "Scan de code om dit op je telefoon te openen — daar hoort het thuis.",
    languageLabel: "Taal",
  },

  categories: {
    boats: "Boten",
    breakfast: "Ontbijt",
    lunch: "Lunch",
    coffee: "Koffie",
    drinks: "Borrel",
    dancing: "Uitgaan",
    see: "Zien",
    photo: "Fotospot",
    shop: "Shoppen",
  },

  nav: {
    ariaLabel: "Gastnavigatie",
    map: "Kaart",
    list: "Lijst",
    saved: "Bewaard",
    review: "Review",
    install: "Installeer",
    savedBadge: (n) => ` (${n} bewaard)`,
  },

  list: {
    recommendationsFrom: (n, guide) => `${n} tips van ${guide}`,
    filterAriaLabel: "Filter plekken op categorie",
    emptyCategory: "Nog geen tips in deze categorie.",
    viewDetails: (name) => `Bekijk details van ${name}`,
  },

  map: {
    locationOff: "Locatie staat uit — we tonen daarom geen afstanden.",
    locationUnavailable: "Kan je locatie nu niet bepalen.",
    tryAgain: "Probeer opnieuw",
    turnOnLocation: "Zet locatie aan om te zien hoe ver dit is",
    ferryLine: "Pont vanaf Centraal, daarna een klein stukje lopen",
    ferryCaveat: "Het IJ heeft geen brug — neem de gratis pont.",
    longWalkCaveat:
      "Schatting in vogelvlucht — de echte route kan over water gaan. Check de looproute.",
    rightHere: "Pal hier",
    walkLine: (minutes, distance) => `~${minutes} min lopen · ${distance}`,
    tripSummary: (dateLabel, guests) =>
      `${dateLabel} · ${guests} ${guests === 1 ? "gast" : "gasten"}`,
    noTripDetails: "Nog geen reisgegevens ingesteld om te boeken",
    edit: "Bewerken",
    addDetails: "Vul gegevens in",
  },

  placeDetail: {
    photoAlt: (name) => `Foto van ${name}`,
    closeItem: (name) => `${name} sluiten`,
    showPhotos: (n, name) => `Toon ${n} foto's van ${name}`,
    hidePhotos: "Verberg foto's",
    photosDialogLabel: (name) => `Foto's van ${name}`,
    closePhotos: "Foto's sluiten",
    viewPhotosFullScreen: (n, name) =>
      `Bekijk ${n} foto${n === 1 ? "" : "'s"} van ${name} op volledig scherm`,
  },

  saved: {
    eyebrow: "Jouw selectie",
    title: "Bewaard",
    emptySubtitle: (app) => `Nog niets bewaard uit ${app}`,
    countSubtitle: (n, app) => `${n} bewaard uit ${app}`,
    emptyTitle: "Nog niets bewaard",
    emptyBody:
      "Tik op het hartje bij een plek of boottocht en die verschijnt hier — jouw selectie voor vandaag.",
    browseList: "Bekijk de lijst",
    exploreMap: "Ontdek de kaart",
  },

  review: {
    eyebrow: "Feedback",
    title: "Hoe was het?",
    subtitle: (company) =>
      `${company} leest ze stuk voor stuk — het kost je zo'n 20 seconden.`,
    rateTitle: "Beoordeel je ervaring",
    starLabel: (n) => `${n} ster${n > 1 ? "ren" : ""}`,
    positiveCaption: "Fijn dat het in de smaak viel.",
    negativeCaption: "Jammer dat het tegenviel — vertel ons wat er gebeurde.",
    eyebrowNeutral: "Deel het daarna",
    eyebrowPositive: "Deel het",
    eyebrowNegative: "Waar mag dit heen?",
    reviewOn: (platform) => `Beoordeel ons op ${platform}`,
    publicSubtitle: "Openbaar, helpt andere gasten ons te vinden",
    bestBadge: "Top",
    placeholderNotice: (company) =>
      `${company} heeft nog geen reviewlink ingesteld — dit opent een gewone Google-zoekopdracht.`,
    privateTitle: "Stuur ons privéfeedback",
    privateSubtitle: (company) => `Alleen ${company} ziet dit`,
    tellDirectly: (company) => `Vertel het ${company} rechtstreeks`,
    feedbackPlaceholder: "Wat had beter gekund?",
    contactLabel: "E-mail of telefoon (optioneel)",
    contactPlaceholder: "Zodat ze kunnen reageren, als je dat wilt",
    send: "Verstuur feedback",
    thanks: (company) => `Bedankt — dit is doorgegeven aan ${company}.`,
    maybeLater: "Misschien later",
  },

  install: {
    eyebrow: "Twee tikjes",
    title: "Houd dit op je telefoon",
    subtitle: (app) => `${app} op je beginscherm — geen app store, geen account.`,
    identityCaption: "Lokale gids · volledig scherm",
    iphone: "iPhone",
    android: "Android",
    installedJustNow: (app) => `Klaar — ${app} staat op je beginscherm.`,
    alreadyInstalled: "Je gebruikt de geïnstalleerde app al. Goed bezig.",
    genericInstructions: (app) =>
      `Open het menu van je browser en zoek naar “Zet op beginscherm” of “App installeren” om ${app} toe te voegen.`,
    scanTitle: "Scan om te installeren",
    scanBody:
      "Dit hoort op een telefoon, niet op een desktop. Je QR-code staat in het paneel naast dit scherm.",
    microSteps: [
      "Richt de camera van je telefoon op de QR-code in het zijpaneel.",
      "Tik op de link die op je telefoon verschijnt.",
      "Volg daarna de installatiestappen.",
    ],
    oneTapHint: "Je browser kan dit in één tik installeren.",
    oneTapCta: "Zet op beginscherm",
    ios: {
      step1Title: "Open het deelmenu",
      step1Before: "Tik op het deelicoon ",
      step1After: " in de browserbalk.",
      step2Title: "Zet op beginscherm",
      step2Before: "Scrol omlaag en tik op ",
      step2Strong: "“Zet op beginscherm”",
      step2After: ".",
      step3Title: "Bevestig",
      step3Before: "Tik rechtsboven op ",
      step3Strong: "“Voeg toe”",
      step3After: ".",
    },
    androidSteps: {
      step1Title: "Open het browsermenu",
      step1Before: "Tik op het ",
      step1After: "-menu rechtsboven in de browser.",
      step2Title: "Toevoegen aan startscherm",
      step2Before: "Tik op ",
      step2Strong: "“Toevoegen aan startscherm”",
      step2After: " (of “App installeren”).",
      step3Title: "Bevestig",
      step3Before: "Bevestig met ",
      step3Strong1: "“Toevoegen”",
      step3Middle: " / ",
      step3Strong2: "“Installeren”",
      step3After: ".",
    },
  },

  booking: {
    dialogLabel: "Reisgegevens voor het boeken van een boot",
    title: "Een boottocht plannen?",
    body: "Vul een datum en het aantal gasten in, dan staat alles klaar zodra je een leuke tour vindt — of sla dit over en doe het later.",
    dateLabel: "Datum",
    guestsLabel: "Gasten",
    fewerGuests: "Minder gasten",
    moreGuests: "Meer gasten",
    save: "Bewaar reisgegevens",
  },

  datePicker: {
    pickDate: "Kies een datum",
    prevMonth: "Vorige maand",
    nextMonth: "Volgende maand",
    monthNames: [
      "januari",
      "februari",
      "maart",
      "april",
      "mei",
      "juni",
      "juli",
      "augustus",
      "september",
      "oktober",
      "november",
      "december",
    ],
    monthNamesShort: [
      "jan",
      "feb",
      "mrt",
      "apr",
      "mei",
      "jun",
      "jul",
      "aug",
      "sep",
      "okt",
      "nov",
      "dec",
    ],
    weekdayNames: [
      "zondag",
      "maandag",
      "dinsdag",
      "woensdag",
      "donderdag",
      "vrijdag",
      "zaterdag",
    ],
    weekdayNamesShort: ["zo", "ma", "di", "wo", "do", "vr", "za"],
    weekdayHeader: ["ma", "di", "wo", "do", "vr", "za", "zo"],
  },

  welcome: {
    installBanner: "Zet dit op je beginscherm en open het volgende keer met één tik.",
    installCta: "Installeer",
    dismiss: "Sluiten",
    openMap: "Open de kaart",
    browseList: "Bekijk de lijst",
    spotsFrom: (n, guide) =>
      `${n} persoonlijk uitgekozen plekken van ${guide}, plus boottochten om te boeken.`,
    topPick: (guide) => `De favoriet van ${guide}`,
    shareTitle: "Deel met een reisgenoot",
    copyLink: "Kopieer link",
    linkCopied: "Link gekopieerd",
    defaultWelcome:
      "Welkom in Amsterdam! Ontdek onze favoriete lokale plekken, verborgen parels aan de grachten en rondvaarten speciaal voor jou samengesteld.",
  },
};

export default nl;
