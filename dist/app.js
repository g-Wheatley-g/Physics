"use strict";

const search = document.querySelector("#search");
const clearSearch = document.querySelector("#clear-search");
const resultsTitle = document.querySelector("#results-title");
const resultCount = document.querySelector("#result-count");
const questionList = document.querySelector("#question-list");
const emptyState = document.querySelector("#empty-state");
const loadMore = document.querySelector("#load-more");
const questionCard = document.querySelector("#question-card");
const batchSize = 18;
const pluralRules = new Intl.PluralRules("ru");
const countLabels = { one: "вопрос", few: "вопроса", many: "вопросов", other: "вопроса" };
const questionCollator = new Intl.Collator("ru", { sensitivity: "base", numeric: true });

function normalizeWord(word) {
  return word.normalize("NFKC").toLowerCase().replaceAll("ё", "е");
}

function questionWords(text) {
  return [...text.matchAll(/[\p{L}\p{N}\p{M}]+/gu)];
}

function searchTerms(text) {
  return questionWords(text).map(word => normalizeWord(word[0]));
}

function questionCount(count) {
  return count + " " + countLabels[pluralRules.select(count)];
}

const index = physicsQuestions.map(entry => {
  const words = questionWords(entry.question);
  return { ...entry, words, searchText: words.map(word => normalizeWord(word[0])).join(" ") };
});

let matches = [];
let terms = [];
let shown = 0;

function relevance(text, phrase) {
  if (text === phrase) return 3;
  if (text.startsWith(phrase)) return 2;
  if (text.includes(phrase)) return 1;
  return 0;
}

function renderQuestion(heading, { question, words }, highlightedTerms) {
  let end = 0;
  for (const word of words) {
    if (!highlightedTerms.some(term => normalizeWord(word[0]).includes(term))) continue;
    heading.append(question.slice(end, word.index));
    const mark = document.createElement("mark");
    mark.textContent = word[0];
    heading.append(mark);
    end = word.index + word[0].length;
  }
  heading.append(question.slice(end));
}

function createCard(entry, highlightedTerms = []) {
  const card = questionCard.content.firstElementChild.cloneNode(true);
  renderQuestion(card.querySelector("h3"), entry, highlightedTerms);
  card.querySelector(".source-note").hidden = !entry.incomplete;
  const multiple = entry.answers.length > 1;
  card.querySelector(".answer-label").textContent = multiple ? "Ответы" : "Ответ";
  const content = card.querySelector(".answer-content");

  if (!multiple) {
    content.textContent = entry.answers[0];
    return card;
  }

  const list = document.createElement("ul");
  for (const answer of entry.answers) {
    const item = document.createElement("li");
    item.textContent = answer;
    list.append(item);
  }
  content.append(list);
  return card;
}

function showBatch(moveFocus = false) {
  const cards = matches.slice(shown, shown + batchSize).map(entry => createCard(entry, terms));
  questionList.append(...cards);
  shown += cards.length;
  loadMore.hidden = shown >= matches.length;
  if (moveFocus) cards[0]?.querySelector("h3").focus();
}

function updateResults() {
  terms = searchTerms(search.value);
  const activeSearch = terms.length > 0;
  const phrase = terms.join(" ");
  matches = activeSearch
    ? index.filter(entry => terms.every(term => entry.searchText.includes(term)))
      .sort((first, second) => relevance(second.searchText, phrase) - relevance(first.searchText, phrase))
    : index;

  const count = matches.length;
  resultsTitle.textContent = activeSearch ? "Результаты поиска" : "Все вопросы";
  resultCount.textContent = questionCount(count);
  clearSearch.hidden = search.value.length === 0;
  emptyState.hidden = count > 0;
  questionList.replaceChildren();
  shown = 0;
  showBatch();
}

function setQuery(value) {
  search.value = value;
  updateResults();
  search.focus();
}

search.addEventListener("input", updateResults);
search.addEventListener("keydown", event => {
  if (event.key !== "Escape" || !search.value) return;
  event.preventDefault();
  setQuery("");
});
search.form.addEventListener("submit", event => event.preventDefault());
clearSearch.addEventListener("click", () => setQuery(""));
loadMore.addEventListener("click", () => showBatch(true));
for (const suggestion of document.querySelectorAll("[data-query]")) {
  suggestion.addEventListener("click", () => setQuery(suggestion.dataset.query));
}

updateResults();

function showAlphabet() {
  const alphabetList = document.querySelector("#alphabet-list");
  if (alphabetList.childElementCount) return;

  const alphabet = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ#";
  const letters = document.querySelector("#alphabet-letters");
  const groups = new Map();
  for (const entry of index) {
    const initial = entry.question[0].toLocaleUpperCase("ru");
    const letter = alphabet.includes(initial) ? initial : "#";
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(entry);
  }

  document.querySelector("#alphabet-count").textContent = questionCount(index.length);
  for (const letter of alphabet) {
    const entries = groups.get(letter);
    if (!entries) continue;

    const section = document.createElement("section");
    section.className = "alphabet-group";
    const heading = document.createElement("h2");
    heading.textContent = letter === "#" ? "Формулы и обозначения" : letter;
    heading.tabIndex = -1;
    const list = document.createElement("div");
    list.className = "question-list";
    entries.sort((first, second) => questionCollator.compare(first.question, second.question));
    list.append(...entries.map(entry => createCard(entry)));
    section.append(heading, list);
    alphabetList.append(section);

    const jump = document.createElement("button");
    jump.type = "button";
    jump.textContent = letter === "#" ? "Формулы" : letter;
    jump.addEventListener("click", () => {
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ block: "start" });
    });
    letters.append(jump);
  }
}

const tabs = [...document.querySelectorAll("[role='tab']")];

function activateTab(selected) {
  if (selected.getAttribute("aria-selected") === "true") return;
  if (selected.id === "tab-alphabet") showAlphabet();
  for (const tab of tabs) {
    const active = tab === selected;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    document.getElementById(tab.getAttribute("aria-controls")).hidden = !active;
  }
  window.scrollTo(0, 0);
}

for (const [position, tab] of tabs.entries()) {
  tab.addEventListener("click", () => activateTab(tab));
  tab.addEventListener("keydown", event => {
    let next;
    switch (event.key) {
      case "ArrowLeft": next = (position + tabs.length - 1) % tabs.length; break;
      case "ArrowRight": next = (position + 1) % tabs.length; break;
      case "Home": next = 0; break;
      case "End": next = tabs.length - 1; break;
      default: return;
    }
    event.preventDefault();
    activateTab(tabs[next]);
    tabs[next].focus();
  });
}
