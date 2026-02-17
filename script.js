const MAX_ATTEMPTS = 6;
const LETTER_REGEX = /^[A-ZĄĆĘŁŃÓŚŹŻ]$/;
const WORD_REGEX = /^[A-ZĄĆĘŁŃÓŚŹŻ]+$/;
const GAME_MODES = { NORMAL: "normal", FOREIGN: "foreign" };

const DEFAULT_NORMAL_POOL = {
  4: ["WODA", "DOMY", "LASY", "KOTY", "RYBY", "PIES", "RANO", "LATO", "ZIMA", "KAWA", "MOST", "OKNO", "FALA", "MŁYN", "GÓRY", "RÓŻA", "ŁĄKA", "SOKI", "MURY", "MAMA", "TATA", "ŻABA", "KASA", "PŁOT", "ROWY"],
  5: ["RADIA", "OCEAN", "KOTEK", "DOMEK", "KWIAT", "DROGA", "RZEKA", "PTAKI", "CHLEB", "MLEKO", "JABŁO", "OGRÓD", "ŁÓDKA", "PIŁKA", "NARTY", "WIATR", "ZEGAR", "SERCE", "KASZA", "OWOCE", "MOTYL", "RYNEK", "ULICA", "BRAMA"],
  6: ["OCEANY", "SZKOŁA", "ROWERY", "WIOSNA", "JESIEŃ", "SŁOŃCE", "OGRODY", "KWIATY", "PŁATKI", "ZEGARY", "KLOCKI", "MOTYLE", "KOTLET", "TULIPA", "SPACER", "MIASTO", "JABŁKA", "PIERÓG", "KRAINA", "BRZEGI"],
  7: ["WAKACJE", "PIEROGI", "KWIATKI", "ZEGARKI", "SZYBKIE", "OGRÓDKI", "ULICZKA", "KSIĄŻKI", "PODRÓŻE", "WARZYWA", "GÓRSKIE", "KOTLETY", "RADOSNY", "POLSKIE", "JABŁONIE", "MIASTKO", "DODATKI"]
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

// Ładowanie danych z plików zewnętrznych
function normalizeWordPool(pool) {
  const normalized = { 4: [], 5: [], 6: [], 7: [] };
  for (const [len, words] of Object.entries(pool || {})) {
    if (normalized[len]) normalized[len] = words.map(w => w.toUpperCase());
  }
  return normalized;
}

const NORMAL_WORD_POOL = normalizeWordPool(window.NORMAL_WORD_POOL || DEFAULT_NORMAL_POOL);
const FOREIGN_DATA = window.FOREIGN_DICTIONARY_DATA || { wordsByLength: {}, definitionsByWord: {} };
const FOREIGN_WORD_POOL = normalizeWordPool(FOREIGN_DATA.wordsByLength);
const FOREIGN_DEFINITION_MAP = new Map(Object.entries(FOREIGN_DATA.definitionsByWord || {}));

let gameState = {};

function init() {
  buildKeyboard();
  bindUiEvents();
  startNewRound();
}

function startNewRound() {
  const len = parseInt(selectLengthElement.value);
  const pool = currentMode === GAME_MODES.NORMAL ? NORMAL_WORD_POOL[len] : FOREIGN_WORD_POOL[len];
  const target = pool[Math.floor(Math.random() * pool.length)] || "TEST";
  
  gameState = {
    wordLength: len,
    targetWord: target.toUpperCase(),
    rowIndex: 0,
    activeCol: 0,
    board: Array.from({ length: MAX_ATTEMPTS }, () => Array(len).fill("")),
    evaluations: Array.from({ length: MAX_ATTEMPTS }, () => null),
    keyboardState: new Map(),
    gameOver: false
  };
  
  renderBoard();
  hideDefinition();
  setStatus("Powodzenia!", false);
}

// UPROSZCZONA WALIDACJA - BEZ PYTHONA
async function validateGuess(word) {
  // Teraz gra zawsze przyjmie słowo, jeśli ma dobrą długość
  return { accepted: true }; 
}
// --- RESZTA FUNKCJI (Skrócona dla czytelności, ale zachowująca logikę) ---

function renderBoard() {
  boardElement.innerHTML = "";
  boardElement.style.setProperty("--word-len", gameState.wordLength);
  for (let r = 0; r < MAX_ATTEMPTS; r++) {
    const rowDiv = document.createElement("div");
    rowDiv.className = "row";
    for (let c = 0; c < gameState.wordLength; c++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      if (gameState.evaluations[r]) tile.classList.add(gameState.evaluations[r][c]);
      if (r === gameState.rowIndex && c === gameState.activeCol && !gameState.gameOver) tile.classList.add("caret");
      tile.textContent = gameState.board[r][c];
      rowDiv.appendChild(tile);
    }
    boardElement.appendChild(rowDiv);
  }
  paintKeyboard();
}

function handleKeyInput(key) {
  if (gameState.gameOver) return;
  const row = gameState.board[gameState.rowIndex];
  if (key === "ENTER") {
    submitRow();
  } else if (key === "BACKSPACE") {
    if (gameState.activeCol > 0 || row[gameState.activeCol] !== "") {
        if (row[gameState.activeCol] === "" && gameState.activeCol > 0) gameState.activeCol--;
        row[gameState.activeCol] = "";
    }
  } else if (LETTER_REGEX.test(key) && gameState.activeCol < gameState.wordLength) {
    row[gameState.activeCol] = key;
    if (gameState.activeCol < gameState.wordLength - 1) gameState.activeCol++;
  }
  renderBoard();
}

async function submitRow() {
  const row = gameState.board[gameState.rowIndex];
  const guess = row.join("");
  if (guess.length < gameState.wordLength) return setStatus("Za krótkie!", true);

  const val = await validateGuess(guess);
  if (!val.accepted) return setStatus(val.message, true);

  const result = evaluate(guess, gameState.targetWord);
  gameState.evaluations[gameState.rowIndex] = result;
  
  // Aktualizacja klawiatury
  guess.split("").forEach((l, i) => {
    const old = gameState.keyboardState.get(l);
    if (result[i] === "correct" || (result[i] === "present" && old !== "correct")) {
        gameState.keyboardState.set(l, result[i]);
    } else if (!old) {
        gameState.keyboardState.set(l, "absent");
    }
  });

  if (guess === gameState.targetWord) {
    gameState.gameOver = true;
    setStatus("GRATULACJE!", false);
    showDefinition();
  } else if (gameState.rowIndex === MAX_ATTEMPTS - 1) {
    gameState.gameOver = true;
    setStatus("KONIEC GRY: " + gameState.targetWord, true);
    showDefinition();
  } else {
    gameState.rowIndex++;
    gameState.activeCol = 0;
  }
  renderBoard();
}

function evaluate(guess, target) {
    let t = target.split("");
    let g = guess.split("");
    let res = Array(g.length).fill("absent");
    g.forEach((l, i) => { if (l === t[i]) { res[i] = "correct"; t[i] = null; g[i] = null; } });
    g.forEach((l, i) => { if (l && t.includes(l)) { res[i] = "present"; t[t.indexOf(l)] = null; } });
    return res;
}

function buildKeyboard() {
  const mk = (k) => {
    const b = document.createElement("button");
    b.className = "key" + (k.length > 1 ? " special" : "");
    b.textContent = k === "BACKSPACE" ? "⌫" : k;
    b.onclick = () => handleKeyInput(k);
    keyboardButtonByKey.set(k, b);
    return b;
  };
  const keyboardButtonByKey = new Map();
  [...KEYBOARD_MAIN_ROWS, KEYBOARD_PL_ROW].forEach((row, i) => {
    const d = document.createElement("div");
    d.className = "key-row";
    row.forEach(k => d.appendChild(mk(k)));
    (i < 3 ? keyboardMainElement : keyboardPlElement).appendChild(d);
  });
}

function paintKeyboard() {
    document.querySelectorAll(".key").forEach(b => {
        const state = gameState.keyboardState.get(b.textContent === "⌫" ? "BACKSPACE" : b.textContent);
        if (state) { b.classList.remove("correct", "present", "absent"); b.classList.add(state); }
    });
}

function setStatus(t, err) { statusElement.textContent = t; statusElement.className = "status " + (err ? "error" : ""); }
function hideDefinition() { definitionElement.hidden = true; }
function showDefinition() {
    if (currentMode === GAME_MODES.FOREIGN) {
        // 1. Pobieramy dane ze słownika (sprawdzamy różne możliwe nazwy)
        const dictionary = window.FOREIGN_DICTIONARY_DATA || {};
        const defs = dictionary.definitionsByWord || dictionary.definitions || dictionary.definitionByWord || {};
        
        // 2. Szukamy definicji dla wylosowanego słowa
        let definition = defs[gameState.targetWord];

        // 3. Jeśli nie znaleziono (np. małe/duże litery), szukamy bez względu na wielkość liter
        if (!definition) {
            const entry = Object.entries(defs).find(([key]) => key.toUpperCase() === gameState.targetWord.toUpperCase());
            if (entry) definition = entry[1];
        }

        // 4. Wyświetlamy na ekranie
        definitionWordElement.textContent = gameState.targetWord;
        definitionTextElement.textContent = definition || "Brak definicji w bazie danych dla tego słowa.";
        definitionElement.hidden = false;
        
        // Na wypadek gdyby element był zablokowany w CSS
        definitionElement.style.display = "block";
    }
}
let currentMode = GAME_MODES.NORMAL;
function bindUiEvents() {
    newRoundButton.onclick = startNewRound;
    selectLengthElement.onchange = startNewRound;
    normalModeButton.onclick = () => { currentMode = GAME_MODES.NORMAL; normalModeButton.classList.add("active"); foreignModeButton.classList.remove("active"); startNewRound(); };
    foreignModeButton.onclick = () => { currentMode = GAME_MODES.FOREIGN; foreignModeButton.classList.add("active"); normalModeButton.classList.remove("active"); startNewRound(); };
    document.onkeydown = (e) => {
        if (e.key === "Enter") handleKeyInput("ENTER");
        else if (e.key === "Backspace") handleKeyInput("BACKSPACE");
        else {
            const l = e.key.toUpperCase();
            if (LETTER_REGEX.test(l)) handleKeyInput(l);
        }
    };
}
init();
