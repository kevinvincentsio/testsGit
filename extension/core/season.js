// Produits de saison en France, par mois (1 = janvier … 12 = décembre).
// Sert deux buts : donner au cerveau IA un ancrage saisonnier fiable, et
// permettre un fonctionnement dégradé (sans IA) qui privilégie le de-saison.

const FRUITS = {
  1: ["pomme", "poire", "kiwi", "orange", "clémentine", "mandarine", "citron"],
  2: ["pomme", "poire", "kiwi", "orange", "clémentine", "citron"],
  3: ["pomme", "poire", "kiwi", "orange", "citron"],
  4: ["pomme", "poire", "kiwi", "rhubarbe", "fraise"],
  5: ["fraise", "cerise", "rhubarbe", "pomme"],
  6: ["fraise", "cerise", "abricot", "melon", "framboise", "groseille"],
  7: ["abricot", "pêche", "nectarine", "melon", "pastèque", "cerise", "framboise", "prune"],
  8: ["pêche", "nectarine", "melon", "pastèque", "prune", "figue", "mirabelle", "raisin"],
  9: ["raisin", "figue", "prune", "pomme", "poire", "noisette", "mûre"],
  10: ["pomme", "poire", "raisin", "coing", "châtaigne", "noix", "kaki"],
  11: ["pomme", "poire", "kiwi", "clémentine", "orange", "châtaigne", "kaki"],
  12: ["pomme", "poire", "kiwi", "clémentine", "orange", "mandarine"],
};

const LEGUMES = {
  1: ["poireau", "carotte", "chou", "endive", "courge", "potiron", "navet", "épinard", "mâche"],
  2: ["poireau", "carotte", "chou", "endive", "topinambour", "navet", "épinard", "mâche"],
  3: ["poireau", "carotte", "chou", "endive", "épinard", "radis", "betterave"],
  4: ["asperge", "radis", "épinard", "carotte", "navet", "petit pois", "blette"],
  5: ["asperge", "radis", "petit pois", "courgette", "épinard", "artichaut", "navet"],
  6: ["courgette", "concombre", "tomate", "haricot vert", "aubergine", "petit pois", "poivron", "artichaut"],
  7: ["tomate", "courgette", "aubergine", "poivron", "concombre", "haricot vert", "maïs"],
  8: ["tomate", "courgette", "aubergine", "poivron", "concombre", "haricot vert", "maïs", "fenouil"],
  9: ["tomate", "courgette", "poivron", "brocoli", "chou-fleur", "épinard", "poireau", "potiron"],
  10: ["potiron", "courge", "poireau", "chou-fleur", "brocoli", "carotte", "épinard", "champignon"],
  11: ["potiron", "courge", "poireau", "chou", "carotte", "endive", "navet", "champignon", "mâche"],
  12: ["poireau", "carotte", "chou", "endive", "courge", "potiron", "navet", "mâche", "salsifis"],
};

export function seasonalFor(month = new Date().getMonth() + 1) {
  return {
    month,
    fruits: FRUITS[month] || [],
    legumes: LEGUMES[month] || [],
  };
}
