// English — the REFERENCE dictionary. Its inferred shape IS the `Dictionary`
// type; nl/de/es are annotated with it, so a key missing (or extra) in any
// translation is a TYPE error at build time, never a silent runtime
// fallback.
//
// Conventions:
//  - Keys are grouped by screen (nav, list, map, saved, review, install,
//    booking, datePicker, placeDetail, welcome) plus the cross-screen
//    `common` and `categories` groups.
//  - Interpolation stays primitive: the few strings that need values are
//    plain template FUNCTIONS (e.g. `recommendationsFrom(n, guide)`), typed
//    here once and therefore statically checked in every translation.
//  - Strings that must render mixed content (the Install screen's <strong>
//    quotes and inline share-icon glyph) are split into before/strong/after
//    string parts — the dictionary holds text only, never JSX.
//  - What is NEVER in here: company/app/guide names, guide-written notes,
//    BoatLocal feed strings (cruise names/meta), area names, platform names
//    (Google, Tripadvisor), URLs. Those pass through verbatim as values.

const en = {
  common: {
    all: "All",
    yourGuide: "your guide",
    close: "Close",
    back: "Back",
    cancel: "Cancel",
    bookTour: "Book this tour",
    walkingDirections: "Walking directions",
    savePlace: (name: string) => `Save ${name}`,
    removeSaved: (name: string) => `Remove ${name} from saved`,
    scanAside: "Scan to open this on your phone — that’s where you’ll want it.",
    languageLabel: "Language",
  },

  /** Category chip LABELS only — ids never change (see src/lib/types.ts). */
  categories: {
    boats: "Boats",
    breakfast: "Breakfast",
    lunch: "Lunch",
    coffee: "Coffee",
    drinks: "Drinks",
    see: "See",
    photo: "Photo spot",
    shop: "Shop",
  },

  nav: {
    ariaLabel: "Guest navigation",
    map: "Map",
    list: "List",
    saved: "Saved",
    review: "Review",
    install: "Install",
    /** Screen-reader suffix on the Saved tab label, e.g. " (3 saved)". */
    savedBadge: (n: number) => ` (${n} saved)`,
  },

  list: {
    recommendationsFrom: (n: number, guide: string) => `${n} recommendations from ${guide}`,
    filterAriaLabel: "Filter places by category",
    emptyCategory: "No recommendations in this category yet.",
    viewDetails: (name: string) => `View details for ${name}`,
  },

  map: {
    locationOff: "Location is off — distances are hidden.",
    locationUnavailable: "Can't get your location right now.",
    tryAgain: "Try again",
    turnOnLocation: "Turn on location to see how far this is",
    ferryLine: "Ferry from Centraal, then a short walk",
    ferryCaveat: "The IJ has no bridge — take the free ferry.",
    longWalkCaveat:
      "Straight-line estimate — the real route may cross water. Check directions.",
    rightHere: "Right here",
    walkLine: (minutes: number, distance: string) => `~${minutes} min walk · ${distance}`,
    tripSummary: (dateLabel: string, guests: number) =>
      `${dateLabel} · ${guests} guest${guests === 1 ? "" : "s"}`,
    noTripDetails: "No trip details set for booking yet",
    edit: "Edit",
    addDetails: "Add details",
  },

  placeDetail: {
    photoAlt: (name: string) => `${name} photo`,
    closeItem: (name: string) => `Close ${name}`,
    showPhotos: (n: number, name: string) => `Show ${n} photos of ${name}`,
    hidePhotos: "Hide photos",
    photosDialogLabel: (name: string) => `${name} photos`,
    closePhotos: "Close photos",
    viewPhotosFullScreen: (n: number, name: string) =>
      `View ${n} photo${n === 1 ? "" : "s"} of ${name} full-screen`,
  },

  saved: {
    eyebrow: "Your shortlist",
    title: "Saved",
    emptySubtitle: (app: string) => `Nothing saved yet from ${app}`,
    countSubtitle: (n: number, app: string) => `${n} saved from ${app}`,
    emptyTitle: "Nothing saved yet",
    emptyBody:
      "Tap the heart on any place or boat tour and it lands here — your shortlist for the day.",
    browseList: "Browse the list",
    exploreMap: "Explore the map",
  },

  review: {
    eyebrow: "Feedback",
    title: "How was it?",
    subtitle: (company: string) =>
      `${company} reads every single one — it takes about 20 seconds.`,
    rateTitle: "Rate your experience",
    starLabel: (n: number) => `${n} star${n > 1 ? "s" : ""}`,
    positiveCaption: "Glad it landed well.",
    negativeCaption: "Sorry it fell short — tell us what happened.",
    eyebrowNeutral: "Then share it",
    eyebrowPositive: "Share it",
    eyebrowNegative: "Where should this go?",
    /** Platform name (Google, Tripadvisor) passes through untranslated. */
    reviewOn: (platform: string) => `Review us on ${platform}`,
    publicSubtitle: "Public, helps other guests find us",
    bestBadge: "Best",
    placeholderNotice: (company: string) =>
      `${company} hasn’t set up a review link yet — this opens a plain Google search instead.`,
    privateTitle: "Share private feedback instead",
    privateSubtitle: (company: string) => `Only ${company} sees this`,
    tellDirectly: (company: string) => `Tell ${company} directly`,
    feedbackPlaceholder: "What could have been better?",
    contactLabel: "Email or phone (optional)",
    contactPlaceholder: "So they can follow up, if you'd like",
    send: "Send feedback",
    thanks: (company: string) => `Thanks — that’s been passed along to ${company}.`,
    maybeLater: "Maybe later",
  },

  install: {
    eyebrow: "Two taps",
    title: "Keep this on your phone",
    subtitle: (app: string) => `${app} on your home screen — no app store, no account.`,
    identityCaption: "Local guide · full screen",
    iphone: "iPhone",
    android: "Android",
    installedJustNow: (app: string) => `You're set — ${app} is on your home screen.`,
    alreadyInstalled: "You're already using the installed app. Nicely done.",
    genericInstructions: (app: string) =>
      `Open your browser’s menu and look for “Add to Home Screen” or “Install app” to add ${app} here.`,
    scanTitle: "Scan to install",
    scanBody:
      "This lives on a phone, not a desktop. Your QR code is in the panel beside this screen.",
    microSteps: [
      "Point your phone’s camera at the QR code in the side panel.",
      "Tap the link that pops up on your phone.",
      "Follow the install steps from there.",
    ],
    oneTapHint: "Your browser can install this in one tap.",
    oneTapCta: "Add to Home Screen",
    ios: {
      step1Title: "Open the Share menu",
      /** Rendered as: {before}<ShareGlyph />{after} */
      step1Before: "Tap the Share icon ",
      step1After: " in the browser toolbar.",
      step2Title: "Add to Home Screen",
      /** Rendered as: {before}<strong>{strong}</strong>{after} */
      step2Before: "Scroll down and tap ",
      step2Strong: "“Add to Home Screen”",
      step2After: ".",
      step3Title: "Confirm",
      step3Before: "Tap ",
      step3Strong: "“Add”",
      step3After: " in the top right.",
    },
    androidSteps: {
      step1Title: "Open the browser menu",
      /** Rendered as: {before}<strong>⋮</strong>{after} — the ⋮ never translates. */
      step1Before: "Tap the ",
      step1After: " menu in the top right of the browser.",
      step2Title: "Add to Home screen",
      step2Before: "Tap ",
      step2Strong: "“Add to Home screen”",
      step2After: " (or “Install app”).",
      step3Title: "Confirm",
      /** Rendered as: {before}<strong>{strong1}</strong>{middle}<strong>{strong2}</strong>{after} */
      step3Before: "Confirm with ",
      step3Strong1: "“Add”",
      step3Middle: " / ",
      step3Strong2: "“Install”",
      step3After: ".",
    },
  },

  booking: {
    dialogLabel: "Trip details for booking a boat",
    title: "Planning a boat trip?",
    body: "Add a date and party size so it’s ready to go when you find a tour you like — or skip this and set it later.",
    dateLabel: "Date",
    guestsLabel: "Guests",
    fewerGuests: "Fewer guests",
    moreGuests: "More guests",
    save: "Save trip details",
  },

  datePicker: {
    pickDate: "Pick a date",
    prevMonth: "Previous month",
    nextMonth: "Next month",
    /** Indexed by Date#getMonth(). */
    monthNames: [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
    monthNamesShort: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
    /** Indexed by Date#getDay() (Sunday-first, as the platform defines it). */
    weekdayNames: [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ],
    weekdayNamesShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    /** Header row — Monday-first, matching Dutch/European convention. */
    weekdayHeader: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  },

  welcome: {
    installBanner: "Add this to your home screen for one-tap access next time.",
    installCta: "Install",
    dismiss: "Dismiss",
    openMap: "Open the map",
    browseList: "Browse the list",
    spotsFrom: (n: number, guide: string) =>
      `${n} hand-picked spots from ${guide}, plus boat tours to book.`,
    topPick: (guide: string) => `${guide}’s top pick`,
    shareTitle: "Share with a travel companion",
    copyLink: "Copy link",
    linkCopied: "Link copied",
    defaultWelcome:
      "Welcome! I've collected my favourite spots in the city, just for you.",
  },
};

/** The one dictionary shape every locale must satisfy exactly. */
export type Dictionary = typeof en;

export default en;
