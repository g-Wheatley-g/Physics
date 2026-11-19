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

function normalizeWord(word) {
  return word.normalize("NFKC").toLowerCase().replaceAll("ё", "е");
}

function questionWords(text) {
  return [...text.matchAll(/[\p{L}\p{N}\p{M}]+/gu)];
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

function renderQuestion(heading, { question, words }) {
  let end = 0;
  for (const word of words) {
    if (!terms.some(term => normalizeWord(word[0]).includes(term))) continue;
    heading.append(question.slice(end, word.index));
    const mark = document.createElement("mark");
    mark.textContent = word[0];
    heading.append(mark);
    end = word.index + word[0].length;
  }
  heading.append(question.slice(end));
}

function createCard(entry) {
  const card = questionCard.content.firstElementChild.cloneNode(true);
  renderQuestion(card.querySelector("h3"), entry);
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
  const cards = matches.slice(shown, shown + batchSize).map(createCard);
  questionList.append(...cards);
  shown += cards.length;
  loadMore.hidden = shown >= matches.length;
  if (moveFocus) cards[0]?.querySelector("h3").focus();
}

function updateResults() {
  terms = questionWords(search.value).map(word => normalizeWord(word[0]));
  const activeSearch = terms.length > 0;
  const phrase = terms.join(" ");
  matches = activeSearch
    ? index.filter(entry => terms.every(term => entry.searchText.includes(term)))
      .sort((first, second) => relevance(second.searchText, phrase) - relevance(first.searchText, phrase))
    : index;

  const count = matches.length;
  resultsTitle.textContent = activeSearch ? "Результаты поиска" : "Все вопросы";
  resultCount.textContent = count + " " + countLabels[pluralRules.select(count)];
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
