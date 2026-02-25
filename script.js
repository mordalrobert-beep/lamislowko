const MAX_ATTEMPTS = 6;
const LETTER_REGEX = /^[A-ZĄĆĘŁŃÓŚŹŻ]$/;
const WORD_REGEX = /^[A-ZĄĆĘŁŃÓŚŹŻ]+$/;
const BUNDLED_POLISH_DICTIONARY_KEY = "POLISH_DICTIONARY_WORDS_BY_LENGTH";
const POLISH_DICTIONARY_DIC_PATH = "dictionary/pl_PL.dic";
const POLISH_DICTIONARY_DECODER = "iso-8859-2";
const GAME_MODES = {
  NORMAL: "normal",
  FOREIGN: "foreign"
};

const DEFAULT_NORMAL_POOL = {
  4: [
    "WODA", "DOMY", "LASY", "KOTY", "RYBY", "PIES", "RANO", "LATO", "ZIMA",
    "KAWA", "MOST", "OKNO", "FALA", "MŁYN", "GÓRY", "RÓŻA", "ŁĄKA", "SOKI",
    "MURY", "MAMA", "TATA", "ŻABA", "KASA", "PŁOT", "ROWY"
  ],
  5: [
    "RADIA", "OCEAN", "KOTEK", "DOMEK", "KWIAT", "DROGA", "RZEKA", "PTAKI",
    "CHLEB", "MLEKO", "JABŁO", "OGRÓD", "ŁÓDKA", "PIŁKA", "NARTY", "WIATR",
    "ZEGAR", "SERCE", "KASZA", "OWOCE", "MOTYL", "RYNEK", "ULICA", "BRAMA"
  ],
  6: [
    "OCEANY", "SZKOŁA", "ROWERY", "WIOSNA", "JESIEŃ", "SŁOŃCE", "OGRODY",
    "KWIATY", "PŁATKI", "ZEGARY", "KLOCKI", "MOTYLE", "KOTLET", "TULIPA",
    "SPACER", "MIASTO", "JABŁKA", "PIERÓG", "KRAINA", "BRZEGI"
  ],
  7: [
    "WAKACJE", "PIEROGI", "KWIATKI", "ZEGARKI", "SZYBKIE", "OGRÓDKI",
    "ULICZKA", "KSIĄŻKI", "PODRÓŻE", "WARZYWA", "GÓRSKIE", "KOTLETY",
    "RADOSNY", "POLSKIE", "JABŁONIE", "MIASTKO", "DODATKI"
  ]
};

const KEYBOARD_MAIN_ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "BACKSPACE"],
  ["Z", "X", "C", "V", "B", "N", "M", "ENTER"]
];

const KEYBOARD_PL_ROW = ["Ą", "Ć", "Ę", "Ł", "Ń", "Ó", "Ś", "Ź", "Ż"];

const boardElement = document.getElementById("board");
const statusElement = document.getElementById("status");
const selectLengthElement = document.getElementById("word-length");
const newRoundButton = document.getElementById("new-round");
const keyboardMainElement = document.getElementById("keyboard-main");
const keyboardPlElement = document.getElementById("keyboard-pl");
const normalModeButton = document.getElementById("mode-normal");
const foreignModeButton = document.getElementById("mode-foreign");
const definitionElement = document.getElementById("definition");
const definitionWordElement = document.getElementById("definition-word");
const definitionTextElement = document.getElementById("definition-text");

const NORMAL_WORD_POOL = normalizeWordPool(window.NORMAL_WORD_POOL ?? DEFAULT_NORMAL_POOL);
const FOREIGN_DICTIONARY_SOURCE = normalizeForeignDictionaryData(window.FOREIGN_DICTIONARY_DATA);
const EMPTY_WORD_POOL = { 4: [], 5: [], 6: [], 7: [] };
const FOREIGN_WORD_POOL = FOREIGN_DICTIONARY_SOURCE?.pool ?? EMPTY_WORD_POOL;
const FOREIGN_DEFINITION_MAP = FOREIGN_DICTIONARY_SOURCE?.definitions ?? new Map();
const NORMAL_WORD_SET_BY_LENGTH = new Map(
  [4, 5, 6, 7].map((length) => [length, new Set(NORMAL_WORD_POOL[length])])
);
const FOREIGN_WORD_SET_BY_LENGTH = new Map(
  [4, 5, 6, 7].map((length) => [length, new Set(FOREIGN_WORD_POOL[length])])
);

let rowElements = [];
let tileElements = [];
const keyboardButtonByKey = new Map();
let localPolishDictionaryPromise = null;
let currentMode = GAME_MODES.NORMAL;
let gameState = createState(
  getSelectedWordLength(),
  chooseSecretWord(getSelectedWordLength(), currentMode),
  currentMode
);

init();

function init() {
  buildKeyboard();
  bindUiEvents();
  setModeButtonState();
  startNewRound();
}

function bindUiEvents() {
  selectLengthElement.addEventListener("change", () => {
    startNewRound();
  });

  newRoundButton.addEventListener("click", () => {
    startNewRound();
  });

  normalModeButton?.addEventListener("click", () => {
    switchMode(GAME_MODES.NORMAL);
  });

  foreignModeButton?.addEventListener("click", () => {
    switchMode(GAME_MODES.FOREIGN);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitCurrentRow();
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      handleKeyInput("BACKSPACE");
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveActiveCol(-1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveActiveCol(1);
      return;
    }

    if (event.key.length === 1) {
      const letter = event.key.toLocaleUpperCase("pl-PL");
      if (LETTER_REGEX.test(letter)) {
        event.preventDefault();
        handleKeyInput(letter);
      }
    }
  });
}

function normalizeWordPool(pool) {
  const normalized = { 4: [], 5: [], 6: [], 7: [] };
  const acceptedLengths = new Set([4, 5, 6, 7]);

  for (const [rawLength, rawWords] of Object.entries(pool ?? {})) {
    const length = Number(rawLength);
    if (!acceptedLengths.has(length) || !Array.isArray(rawWords)) {
      continue;
    }

    const seen = new Set();
    for (const rawWord of rawWords) {
      const word = String(rawWord ?? "").trim().toLocaleUpperCase("pl-PL");
      if (word.length !== length) {
        continue;
      }
      if (!WORD_REGEX.test(word)) {
        continue;
      }
      if (seen.has(word)) {
        continue;
      }
      seen.add(word);
      normalized[length].push(word);
    }
  }

  return normalized;
}

function normalizeForeignDictionaryData(source) {
  if (!source || typeof source !== "object") {
    return null;
  }

  const pool = normalizeWordPool(source.wordsByLength ?? {});
  const totalWords = pool[4].length + pool[5].length + pool[6].length + pool[7].length;
  if (totalWords === 0) {
    return null;
  }

  const poolSetByLength = new Map(
    [4, 5, 6, 7].map((length) => [length, new Set(pool[length])])
  );
  const definitions = new Map();
  const rawDefinitions = source.definitionsByWord ?? source.definitions ?? source.definitionByWord;

  if (rawDefinitions && typeof rawDefinitions === "object") {
    for (const [rawWord, rawDefinition] of Object.entries(rawDefinitions)) {
      const word = String(rawWord ?? "").trim().toLocaleUpperCase("pl-PL");
      const length = word.length;
      if (![4, 5, 6, 7].includes(length)) {
        continue;
      }
      if (!poolSetByLength.get(length)?.has(word)) {
        continue;
      }

      const definition =
        typeof rawDefinition === "string" && rawDefinition.trim()
          ? rawDefinition.trim()
          : "Brak definicji dla tego hasła.";
      definitions.set(word, definition);
    }
  }

  for (const length of [4, 5, 6, 7]) {
    for (const word of pool[length]) {
      if (!definitions.has(word)) {
        definitions.set(word, "Brak definicji dla tego hasła.");
      }
    }
  }

  return { pool, definitions };
}

function switchMode(nextMode) {
  if (nextMode !== GAME_MODES.NORMAL && nextMode !== GAME_MODES.FOREIGN) {
    return;
  }
  if (currentMode === nextMode) {
    return;
  }
  currentMode = nextMode;
  setModeButtonState();
  startNewRound();
}

function setModeButtonState() {
  normalModeButton?.classList.toggle("active", currentMode === GAME_MODES.NORMAL);
  foreignModeButton?.classList.toggle("active", currentMode === GAME_MODES.FOREIGN);
}

function getSelectedWordLength() {
  const value = Number(selectLengthElement.value);
  return [4, 5, 6, 7].includes(value) ? value : 5;
}

function getPoolForMode(mode, wordLength) {
  if (mode === GAME_MODES.FOREIGN) {
    return FOREIGN_WORD_POOL[wordLength] ?? [];
  }
  return NORMAL_WORD_POOL[wordLength] ?? [];
}

function chooseSecretWord(wordLength, mode) {
  const words = getPoolForMode(mode, wordLength);
  if (words.length === 0) {
    return "A".repeat(wordLength);
  }
  const randomIndex = Math.floor(Math.random() * words.length);
  return words[randomIndex];
}

function createState(wordLength, targetWord, mode) {
  return {
    wordLength,
    targetWord,
    mode,
    rowIndex: 0,
    activeCol: 0,
    board: Array.from({ length: MAX_ATTEMPTS }, () => Array(wordLength).fill("")),
    evaluations: Array.from({ length: MAX_ATTEMPTS }, () => null),
    keyboardState: new Map(),
    gameOver: false,
    locked: false
  };
}

function startNewRound() {
  const wordLength = getSelectedWordLength();
  const pool = getPoolForMode(currentMode, wordLength);
  const targetWord = chooseSecretWord(wordLength, currentMode);
  gameState = createState(wordLength, targetWord, currentMode);
  renderBoardForState();
  hideDefinition();

  if (pool.length === 0) {
    setStatus("Brak haseł dla tego trybu i długości.", true);
    return;
  }

  const modeLabel = currentMode === GAME_MODES.NORMAL ? "polskie słowa" : "wyrazy obce";
  setStatus(`Nowa gra (${modeLabel}): ${wordLength} liter, ${MAX_ATTEMPTS} prób.`, false);
}

function renderBoardForState() {
  boardElement.style.setProperty("--word-len", String(gameState.wordLength));
  createBoard();
  paintBoard();
  paintKeyboard();
}

function buildKeyboard() {
  keyboardMainElement.innerHTML = "";
  keyboardPlElement.innerHTML = "";
  keyboardButtonByKey.clear();

  for (const row of KEYBOARD_MAIN_ROWS) {
    const rowContainer = document.createElement("div");
    rowContainer.className = "key-row";

    for (const key of row) {
      rowContainer.appendChild(makeKeyButton(key));
    }

    keyboardMainElement.appendChild(rowContainer);
  }

  const polishRow = document.createElement("div");
  polishRow.className = "key-row";

  for (const key of KEYBOARD_PL_ROW) {
    polishRow.appendChild(makeKeyButton(key));
  }

  keyboardPlElement.appendChild(polishRow);
}

function makeKeyButton(key) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "key";
  button.dataset.key = key;

  if (key === "ENTER") {
    button.classList.add("special");
    button.textContent = "ENTER";
  } else if (key === "BACKSPACE") {
    button.classList.add("special");
    button.textContent = "⌫";
  } else {
    button.textContent = key;
  }

  button.addEventListener("click", () => {
    handleKeyInput(key);
  });

  keyboardButtonByKey.set(key, button);
  return button;
}

function createBoard() {
  boardElement.innerHTML = "";
  rowElements = [];
  tileElements = [];

  for (let row = 0; row < MAX_ATTEMPTS; row += 1) {
    const attemptRowElement = document.createElement("div");
    attemptRowElement.className = "attempt-row";

    const rowLabelElement = document.createElement("div");
    rowLabelElement.className = "row-label";
    rowLabelElement.textContent = `${row + 1}.`;

    const rowElement = document.createElement("div");
    rowElement.className = "row";
    rowElement.dataset.row = String(row);

    const rowTiles = [];
    for (let col = 0; col < gameState.wordLength; col += 1) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.addEventListener("click", () => {
        setActiveCol(row, col);
      });
      rowElement.appendChild(tile);
      rowTiles.push(tile);
    }

    attemptRowElement.appendChild(rowLabelElement);
    attemptRowElement.appendChild(rowElement);
    boardElement.appendChild(attemptRowElement);
    rowElements.push(rowElement);
    tileElements.push(rowTiles);
  }
}

function paintBoard() {
  for (let row = 0; row < MAX_ATTEMPTS; row += 1) {
    for (let col = 0; col < gameState.wordLength; col += 1) {
      const tile = tileElements[row][col];
      const value = gameState.board[row][col];
      const evalResult = gameState.evaluations[row];

      tile.textContent = value;
      tile.classList.remove("filled", "correct", "present", "absent", "caret");

      if (value) {
        tile.classList.add("filled");
      }

      if (evalResult) {
        tile.classList.add(evalResult[col]);
      }

      if (!gameState.gameOver && row === gameState.rowIndex && col === gameState.activeCol) {
        tile.classList.add("caret");
      }
    }
  }
}

function paintKeyboard() {
  for (const button of keyboardButtonByKey.values()) {
    button.classList.remove("correct", "present", "absent");
  }

  for (const [letter, state] of gameState.keyboardState.entries()) {
    const button = keyboardButtonByKey.get(letter);
    if (button) {
      button.classList.add(state);
    }
  }
}

function handleKeyInput(key) {
  if (gameState.gameOver || gameState.locked) {
    return;
  }

  if (key === "ENTER") {
    submitCurrentRow();
    return;
  }

  if (key === "BACKSPACE") {
    removeLetter();
    return;
  }

  if (!LETTER_REGEX.test(key)) {
    return;
  }

  addLetter(key);
}

function addLetter(letter) {
  const row = gameState.board[gameState.rowIndex];
  row[gameState.activeCol] = letter;
  gameState.activeCol = findNextEmptyCol(row, gameState.activeCol + 1);
  paintBoard();
}

function removeLetter() {
  const row = gameState.board[gameState.rowIndex];

  if (row[gameState.activeCol] !== "") {
    row[gameState.activeCol] = "";
    paintBoard();
    return;
  }

  const previousFilledCol = findPreviousFilledCol(row, gameState.activeCol - 1);
  if (previousFilledCol === -1) {
    return;
  }

  row[previousFilledCol] = "";
  gameState.activeCol = previousFilledCol;
  paintBoard();
}

async function submitCurrentRow() {
  if (gameState.gameOver || gameState.locked) {
    return;
  }

  const row = gameState.board[gameState.rowIndex];
  if (row.some((letter) => letter === "")) {
    shakeRow(gameState.rowIndex);
    setStatus("Wpisz pełne słowo.", true);
    return;
  }

  const guess = row.join("");
  if (!WORD_REGEX.test(guess) || guess.length !== gameState.wordLength) {
    shakeRow(gameState.rowIndex);
    setStatus("Niepoprawny zapis słowa.", true);
    return;
  }

  gameState.locked = true;
  try {
    const validation = await validateGuess(guess);
    if (!validation.accepted) {
      shakeRow(gameState.rowIndex);
      clearRow(gameState.rowIndex);
      setStatus(validation.message, true);
      return;
    }

    const result = evaluateGuess(guess, gameState.targetWord);
    gameState.evaluations[gameState.rowIndex] = result;
    applyKeyboardResult(guess, result);
    paintBoard();
    paintKeyboard();

    if (guess === gameState.targetWord) {
      finishGame(`Brawo! Odgadnięte hasło: ${gameState.targetWord}`, false);
      return;
    }

    if (gameState.rowIndex === MAX_ATTEMPTS - 1) {
      finishGame(`Koniec prób. Hasło: ${gameState.targetWord}`, true);
      return;
    }

    gameState.rowIndex += 1;
    gameState.activeCol = 0;
    setStatus("", false);
    paintBoard();
  } finally {
    gameState.locked = false;
  }
}

function finishGame(statusText, isError) {
  gameState.gameOver = true;
  setStatus(statusText, isError);
  paintBoard();
  showDefinitionIfNeeded();
}

function setActiveCol(row, col) {
  if (gameState.gameOver || gameState.locked) {
    return;
  }
  if (row !== gameState.rowIndex) {
    return;
  }

  gameState.activeCol = col;
  paintBoard();
}

function moveActiveCol(delta) {
  if (gameState.gameOver || gameState.locked) {
    return;
  }

  const nextCol = Math.min(
    gameState.wordLength - 1,
    Math.max(0, gameState.activeCol + delta)
  );
  if (nextCol === gameState.activeCol) {
    return;
  }

  gameState.activeCol = nextCol;
  paintBoard();
}

function findNextEmptyCol(row, fromCol) {
  for (let col = fromCol; col < gameState.wordLength; col += 1) {
    if (row[col] === "") {
      return col;
    }
  }

  for (let col = 0; col < gameState.wordLength; col += 1) {
    if (row[col] === "") {
      return col;
    }
  }

  return gameState.activeCol;
}

function findPreviousFilledCol(row, fromCol) {
  for (let col = fromCol; col >= 0; col -= 1) {
    if (row[col] !== "") {
      return col;
    }
  }

  for (let col = gameState.wordLength - 1; col >= 0; col -= 1) {
    if (row[col] !== "") {
      return col;
    }
  }

  return -1;
}

function clearRow(rowIndex) {
  const row = gameState.board[rowIndex];
  for (let col = 0; col < gameState.wordLength; col += 1) {
    row[col] = "";
  }
  gameState.activeCol = 0;
  paintBoard();
}

function shakeRow(rowIndex) {
  const rowElement = rowElements[rowIndex];
  if (!rowElement) {
    return;
  }

  rowElement.classList.add("shake");
  window.setTimeout(() => {
    rowElement.classList.remove("shake");
  }, 280);
}

function evaluateGuess(guess, target) {
  const result = Array(guess.length).fill("absent");
  const remainingLetters = new Map();

  for (let i = 0; i < target.length; i += 1) {
    if (guess[i] === target[i]) {
      result[i] = "correct";
    } else {
      const count = remainingLetters.get(target[i]) ?? 0;
      remainingLetters.set(target[i], count + 1);
    }
  }

  for (let i = 0; i < guess.length; i += 1) {
    if (result[i] === "correct") {
      continue;
    }

    const count = remainingLetters.get(guess[i]) ?? 0;
    if (count > 0) {
      result[i] = "present";
      remainingLetters.set(guess[i], count - 1);
    }
  }

  return result;
}

function applyKeyboardResult(guess, result) {
  for (let i = 0; i < guess.length; i += 1) {
    const letter = guess[i];
    const nextState = result[i];
    const currentState = gameState.keyboardState.get(letter);
    if (shouldPromoteKeyState(currentState, nextState)) {
      gameState.keyboardState.set(letter, nextState);
    }
  }
}

function shouldPromoteKeyState(currentState, nextState) {
  const order = {
    absent: 0,
    present: 1,
    correct: 2
  };

  if (!currentState) {
    return true;
  }

  return order[nextState] > order[currentState];
}

async function validateGuess(word) {
  if (gameState.mode === GAME_MODES.NORMAL) {
    const normalSet = NORMAL_WORD_SET_BY_LENGTH.get(word.length);
    if (normalSet && normalSet.has(word)) {
      return { accepted: true, message: "" };
    }
  } else {
    const foreignSet = FOREIGN_WORD_SET_BY_LENGTH.get(word.length);
    if (foreignSet && foreignSet.has(word)) {
      return { accepted: true, message: "" };
    }
  }

  const [api, localDictionary] = await Promise.all([
    validateWordInDictionary(word),
    validateWordInLocalDictionary(word)
  ]);

  if (gameState.mode === GAME_MODES.NORMAL) {
    if (localDictionary.available && localDictionary.valid) {
      return { accepted: true, message: "" };
    }

    if (api.available && api.valid) {
      return { accepted: true, message: "" };
    }

    if (!api.available && !localDictionary.available) {
      return {
        accepted: false,
        message: "Brak połączenia ze słownikiem online i lokalnym słownikiem. Wpisz hasło z puli gry."
      };
    }

    return {
      accepted: false,
      message: "Tego słowa nie ma w słowniku lokalnym/online ani w puli gry."
    };
  }

  if (localDictionary.available && localDictionary.valid) {
    return { accepted: true, message: "" };
  }

  if (api.available && api.valid) {
    return { accepted: true, message: "" };
  }

  if (!api.available && !localDictionary.available) {
    return {
      accepted: false,
      message: "Brak połączenia ze słownikiem online i lokalnym słownikiem. Dla trybu obcych wpisz hasło z puli gry."
    };
  }

  return {
    accepted: false,
    message: "Tego słowa nie ma w słowniku lokalnym/online ani w puli wyrazów obcych."
  };
}

async function validateWordInDictionary(word) {
  try {
    const response = await fetch(`/api/validate?word=${encodeURIComponent(word)}`, {
      cache: "no-store"
    });
    if (!response.ok) {
      return { available: false, valid: false };
    }

    const data = await response.json();
    return {
      available: Boolean(data.available),
      valid: Boolean(data.valid)
    };
  } catch (_error) {
    return { available: false, valid: false };
  }
}

async function validateWordInLocalDictionary(word) {
  const lookup = await loadLocalPolishDictionaryLookup();
  if (!lookup.available) {
    return { available: false, valid: false };
  }

  const candidates = new Set([
    word,
    word.toLocaleLowerCase("pl-PL"),
    word[0] + word.slice(1).toLocaleLowerCase("pl-PL")
  ]);
  const entries = lookup.wordsByLength.get(word.length) ?? new Set();
  for (const candidate of candidates) {
    if (entries.has(candidate)) {
      return { available: true, valid: true };
    }
  }
  return { available: true, valid: false };
}

async function loadLocalPolishDictionaryLookup() {
  if (localPolishDictionaryPromise) {
    return localPolishDictionaryPromise;
  }

  const bundledLookup = getBundledPolishDictionaryLookup();
  if (bundledLookup.available) {
    localPolishDictionaryPromise = Promise.resolve(bundledLookup);
    return localPolishDictionaryPromise;
  }

  localPolishDictionaryPromise = (async () => {
    try {
      const response = await fetch(POLISH_DICTIONARY_DIC_PATH, { cache: "force-cache" });
      if (!response.ok) {
        return { available: false, wordsByLength: new Map() };
      }

      const buffer = await response.arrayBuffer();
      const decoder = new TextDecoder(POLISH_DICTIONARY_DECODER);
      const content = decoder.decode(buffer);
      const lines = content.split(/\r?\n/);
      const wordsByLength = new Map([
        [4, new Set()],
        [5, new Set()],
        [6, new Set()],
        [7, new Set()]
      ]);

      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i].trim();
        if (!line || line.startsWith("#")) {
          continue;
        }
        if (i === 0 && /^\d+$/.test(line)) {
          continue;
        }

        const token = line.split(/\s+/)[0];
        const rawWord = token.split("/")[0];
        if (!rawWord) {
          continue;
        }

        const normalized = rawWord.toLocaleUpperCase("pl-PL");
        if (![4, 5, 6, 7].includes(normalized.length)) {
          continue;
        }
        if (!WORD_REGEX.test(normalized)) {
          continue;
        }
        wordsByLength.get(normalized.length)?.add(normalized);
      }

      return { available: true, wordsByLength };
    } catch (_error) {
      return { available: false, wordsByLength: new Map() };
    }
  })();

  return localPolishDictionaryPromise;
}

function getBundledPolishDictionaryLookup() {
  const source = window[BUNDLED_POLISH_DICTIONARY_KEY];
  if (!source || typeof source !== "object") {
    return { available: false, wordsByLength: new Map() };
  }

  const wordsByLength = new Map([
    [4, new Set()],
    [5, new Set()],
    [6, new Set()],
    [7, new Set()]
  ]);

  for (const length of [4, 5, 6, 7]) {
    const rawWords = source[String(length)] ?? source[length];
    if (!Array.isArray(rawWords)) {
      continue;
    }

    for (const rawWord of rawWords) {
      const word = String(rawWord ?? "").trim().toLocaleUpperCase("pl-PL");
      if (word.length !== length) {
        continue;
      }
      if (!WORD_REGEX.test(word)) {
        continue;
      }
      wordsByLength.get(length)?.add(word);
    }
  }

  const total =
    (wordsByLength.get(4)?.size ?? 0) +
    (wordsByLength.get(5)?.size ?? 0) +
    (wordsByLength.get(6)?.size ?? 0) +
    (wordsByLength.get(7)?.size ?? 0);
  if (total === 0) {
    return { available: false, wordsByLength: new Map() };
  }

  return { available: true, wordsByLength };
}

function showDefinitionIfNeeded() {
  if (gameState.mode !== GAME_MODES.FOREIGN) {
    hideDefinition();
    return;
  }

  const definition = FOREIGN_DEFINITION_MAP.get(gameState.targetWord);
  if (!definitionElement || !definitionWordElement || !definitionTextElement) {
    return;
  }

  definitionWordElement.textContent = gameState.targetWord;
  definitionTextElement.textContent = definition ?? "Brak definicji dla tego hasła.";
  definitionElement.hidden = false;
}

function hideDefinition() {
  if (!definitionElement || !definitionWordElement || !definitionTextElement) {
    return;
  }
  definitionElement.hidden = true;
  definitionWordElement.textContent = "";
  definitionTextElement.textContent = "";
}

function setStatus(text, isError) {
  statusElement.textContent = text;
  statusElement.classList.toggle("error", Boolean(isError));
}
