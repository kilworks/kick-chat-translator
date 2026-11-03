# Roadmap, kick-chat-translator

Ecrit le 2026-09-24, apres la branche `feat/lang-matrix`. Rien ici n'est
execute : c'est une proposition a trancher.

Les chiffres sont mesures et traçables aux bancs du depot. Les priorites sont un
jugement, pas un fait, et elles sont signalees comme tel.

---

## Ou en est le produit, en cinq lignes

```
detection, langue source envoyee au moteur   3731 justes / 3 fausses sur 5040
                                             (depart de branche : 1262 / 90)
langues offertes                             43, cantonais compris
chat jamais vu                               57 % des lignes nommees
portes hors ligne                            38 sur 38 vertes
publie sur le store                          2.9.2, soit trois versions de retard
```

---

## 1. Maintenant : publier, parce que rien ne sert le lecteur tant que c'est local

**Le fait.** Le store est sur 2.9.2. 2.9.3, 2.9.4 et 2.10.0 ont ete taguees et
jamais publiees. 2.11.0 est prete, testee, empaquetee.

**Le jugement.** C'est le seul point de cette liste ou tout le travail est deja
fait et ou la valeur est a zero jusqu'au clic. Tout le reste peut attendre.

- Publier 2.11.0 sur le Chrome Web Store et sur AMO.
- Pousser les dix descriptions localisees dans `public/_locales`, sinon neuf
  lecteurs sur dix lisent la fiche en anglais. Les textes sont dans
  `release/NOUVEAUTES.md`.
- **Comment on saura que c'est fait** : la fiche affiche 2.11.0 et la version
  installee se met a jour toute seule chez les lecteurs actuels.

**Cout** : une heure, dont la moitie d'attente de revue.

---

## 2. Le goulot est le CORPUS, plus les regles

**Le fait, mesure.** Le crible en mode `chat` a tourne sur les cinq langues les
plus muettes qui restaient, en mots, en sequences et en fins de mot. Il rend
**zero candidat propre**. La seule vraie regle trouvee, `cuá` contre le catalan
`quant`, ne bouge que les deux corpus qui l'ont proposee.

```
lignes de chat encore muettes, sur 25 par langue
  da 20   en 16   no 16   sk 15   ca 14   sl 14   es 13   it 13   id 13   ms 13
```

**Pourquoi ca ne se corrige pas avec du code.** Leurs lignes muettes portent des
mots qui n'apparaissent **qu'une fois**. Un crible ne peut pas proposer ce qui ne
se repete pas, et ecrire une regle par ligne est l'apprentissage par coeur que
toute la branche refuse. `da` en est la demonstration : sept entrees ecrites en
lisant ses lignes, sept refusees par l'ablation, cinq ne bougeaient que le
corpus qui les avait ecrites.

**Ce qu'il faut.** Du chat reel, recolte, par langue.
`test/e2e/kick-chat-collector.js` existe deja et a servi pour les
corpus actuels.

- Cibler les langues les plus muettes, pas les plus faciles : da, no, sk, ca,
  sl, it, ms, id.
- **200 lignes par langue** plutot que 25. C'est l'ordre de grandeur qui a fait
  passer le banc clavier de "zero erreur" a "trente erreurs" : un banc trop
  petit ne rend pas zero, il rend une conclusion fausse.
- **Ecrire le corpus AVANT de relire les tables.** C'est le seul point de cette
  roadmap qu'une session qui a deja lu `langDetect.ts` ne peut pas faire
  honnetement.

**Le point de dette a payer en meme temps.** Le corpus aveugle de la paire
malais/indonesien **n'est plus aveugle** : trois cribles lisaient ses lignes
pour proposer des candidats, corrige depuis, mais le 65 % qu'il affiche est en
partie la mesure de mots choisis en le lisant. Un troisieme corpus de paire,
ecrit d'abord et jamais relu, est ce qui rend ce chiffre a nouveau lisible.

**Comment on saura que c'est fait** : le rappel sur un corpus aveugle neuf
monte, ou il ne monte pas et on apprend que le probleme n'etait pas la.

---

## 3. Les portes ne tournent pas toutes seules, et ca coute

**Le fait.** Les 38 portes hors ligne se lancent a la main. Playwright n'est pas
une dependance du projet, donc sur un clone frais **aucune ne tourne**.
Consequences constatees cette semaine :

- `flags-preview` etait rouge **depuis qu'elle existe**, elle lisait un fichier
  que le depot ne contient pas.
- Le cantonais a ete livre **sans son drapeau**. La seule chose qui le voyait
  etait `bar-panel-live`, qui ecrivait "1 of 39 language rows draw no flag" dans
  un journal que personne ne relit entre deux versions.
- `lang-panel-measure` ouvre une page que seule `lang-panel-shoot` fabrique et
  que le depot ne porte pas.

**Le jugement.** Une porte qui existe et ne tourne pas est pire qu'une porte
absente : elle donne l'impression d'une couverture. Deux options, et la premiere
est moins chere qu'elle n'en a l'air.

- **a.** Un job CI dedie, `npm ci && npx playwright install chromium`, qui lance
  `run-gates.mjs --headless` sur les PR touchant `src/`. Coute quelques minutes
  de CI par PR et ferme la classe entiere.
- **b.** A defaut, une porte qui verifie que chaque porte de la liste trouve ses
  entrees, sans ouvrir de navigateur. Moins bien, presque gratuit.

**Comment on saura que c'est fait** : casser une regle CSS a la main fait rougir
la CI, pas un journal.

---

## 4. Le moteur embarque, deux decisions a rouvrir avec les chiffres d'aujourd'hui

Ce sont deux points de la section 10 du handoff, et les deux reposaient sur des
mesures qui ont bouge.

**`zh-tw` est envoye au moteur embarque comme `zh`.** `localEngine.norm()`
coupe le code au tiret, donc le chinois traditionnel demande une traduction
depuis le simplifie. Le detecteur les separe correctement depuis cette branche,
105 lignes sur 120 : la distinction se perd au dernier metre. **Pas verifie** si
l'API `Translator` de Chrome accepte `zh-Hant` ; c'est la premiere chose a
mesurer.

> **Fait le 2026-10-09.** La liste publiee par Chrome pour l'API `Translator`
> nomme `zh-Hant` a cote de `zh`. `localEngine` envoie desormais `zh-Hant` pour
> `zh-tw`, dans les deux sens, et ne retombe pas sur `zh` si un navigateur le dit
> indisponible : le nuage repond alors en traditionnel. Le meme passage rend les
> paires a telecharger dans les codes de l'appelant, sans quoi le bandeau, qui
> compare `p.tgt` a la langue choisie, ne proposait jamais le modele a un lecteur
> `zh-tw` ni `pt-br`. Pas mesure sur un vrai Chrome avec modele.

**`ignoreEnglish`.** La decision de ne pas basculer le moteur embarque sur la
reponse sure reposait sur un taux de silence qui a change d'un facteur
trente-huit. Le handoff pose lui-meme la condition de reouverture : quand le
corpus aveugle passe sous la moitie de silence. **Il y est** : 57 % de lignes
nommees, donc 43 % de silence.

---

## 5. Ce qui n'est pas mesure du tout : la traduction elle-meme

**Le fait.** Tout ce depot mesure la DETECTION. Cinq mille lignes de bancs, dix
portes, trois issues comptees separement. La traduction, qui est le produit, n'a
aucun banc : on sait qu'une ligne part au bon moteur avec la bonne langue
source, on ne sait pas ce qui revient.

**Le jugement.** C'est le plus gros angle mort du projet, et c'est aussi le plus
dur a mesurer sans jugement humain. Une premiere marche honnete et pas chere :

- Un banc de **rappel de chaine** : pour N lignes et M paires de langues, est-ce
  qu'une traduction revient, en combien de temps, et depuis quel fournisseur.
  Ca ne juge pas la qualite, ca mesure la disponibilite, et ca se teste hors
  ligne comme `translate-offline` le fait deja.
- La qualite proprement dite demande des lecteurs natifs. A ne lancer que si le
  produit grandit assez pour le meriter.

---

## 6. Les paris, par ordre de risque

Rien ici n'est recommande. Ce sont les pistes identifiees et jamais tentees.

**`tinyld.light` a la place de franc.** Les donnees de franc pesent 98 Ko dans
le bundle injecte, `tinyld.light.browser` en pese 68, licence MIT. Trente
kilo-octets rendus, treize pour cent du bundle, **si** l'experience de justesse
tourne en sa faveur. Elle a tourne le 2026-10-16 sur `langMatrix.test.ts`
(5040 lignes Tatoeba) et l'a ecarte : justes 4154 a 4291, mais faux 498 a 739,
et une reponse fausse est celle qui supprime une ligne. Pari ferme, detail dans
`docs/HANDOFF.md`, tableau des impasses.

**`pt-br` contre `pt`.** Question ouverte depuis le debut, jamais tranchee avec
toi. Distinction lexicale fine, aucun corpus separe chez Tatoeba. La proposition
par defaut du handoff est de ne pas ecrire de regle et de documenter que la
detection rend `pt`.

**Les blocs de confusion qui restent.** Ils sont tous structurels, pas
techniques :

```
id -> ms  44   ms -> id  28   le registre qui les separe n'est pas dans Tatoeba
no -> sv  26   da -> sv  22   le tri interieur est epuise, mesure
da -> nl  20   ca -> es  17   sk -> cs  14
zh-tw -> zh 15   quinze lignes qui ne portent aucun marqueur des deux ecritures
```

---

## Ce qu'il ne faut PAS refaire

La liste complete est en section 7 du handoff, avec les chiffres. Les trois qui
coutent le plus cher a redecouvrir :

- **Nommer l'anglais.** Mesure deux fois. L'anglais est la langue avec laquelle
  tout le monde melange, et le banc des lignes melangees refuse chaque forme
  proposee.
- **Lever `SHORT_TEXT_MAX`.** Mesure trois fois, 30 vers 40 est une perte seche.
- **Un tour de lexique choisi a la main.** Mesure deux fois, et le taux observe
  sur toute la branche est **cinq mots qui transferent sur trente-quatre**.

Et la regle qui a coute un mot trois fois : **elargir un declencheur rend
retroactivement faux ce qui est derriere lui.** `hvem` et `hvor` etaient faux
dans le jeu norvegien depuis le premier jour et n'avaient rien coute tant que la
porte ne s'ouvrait pas sur les lignes ou ca se voit.

---

## Si je devais n'en garder qu'une

**Publier, puis recolter du chat.** Le premier point rend disponible un travail
deja fait et paye. Le second est le seul qui debloque les autres : tant que le
corpus de chat fait vingt-cinq lignes par langue, tout tour de regles mesure du
bruit, et la branche vient de passer une journee a l'etablir proprement plutot
qu'a le supposer.
