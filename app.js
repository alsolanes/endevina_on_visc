const MAX_GUESSES_BY_ROUND = [6, 8, 10];
const ROUND_WORDS = ["avet", "golafres", "treballador"];
const FINAL_ORDER_WORDS = ["avet", "treballador", "golafres"];
const FALLBACK_DICTIONARY_URL =
  "https://raw.githubusercontent.com/wooorm/dictionaries/main/dictionaries/ca/index.dic";

const state = {
  round: 0,
  guesses: [],
  current: "",
  keyboard: {},
  results: [],
  history: [],
  solved: [],
  done: false,
  dictionary: new Set(),
  acceptAnyGuess: false,
  funIndex: 0,
  invalidStreak: 0,
  dictionaryLoaded: false,
  resetAfterInvalid: false,
  overlayActive: false,
};

const board = document.getElementById("board");
const message = document.getElementById("message");
const roundCounter = document.getElementById("round");
const roundTotal = document.getElementById("round-total");
const keyboard = document.getElementById("keyboard");
const shareButton = document.getElementById("share");
const resetButton = document.getElementById("reset");
const toggleDictButton = document.getElementById("toggle-dict");
const gamePanel = document.getElementById("game");
const finalPanel = document.getElementById("final");
const footer = document.getElementById("footer");
const finalTitle = document.getElementById("final-title");
const finalMessage = document.getElementById("final-message");
const finalLink = document.getElementById("final-link");
const finalRestart = document.getElementById("final-restart");
const roundOverlay = document.getElementById("round-overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayMessage = document.getElementById("overlay-message");
const overlayClose = document.getElementById("overlay-close");
const scrollHint = document.getElementById("scroll-hint");

roundTotal.textContent = ROUND_WORDS.length;

const KEY_ROWS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["DEL", "z", "x", "c", "v", "b", "n", "m", "ENT"],
];

const FUN_MESSAGES = [
  "Nasti, deixa el vi que aquesta paraula no existeix!",
  "Nasti, aquesta paraula s'ho ha inventat algu amb molta imaginacio.",
  "Nasti, avui la RAE plora... i el diccionari tambe.",
  "Nasti, aixo no es una paraula catalana ni per casualitat.",
  "Nasti, aquesta paraula necessita un DNI per entrar al diccionari.",
];

const ROUND_MESSAGES = [
  "Genial, Nasti! Ronda superada.",
  "Uau! Aixo ha estat perfecte.",
  "Brillant! Vas molt forta.",
  "Ho has clavat! Seguim.",
  "Fantastic! A per la seguent.",
];

function currentWord() {
  return ROUND_WORDS[state.round];
}

function currentLength() {
  return currentWord().length;
}

function maxGuesses() {
  return MAX_GUESSES_BY_ROUND[state.round] ?? MAX_GUESSES_BY_ROUND[0];
}

function roundHint() {
  if (state.round === 1) {
    return "Nivell mitja. Si et costa, pots desactivar la validacio per provar lletres.";
  }
  if (state.round === 2) {
    return "Nivell super dificil. Si et costa, pots desactivar la validacio per provar lletres.";
  }
  return "Comencem! Si et costa, pots desactivar la validacio per provar lletres.";
}

function showRoundOverlay() {
  const messageText =
    ROUND_MESSAGES[state.round % ROUND_MESSAGES.length] || "Molt be!";
  overlayTitle.textContent = "Molt be!";
  overlayMessage.innerHTML = `${messageText} Paraula: <strong>${currentWord().toUpperCase()}</strong>.`;
  roundOverlay.classList.remove("hidden");
  state.overlayActive = true;
}

function hideRoundOverlay() {
  roundOverlay.classList.add("hidden");
  state.overlayActive = false;
}

async function loadDictionary() {
  const sources = [
    { url: "words-ca.txt", type: "plain" },
    { url: FALLBACK_DICTIONARY_URL, type: "hunspell" },
  ];

  for (const source of sources) {
    try {
      const response = await fetch(source.url, { cache: "no-store" });
      if (!response.ok) {
        continue;
      }
      const text = await response.text();
      const lines = text.split(/\r?\n/);
      const startIndex = source.type === "hunspell" ? 1 : 0;
      for (let i = startIndex; i < lines.length; i += 1) {
        const raw = lines[i].trim();
        if (!raw) {
          continue;
        }
        const word = raw.split("/")[0].toLowerCase();
        if (/^[a-zç]+$/.test(word)) {
          state.dictionary.add(word);
        }
      }
      if (state.dictionary.size > 0) {
        state.dictionaryLoaded = true;
        state.acceptAnyGuess = false;
        return;
      }
    } catch (error) {
      // Try next source.
    }
  }

  state.dictionaryLoaded = false;
  state.acceptAnyGuess = true;
  setMessage(
    "No he pogut carregar el diccionari. Activat el mode que accepta qualsevol paraula."
  );
}

function setupKeyboard() {
  keyboard.innerHTML = "";
  KEY_ROWS.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "key-row";
    row.forEach((key) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "key";
      button.textContent = key;
      button.dataset.key = key;
      button.addEventListener("click", () => handleKey(key));
      rowEl.appendChild(button);
    });
    keyboard.appendChild(rowEl);
  });
}

function resetKeyboardStyles() {
  document.querySelectorAll(".key").forEach((button) => {
    button.classList.remove("correct", "present", "absent");
  });
}

function setupBoard() {
  board.innerHTML = "";
  const length = currentLength();
  for (let i = 0; i < maxGuesses(); i += 1) {
    const row = document.createElement("div");
    row.className = "row";
    row.style.setProperty("--word-length", length);
    if (length > 7) {
      row.classList.add("long");
    }
    for (let j = 0; j < length; j += 1) {
      const tile = document.createElement("div");
      tile.className = "tile";
      row.appendChild(tile);
    }
    board.appendChild(row);
  }
}

function setMessage(text = "") {
  message.textContent = text;
}

function startRound() {
  state.guesses = [];
  state.current = "";
  state.keyboard = {};
  state.results = [];
  state.done = false;
  roundCounter.textContent = state.round + 1;
  setMessage(roundHint());
  showGame();
  setupBoard();
  resetKeyboardStyles();
  updateKeyboard();
  render();
}

function resetGame() {
  state.round = 0;
  state.history = [];
  state.solved = [];
  state.invalidStreak = 0;
  hideRoundOverlay();
  startRound();
}

function applyGuess(word) {
  const target = currentWord();
  const result = [];
  const targetLetters = target.split("");
  const guessLetters = word.split("");

  guessLetters.forEach((letter, index) => {
    if (letter === targetLetters[index]) {
      result[index] = "correct";
      targetLetters[index] = null;
    }
  });

  guessLetters.forEach((letter, index) => {
    if (result[index]) {
      return;
    }
    const foundIndex = targetLetters.indexOf(letter);
    if (foundIndex >= 0) {
      result[index] = "present";
      targetLetters[foundIndex] = null;
    } else {
      result[index] = "absent";
    }
  });

  return result;
}

function updateKeyboard() {
  document.querySelectorAll(".key").forEach((button) => {
    const key = button.dataset.key;
    if (state.keyboard[key]) {
      button.classList.add(state.keyboard[key]);
    }
  });
}

function render() {
  const rows = Array.from(board.children);
  rows.forEach((row, rowIndex) => {
    const tiles = Array.from(row.children);
    const guess =
      state.guesses[rowIndex] ||
      (rowIndex === state.guesses.length ? state.current : "");
    const letters = guess.split("");
    tiles.forEach((tile, index) => {
      const letter = letters[index] || "";
      tile.textContent = letter.toUpperCase();
      tile.className = "tile";
      if (letter) {
        tile.classList.add("filled");
      }
      if (state.results && state.results[rowIndex]) {
        tile.classList.add(state.results[rowIndex][index]);
      }
    });
  });
}

function isValidWord(word) {
  if (state.acceptAnyGuess) {
    return true;
  }
  if (state.dictionary.has(word)) {
    return true;
  }
  return ROUND_WORDS.includes(word);
}

function getNextFunMessage() {
  const messageText = FUN_MESSAGES[state.funIndex % FUN_MESSAGES.length];
  state.funIndex += 1;
  return messageText;
}

function flashInvalidRow() {
  const rowIndex = state.guesses.length;
  const row = board.children[rowIndex];
  if (!row) {
    return;
  }
  row.classList.add("invalid");
  setTimeout(() => {
    row.classList.remove("invalid");
  }, 380);
}

function resetInvalidInput() {
  if (!state.resetAfterInvalid) {
    return;
  }
  state.current = "";
  state.resetAfterInvalid = false;
  setMessage("");
  render();
}

function finalizeGuess() {
  const length = currentLength();
  if (state.current.length !== length) {
    setMessage("Falten lletres.");
    return;
  }
  if (!isValidWord(state.current)) {
    state.invalidStreak += 1;
    const tip =
      state.invalidStreak >= 3
        ? "Si es massa dificil, pots activar el mode que accepta qualsevol paraula."
        : "";
    const messageText = getNextFunMessage();
    setMessage(tip ? `${messageText} ${tip}` : messageText);
    flashInvalidRow();
    state.resetAfterInvalid = true;
    return;
  }
  state.invalidStreak = 0;
  state.resetAfterInvalid = false;
  const outcome = applyGuess(state.current);
  state.results.push(outcome);
  state.guesses.push(state.current);
  outcome.forEach((status, idx) => {
    const letter = state.current[idx];
    const existing = state.keyboard[letter];
    if (existing === "correct") {
      return;
    }
    if (existing === "present" && status === "absent") {
      return;
    }
    state.keyboard[letter] = status;
  });
  updateKeyboard();
  render();

  if (state.current === currentWord()) {
    setMessage("Ronda superada!");
    state.done = true;
    state.solved[state.round] = true;
    state.history[state.round] = [...state.results];
    moveToNextRound(true);
    return;
  }

  if (state.guesses.length >= maxGuesses()) {
    setMessage(`No era '${currentWord().toUpperCase()}'.`);
    state.done = true;
    state.solved[state.round] = false;
    state.history[state.round] = [...state.results];
    moveToNextRound(false);
    return;
  }

  state.current = "";
  render();
}

function moveToNextRound(passed) {
  const delay = 900;
  if (passed) {
    showRoundOverlay();
  }
  setTimeout(() => {
    state.round += 1;
    if (state.round >= ROUND_WORDS.length) {
      hideRoundOverlay();
      state.done = true;
      if (state.solved.every(Boolean)) {
        finalTitle.textContent = "Ho has encertat!";
        const finalWords = FINAL_ORDER_WORDS.map(
          (word) => `<strong>${word}</strong>`
        ).join(", ");
        finalMessage.innerHTML =
          `Has completat les tres rondes. Escriu aquestes tres paraules en aquest ordre: ${finalWords}. Hi ha una pagina per internet on, si hi poses aquestes tres paraules, trobaras una ubicacio.`;
        finalLink.classList.remove("hidden");
        showFinal();
      } else {
        finalTitle.textContent = "No ha pogut ser...";
        finalMessage.textContent =
          "Has acabat les tres rondes, pero no les has encertat totes. Pots tornar a comencar i intentar-ho de nou.";
        finalLink.classList.add("hidden");
        showFinal();
      }
      return;
    }
    startRound();
  }, delay);
}

function handleKey(key) {
  if (state.done || state.overlayActive) {
    return;
  }
  resetInvalidInput();
  if (key === "ENT") {
    finalizeGuess();
    return;
  }
  if (key === "DEL") {
    state.current = state.current.slice(0, -1);
    setMessage("");
    render();
    return;
  }
  if (state.current.length >= currentLength()) {
    return;
  }
  state.current += key;
  setMessage("");
  render();
}

function handlePhysicalKey(event) {
  if (state.done || state.overlayActive) {
    return;
  }
  resetInvalidInput();
  if (event.key === "Enter") {
    handleKey("ENT");
    return;
  }
  if (event.key === "Backspace") {
    handleKey("DEL");
    return;
  }
  const letter = event.key.toLowerCase();
  if (/^[a-zç]$/.test(letter)) {
    handleKey(letter);
  }
}

function buildShareText() {
  const allResults = [...state.history];
  if (state.results.length) {
    allResults[state.round] = [...state.results];
  }
  const rows = allResults
    .flat()
    .map((result) =>
      result
        .map((status) => {
          if (status === "correct") return "🟩";
          if (status === "present") return "🟨";
          return "⬜";
        })
        .join("")
    );
  return `Endevina on visc\n${rows.join("\n")}`;
}

function showFinal() {
  gamePanel.classList.add("hidden");
  finalPanel.classList.remove("hidden");
  footer.classList.add("hidden");
  hideRoundOverlay();
}

function showGame() {
  gamePanel.classList.remove("hidden");
  finalPanel.classList.add("hidden");
  footer.classList.remove("hidden");
}

function updateDictionaryToggle() {
  toggleDictButton.classList.add("toggle");
  toggleDictButton.classList.toggle("active", !state.acceptAnyGuess);
  toggleDictButton.classList.toggle("inactive", state.acceptAnyGuess);
  toggleDictButton.setAttribute("aria-pressed", String(state.acceptAnyGuess));
  toggleDictButton.textContent = state.acceptAnyGuess
    ? "Validacio: desactivada"
    : "Validacio: activada";
}

shareButton.addEventListener("click", async () => {
  const text = buildShareText();
  try {
    await navigator.clipboard.writeText(text);
    setMessage("Copiat al porta-retalls!");
  } catch (error) {
    setMessage("No he pogut copiar.");
  }
});

resetButton.addEventListener("click", () => {
  resetGame();
});

toggleDictButton.addEventListener("click", () => {
  state.acceptAnyGuess = !state.acceptAnyGuess;
  updateDictionaryToggle();
  setMessage(
    state.acceptAnyGuess
      ? "Ara s'accepta qualsevol paraula."
      : "Ara es valida amb el diccionari."
  );
});

finalRestart.addEventListener("click", () => {
  resetGame();
});

overlayClose.addEventListener("click", () => {
  hideRoundOverlay();
});

scrollHint.addEventListener("click", () => {
  footer.scrollIntoView({ behavior: "smooth", block: "start" });
});

window.addEventListener("keydown", handlePhysicalKey);

setupKeyboard();
setMessage("Carregant diccionari...");
loadDictionary().then(() => {
  updateDictionaryToggle();
  if (state.dictionaryLoaded) {
    setMessage("");
  }
  resetGame();
  render();
});
