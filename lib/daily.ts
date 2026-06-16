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
  const dayIndex = Math.floor(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000,
  );
  return MOTS_DU_JOUR[((dayIndex % MOTS_DU_JOUR.length) + MOTS_DU_JOUR.length) % MOTS_DU_JOUR.length];
}
