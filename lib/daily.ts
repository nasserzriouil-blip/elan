// Les "mots du jour" : une punchline qui tourne chaque jour. Curatées à la main
// pour rester fidèles à la philosophie d'Élan — positives, ancrées dans
// l'identité et le plaisir, jamais dans la peur, la performance ou le poids.

export const MOTS_DU_JOUR: string[] = [
  "Tu n'as rien à rattraper. Tu construis, c'est tout.",
  "Bouger aujourd'hui, ce n'est pas effacer hier. C'est honorer qui tu deviens.",
  "Le durable bat le rapide. Toujours.",
  "Une bière n'efface pas trois mois. Garde le cap, pas le score.",
  "Tu n'es pas quelqu'un qui essaie de maigrir. Tu es quelqu'un qui prend soin de lui.",
  "L'envie est une vague : elle monte fort, puis elle redescend. Laisse-la passer.",
  "Le plus petit pas compte plus que le plus grand projet.",
  "Tu n'as pas à mériter ton corps par la souffrance.",
  "Aujourd'hui, choisis une chose qui te fait du bien. Une seule suffit.",
  "Ce n'est pas la discipline qui dure, c'est le plaisir.",
  "Remplacer, pas se priver. Ajouter du bon avant d'enlever.",
  "Ton rythme est le bon rythme. Pas celui des autres.",
  "La fierté d'avoir bougé dure plus longtemps que le confort de ne rien faire.",
  "Tu n'es pas en retard sur ta vie. Tu es exactement où tu commences.",
  "Prendre soin de toi, c'est un acte de respect, pas une punition.",
  "Un soir sans, ce n'est pas un échec. C'est juste un soir.",
  "Le corps suit. Commence par le sens.",
  "Tu fais ça pour la vie que tu veux vivre, pas pour un chiffre.",
  "La régularité douce gagne contre l'intensité qui crame.",
  "Sois l'ami de ton corps, pas son juge.",
  "Chaque fois que tu surfes l'envie, ton cerveau réapprend. C'est ça, le vrai progrès.",
  "Tu ne te construis pas en te punissant. Tu te construis en t'écoutant.",
  "Le mouvement, c'est un cadeau que tu te fais, pas une facture que tu paies.",
  "Aujourd'hui n'a pas besoin d'être parfait. Juste vivant.",
  "Ce qui compte, ce n'est pas de ne jamais tomber. C'est de te relever sans te taper dessus.",
  "Bois un verre d'eau, sors deux minutes. Le reste suivra.",
  "Tu n'es pas seul sur ce chemin. Même quand c'est la fin de journée et que c'est calme.",
  "La version de toi que tu vises, elle se construit dans les petits gestes d'aujourd'hui.",
  "Pas d'objectif chiffré. Juste : qu'est-ce qui te ferait du bien, là ?",
  "Le plus dur, tu l'as déjà fait : tu as recommencé à t'en occuper.",
];

// Mot du jour déterministe : même phrase toute la journée, change chaque jour.
export function motDuJour(d: Date = new Date()): string {
  return pick(MOTS_DU_JOUR, d);
}

// L'aliment du jour : un aliment bénéfique + une recette simple et protéinée.
export interface Aliment {
  nom: string;
  benefice: string;
  recette: string;
  etapes: string[];
}

export const ALIMENTS: Aliment[] = [
  {
    nom: "Les œufs",
    benefice: "Protéines complètes, rassasiantes, riches en choline pour le cerveau.",
    recette: "Omelette aux épinards",
    etapes: [
      "Bats 3 œufs avec sel et poivre.",
      "Fais fondre une poignée d'épinards à la poêle 1 min.",
      "Verse les œufs, plie l'omelette à mi-cuisson. Prêt en 5 min.",
    ],
  },
  {
    nom: "Les lentilles",
    benefice: "Protéines végétales + fibres : énergie longue durée, digestion au top.",
    recette: "Dahl express",
    etapes: [
      "Fais revenir oignon, ail, curcuma et cumin.",
      "Ajoute 150 g de lentilles corail et 40 cl d'eau.",
      "Laisse mijoter 15 min, sers avec un peu de yaourt.",
    ],
  },
  {
    nom: "Le saumon",
    benefice: "Oméga-3 pour le cœur et l'humeur, protéines de qualité.",
    recette: "Saumon poêlé au citron",
    etapes: [
      "Sale le pavé côté peau.",
      "Poêle 4 min côté peau, 2 min de l'autre.",
      "Arrose de jus de citron. Sers avec des légumes verts.",
    ],
  },
  {
    nom: "Le yaourt grec",
    benefice: "Très protéiné, riche en probiotiques pour l'intestin.",
    recette: "Bowl protéiné",
    etapes: [
      "Mets 200 g de yaourt grec dans un bol.",
      "Ajoute une poignée de noix et quelques fruits rouges.",
      "Un filet de miel si tu veux. C'est prêt.",
    ],
  },
  {
    nom: "Les pois chiches",
    benefice: "Protéines + fibres, index glycémique bas : satiété durable.",
    recette: "Pois chiches rôtis épicés",
    etapes: [
      "Égoutte une boîte de pois chiches, sèche-les bien.",
      "Mélange avec huile d'olive, paprika, cumin, sel.",
      "Four à 200 °C, 25 min. Croustillant et nourrissant.",
    ],
  },
  {
    nom: "Le poulet",
    benefice: "Protéine maigre par excellence, parfaite pour le muscle.",
    recette: "Poulet mariné yaourt-curcuma",
    etapes: [
      "Marine les aiguillettes 15 min dans yaourt + curcuma + ail.",
      "Poêle 6-8 min à feu vif.",
      "Sers avec une salade ou du riz complet.",
    ],
  },
  {
    nom: "Le thon",
    benefice: "Protéine pure, pratique, riche en sélénium.",
    recette: "Salade thon-haricots blancs",
    etapes: [
      "Égoutte une boîte de thon et une de haricots blancs.",
      "Ajoute oignon rouge, persil, huile d'olive, citron.",
      "Mélange. Complet et prêt en 3 min.",
    ],
  },
  {
    nom: "Le tofu",
    benefice: "Protéine végétale complète, faible en calories.",
    recette: "Tofu sauté au sésame",
    etapes: [
      "Coupe le tofu ferme en dés, dore-les à la poêle.",
      "Ajoute sauce soja, ail et graines de sésame.",
      "Sers avec des légumes croquants.",
    ],
  },
  {
    nom: "Le quinoa",
    benefice: "Céréale à protéines complètes, sans gluten, riche en fer.",
    recette: "Bowl quinoa-avocat-œuf",
    etapes: [
      "Cuis 80 g de quinoa 12 min.",
      "Ajoute un demi-avocat et un œuf mollet.",
      "Assaisonne citron-huile d'olive.",
    ],
  },
  {
    nom: "Les sardines",
    benefice: "Oméga-3 et calcium, économiques et anti-inflammatoires.",
    recette: "Tartine sardines-citron",
    etapes: [
      "Écrase des sardines avec un peu de citron.",
      "Étale sur du pain complet grillé.",
      "Poivre et un peu de persil. Express.",
    ],
  },
  {
    nom: "Le fromage blanc",
    benefice: "Riche en protéines et en calcium, très rassasiant.",
    recette: "Fromage blanc, avoine et fruits",
    etapes: [
      "Mélange 200 g de fromage blanc avec 3 c. à soupe de flocons d'avoine.",
      "Ajoute des fruits coupés.",
      "Une pincée de cannelle. Petit-déj parfait.",
    ],
  },
  {
    nom: "Les edamames",
    benefice: "Fèves de soja jeunes : protéines végétales et fibres.",
    recette: "Edamames vapeur",
    etapes: [
      "Fais cuire les edamames 5 min à la vapeur.",
      "Sale légèrement.",
      "Presse les cosses pour manger les fèves. Snack idéal.",
    ],
  },
  {
    nom: "Le skyr",
    benefice: "Laitage islandais ultra-protéiné, presque sans gras.",
    recette: "Skyr aux myrtilles",
    etapes: [
      "Mets du skyr dans un bol.",
      "Ajoute des myrtilles et quelques amandes.",
      "Un peu de miel si besoin. 2 minutes.",
    ],
  },
  {
    nom: "Les haricots rouges",
    benefice: "Protéines, fibres et fer : énergie stable et satiété.",
    recette: "Chili végétarien express",
    etapes: [
      "Fais revenir oignon, ail, poivron.",
      "Ajoute haricots rouges, tomates concassées, cumin, paprika.",
      "Mijote 15 min. Réconfortant et complet.",
    ],
  },
];

// Aliment du jour déterministe : change chaque jour.
export function alimentDuJour(d: Date = new Date()): Aliment {
  return pick(ALIMENTS, d);
}

function pick<T>(arr: T[], d: Date): T {
  const dayIndex = Math.floor(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000,
  );
  return arr[((dayIndex % arr.length) + arr.length) % arr.length];
}
