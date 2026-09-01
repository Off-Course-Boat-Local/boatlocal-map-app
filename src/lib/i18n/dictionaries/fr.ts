// Français — informal "tu", friendly consumer-app tone (tourism register).
// Typed as `Dictionary`, so a missing key is a TYPE error, never a runtime
// fallback.
//
// NOTE: passed a full quality/idiom review — checked line-by-line against
// en.ts for register, terminology consistency, and grammar.

import type { Dictionary } from "./en";

const fr: Dictionary = {
  common: {
    all: "Tout",
    yourGuide: "ton guide",
    close: "Fermer",
    back: "Retour",
    cancel: "Annuler",
    bookTour: "Réserver cette balade",
    walkingDirections: "Itinéraire à pied",
    savePlace: (name) => `Ajouter ${name} à tes favoris`,
    removeSaved: (name) => `Retirer ${name} de tes favoris`,
    scanAside: "Scanne le code pour l’ouvrir sur ton téléphone — c’est là qu’il est le plus utile.",
    languageLabel: "Langue",
  },

  categories: {
    boats: "Bateaux",
    breakfast: "Petit-déj",
    lunch: "Déjeuner",
    dinner: "Dîner",
    coffee: "Café",
    drinks: "Apéro",
    wine: "Vin",
    dancing: "Danser",
    see: "À voir",
    photo: "Spot photo",
    shop: "Shopping",
  },

  nav: {
    ariaLabel: "Navigation invité",
    map: "Carte",
    list: "Liste",
    saved: "Favoris",
    review: "Avis",
    install: "Installer",
    savedBadge: (n) => ` (${n} favori${n === 1 ? "" : "s"})`,
  },

  list: {
    recommendationsFrom: (n, guide) => `${n} recommandations de ${guide}`,
    filterAriaLabel: "Filtrer les lieux par catégorie",
    emptyCategory: "Pas encore de recommandations dans cette catégorie.",
    viewDetails: (name) => `Voir les détails de ${name}`,
  },

  map: {
    locationOff: "La localisation est désactivée — les distances sont masquées.",
    locationUnavailable: "Impossible d'obtenir ta position pour le moment.",
    tryAgain: "Réessayer",
    turnOnLocation: "Active la localisation pour voir la distance",
    ferryLine: "Ferry depuis Centraal, puis une courte marche",
    ferryCaveat: "L'IJ n'a pas de pont — prends le ferry gratuit.",
    longWalkCaveat:
      "Estimation à vol d'oiseau — le vrai trajet peut traverser l'eau. Vérifie l'itinéraire.",
    rightHere: "Juste ici",
    walkLine: (minutes, distance) => `~${minutes} min à pied · ${distance}`,
    tripSummary: (dateLabel, guests) =>
      `${dateLabel} · ${guests} personne${guests === 1 ? "" : "s"}`,
    noTripDetails: "Pas encore de détails de sortie pour réserver",
    edit: "Modifier",
    addDetails: "Ajouter des détails",
    arrivedTitle: (name) => `Tu es arrivé à ${name}`,
    arrivedBody: (company) => `${company} t'a envoyé ici — alors, ils assurent ?`,
    arrivedCta: "Note ton guide",
    arrivedDismiss: "Fermer",
  },

  placeDetail: {
    photoAlt: (name) => `Photo de ${name}`,
    closeItem: (name) => `Fermer ${name}`,
    showPhotos: (n, name) => `Afficher ${n} photos de ${name}`,
    hidePhotos: "Masquer les photos",
    photosDialogLabel: (name) => `Photos de ${name}`,
    closePhotos: "Fermer les photos",
    viewPhotosFullScreen: (n, name) =>
      `Voir ${n} photo${n === 1 ? "" : "s"} de ${name} en plein écran`,
  },

  navigation: {
    title: (name) => `Itinéraire vers ${name}`,
    loading: "Recherche du meilleur itinéraire…",
    loadError: "Impossible de charger l'itinéraire pour le moment.",
    openExternally: "Ouvrir dans Google Maps",
    arrivedTitle: (name) => `Tu es arrivé à ${name}`,
    stepDistance: (distance) => `Dans ${distance}`,
    remaining: (minutes, distance) => `${minutes} min · ${distance} restants`,
    enableCompass: "Activer la boussole",
    recenter: "Recentrer",
    overview: "Itinéraire complet",
  },

  saved: {
    eyebrow: "Ta sélection",
    title: "Favoris",
    emptySubtitle: (app) => `Aucun favori pour l'instant depuis ${app}`,
    countSubtitle: (n, app) => `${n} favori${n === 1 ? "" : "s"} depuis ${app}`,
    emptyTitle: "Aucun favori pour l'instant",
    emptyBody:
      "Touche le cœur sur un lieu ou une balade en bateau pour l'ajouter ici — ta sélection du jour.",
    browseList: "Parcourir la liste",
    exploreMap: "Explorer la carte",
  },

  review: {
    eyebrow: "Ton retour",
    title: "C'était comment ?",
    subtitle: (company) =>
      `${company} lit tout, un par un — ça prend environ 20 secondes.`,
    socialProof: (n) => `Rejoins ${n} voyageurs qui ont déjà partagé le leur`,
    rateTitle: (company) => `Note ${company}`,
    starLabel: (n) => `${n} étoile${n > 1 ? "s" : ""}`,
    positiveCaption: "Ravi que ça t'ait plu.",
    negativeCaption: "Désolé que ça n'ait pas été à la hauteur — dis-nous ce qui s'est passé.",
    eyebrowNeutral: "Puis partage-le",
    eyebrowPositive: "Partage-le",
    eyebrowNegative: "Où l'envoyer ?",
    reviewOn: (platform) => `Laisse-nous un avis sur ${platform}`,
    publicSubtitle: "Public, aide d'autres voyageurs à nous trouver",
    bestBadge: "Top",
    placeholderNotice: (company) =>
      `${company} n'a pas encore configuré de lien d'avis — ceci ouvre une recherche Google classique.`,
    privateTitle: "Envoyer un retour privé",
    privateSubtitle: (company) => `Seul ${company} le voit`,
    tellDirectly: (company) => `Dis-le directement à ${company}`,
    feedbackPlaceholder: "Qu'est-ce qui aurait pu être mieux ?",
    contactLabel: "Email ou téléphone (facultatif)",
    contactPlaceholder: "Pour qu'on puisse te répondre, si tu veux",
    send: "Envoyer le retour",
    thanks: (company) => `Merci — c'est transmis à ${company}.`,
    maybeLater: "Peut-être plus tard",
  },

  install: {
    eyebrow: "Deux gestes",
    title: "Garde ça sur ton téléphone",
    subtitle: (app) => `${app} sur ton écran d'accueil — pas d'app store, pas de compte.`,
    identityCaption: "Guide local · plein écran",
    iphone: "iPhone",
    android: "Android",
    installedJustNow: (app) => `C'est fait — ${app} est sur ton écran d'accueil.`,
    alreadyInstalled: "Tu utilises déjà l'app installée. Bien joué.",
    genericInstructions: (app) =>
      `Ouvre le menu de ton navigateur et cherche « Ajouter à l'écran d'accueil » ou « Installer l'application » pour ajouter ${app} ici.`,
    scanTitle: "Scanne pour installer",
    scanBody:
      "C'est fait pour un téléphone, pas pour un ordinateur. Ton code QR est dans le panneau à côté de cet écran.",
    microSteps: [
      "Pointe l'appareil photo de ton téléphone vers le code QR du panneau latéral.",
      "Touche le lien qui apparaît sur ton téléphone.",
      "Suis les étapes d'installation à partir de là.",
    ],
    oneTapHint: "Ton navigateur peut l'installer en un geste.",
    oneTapCta: "Ajouter à l'écran d'accueil",
    ios: {
      step1Title: "Ouvre le menu Partager",
      step1Before: "Touche l'icône de partage ",
      step1After: " dans la barre du navigateur.",
      step2Title: "Sur l'écran d'accueil",
      step2Before: "Fais défiler vers le bas et touche ",
      step2Strong: "« Sur l'écran d'accueil »",
      step2After: ".",
      step3Title: "Confirme",
      step3Before: "Touche ",
      step3Strong: "« Ajouter »",
      step3After: " en haut à droite.",
    },
    androidSteps: {
      step1Title: "Ouvre le menu du navigateur",
      step1Before: "Touche le menu ",
      step1After: " en haut à droite du navigateur.",
      step2Title: "Ajouter à l'écran d'accueil",
      step2Before: "Touche ",
      step2Strong: "« Ajouter à l'écran d'accueil »",
      step2After: " (ou « Installer l'application »).",
      step3Title: "Confirme",
      step3Before: "Confirme avec ",
      step3Strong1: "« Ajouter »",
      step3Middle: " / ",
      step3Strong2: "« Installer »",
      step3After: ".",
    },
  },

  booking: {
    dialogLabel: "Détails de la sortie pour réserver un bateau",
    title: "Tu prévois une balade en bateau ?",
    body: "Ajoute une date et le nombre de personnes pour que tout soit prêt quand tu trouves une balade qui te plaît — ou passe cette étape et fais-le plus tard.",
    dateLabel: "Date",
    guestsLabel: "Personnes",
    fewerGuests: "Moins de personnes",
    moreGuests: "Plus de personnes",
    save: "Enregistrer les détails",
  },

  datePicker: {
    pickDate: "Choisis une date",
    prevMonth: "Mois précédent",
    nextMonth: "Mois suivant",
    monthNames: [
      "janvier",
      "février",
      "mars",
      "avril",
      "mai",
      "juin",
      "juillet",
      "août",
      "septembre",
      "octobre",
      "novembre",
      "décembre",
    ],
    monthNamesShort: [
      "janv",
      "févr",
      "mars",
      "avr",
      "mai",
      "juin",
      "juil",
      "août",
      "sept",
      "oct",
      "nov",
      "déc",
    ],
    weekdayNames: [
      "dimanche",
      "lundi",
      "mardi",
      "mercredi",
      "jeudi",
      "vendredi",
      "samedi",
    ],
    weekdayNamesShort: ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"],
    weekdayHeader: ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"],
  },

  welcome: {
    installBanner: "Ajoute ça à ton écran d'accueil pour l'ouvrir en un geste la prochaine fois.",
    installCta: "Installer",
    dismiss: "Ignorer",
    openMap: "Ouvrir la carte",
    browseList: "Parcourir la liste",
    spotsFrom: (n, guide) =>
      `${n} adresses choisies avec soin par ${guide}, plus des balades en bateau à réserver.`,
    topPick: (guide) => `Le coup de cœur de ${guide}`,
    shareTitle: "Partage avec ton compagnon de voyage",
    copyLink: "Copier le lien",
    linkCopied: "Lien copié",
    defaultWelcome:
      "Bienvenue à Amsterdam ! Découvrez nos adresses préférées, les joyaux cachés le long des canaux et nos croisières sélectionnées pour vous.",
  },
};

export default fr;
