import { LEGAL_IDENTITY } from "@/lib/legal-identity"

export type LegalSection = { title: string; paragraphs: string[] }

export const PRIVACY_POLICY: { title: string; intro: string; sections: LegalSection[] } = {
  title: "Politique de confidentialité",
  intro:
    "Cette politique explique comment BKG Rewards collecte, utilise et protège vos données lorsque vous utilisez nos services sur le Web et sur l’application Android.",
  sections: [
    {
      title: "1. Responsable du traitement",
      paragraphs: [
        `Le responsable du traitement est ${LEGAL_IDENTITY.companyName} (SIREN ${LEGAL_IDENTITY.siren} • SIRET ${LEGAL_IDENTITY.siret} • RCS ${LEGAL_IDENTITY.rcs}).`,
      ],
    },
    {
      title: "2. Données collectées",
      paragraphs: [
        "Données de compte : e-mail, identifiants d’authentification et informations nécessaires à la gestion du compte.",
        "Données de profil : pseudo/nom, avatar et, si vous la renseignez, adresse de livraison pour l’envoi d’un lot.",
        "Données techniques : journaux techniques, informations de sécurité anti-fraude, et données de diagnostic (selon votre appareil et votre navigateur).",
      ],
    },
    {
      title: "3. Finalités",
      paragraphs: [
        "Créer et gérer votre compte, vous authentifier et sécuriser l’accès.",
        "Attribuer des points de fidélité, enregistrer les participations et gérer les tirages.",
        "Détecter et prévenir la fraude et les usages automatisés interdits.",
        "Améliorer la stabilité, la performance et l’expérience utilisateur.",
      ],
    },
    {
      title: "4. Publicité et mesure (Google / AdMob)",
      paragraphs: [
        "Sur l’application Android, nous pouvons afficher des publicités via Google AdMob (et services Google associés).",
        "Selon les réglages et la réglementation applicable, des identifiants publicitaires et/ou données de mesure peuvent être traités par Google afin de diffuser des annonces, limiter la fraude et mesurer les performances.",
        "Vous pouvez gérer les paramètres de confidentialité publicitaire dans les réglages de votre appareil lorsque cela est disponible.",
      ],
    },
    {
      title: "5. Paiements",
      paragraphs: [
        "Sur le Web, certains paiements/abonnements peuvent être traités par Stripe. BKG Rewards ne stocke pas vos données de carte bancaire.",
        "Sur Android, les achats sont réalisés via Google Play Billing. Les informations de paiement sont traitées par Google.",
      ],
    },
    {
      title: "6. Destinataires",
      paragraphs: [
        "Nous ne vendons pas vos données personnelles.",
        "Certaines données peuvent être traitées par nos prestataires techniques (hébergement, authentification, analytics, publicité) uniquement pour fournir le service.",
      ],
    },
    {
      title: "7. Durée de conservation",
      paragraphs: [
        "Les données de compte sont conservées tant que le compte est actif, puis supprimées ou anonymisées selon les obligations légales.",
        "Les journaux techniques sont conservés pour une durée limitée à des fins de sécurité et de diagnostic.",
      ],
    },
    {
      title: "8. Vos droits (RGPD)",
      paragraphs: [
        "Vous disposez d’un droit d’accès, de rectification, d’effacement, d’opposition, et, le cas échéant, de portabilité.",
        "Pour toute demande, contactez le support via la page Support de l’application ou du site.",
      ],
    },
    {
      title: "9. Contact",
      paragraphs: ["Pour toute question relative à la confidentialité, contactez-nous via la page Support."],
    },
  ],
}

export const TERMS_OF_SERVICE: { title: string; intro: string; sections: LegalSection[] } = {
  title: "Conditions d’utilisation",
  intro:
    "Les présentes conditions encadrent l’utilisation de BKG Rewards (site Web et application Android). En utilisant le service, vous acceptez ces conditions.",
  sections: [
    {
      title: "1. Objet du service",
      paragraphs: [
        "BKG Rewards est un programme de fidélité permettant de cumuler des points en réalisant des actions (ex. visionnage de publicités, offres partenaires) et de participer à des tirages au sort selon les règles applicables.",
        "Les points n’ont aucune valeur monétaire, ne sont pas convertibles en argent et peuvent être ajustés en cas de fraude ou d’erreur manifeste.",
      ],
    },
    {
      title: "2. Conditions d’accès",
      paragraphs: [
        "L’accès peut nécessiter la création d’un compte.",
        "Vous vous engagez à fournir des informations exactes et à ne pas usurper l’identité d’un tiers.",
      ],
    },
    {
      title: "3. Règles de participation et anti-fraude",
      paragraphs: [
        "Toute tentative d’automatisation (bots), de manipulation, ou d’abus des mécaniques de points est interdite.",
        "En cas de suspicion de fraude, nous pouvons suspendre le compte, annuler des points, ou exclure un utilisateur des tirages, le temps de la vérification.",
      ],
    },
    {
      title: "4. Tirages au sort et lots",
      paragraphs: [
        "Les modalités de participation, de sélection et d’annonce des gagnants sont décrites dans le règlement. Des délais techniques peuvent s’appliquer.",
        "Les gagnants peuvent être contactés par e-mail et disposer d’un délai de réponse. À défaut, le lot peut être remis en jeu.",
      ],
    },
    {
      title: "5. Abonnements (si applicable)",
      paragraphs: [
        "Sur le Web, des abonnements peuvent être proposés via Stripe. Sur Android, des abonnements peuvent être proposés via Google Play.",
        "La gestion (annulation, facturation, renouvellement) dépend de la plateforme d’achat.",
      ],
    },
    {
      title: "6. Responsabilité",
      paragraphs: [
        "Apple et Google ne sont pas impliqués dans l’organisation des tirages.",
        "Nous faisons notre possible pour assurer la disponibilité du service mais ne garantissons pas une absence totale d’interruption.",
      ],
    },
    {
      title: "7. Modifications",
      paragraphs: ["Nous pouvons mettre à jour ces conditions. La version applicable est celle publiée au moment de l’utilisation."],
    },
  ],
}

