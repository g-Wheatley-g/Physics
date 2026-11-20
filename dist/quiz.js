"use strict";

(() => {
  const quizSize = 30;
  const bank = index.flatMap(entry => {
    if (entry.incomplete || entry.sourceNote || entry.answers.length !== 1) return [];
    const quiz = entry.lmsNumbers
      ? entry.quiz
      : { answer: entry.answers[0], distractors: quizDistractors[entry.question] };
    if (!quiz || quiz.distractors?.length !== 3) return [];
    const options = [quiz.answer, ...quiz.distractors];
    if (new Set(options).size !== 4) return [];
    return [{ ...entry, quiz, options }];
  }).sort((first, second) => questionCollator.compare(first.question, second.question));

  const find = id => document.getElementById(id);
  const start = find("quiz-start");
  const builder = find("quiz-builder");
  const attempt = find("quiz-attempt");
  const result = find("quiz-result");
  const pool = find("quiz-pool");
  const filter = find("quiz-filter");
  const begin = find("quiz-begin");
  const random = find("quiz-random");
  const pick = find("quiz-pick");
  const question = find("quiz-question");
  const options = find("quiz-options");
  const previous = find("quiz-previous");
  const next = find("quiz-next");
  const finish = find("quiz-finish");
  const notice = find("quiz-notice");
  const selection = new Set();
  let poolChoices = [];
  let test = [];
  let answers = [];
  let position = 0;

  random.disabled = bank.length < quizSize;
  pick.disabled = bank.length < quizSize;
  if (bank.length < quizSize) start.querySelector("p").textContent = "Для теста нужно 30 доступных вопросов.";

  function show(screen) {
    for (const step of [start, builder, attempt, result]) step.hidden = step !== screen;
  }

  function shuffled(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[other]] = [copy[other], copy[index]];
    }
    return copy;
  }

  function choice(type, name, text) {
    const label = document.createElement("label");
    label.className = "quiz-choice";
    const input = document.createElement("input");
    input.type = type;
    input.name = name;
    const caption = document.createElement("span");
    caption.textContent = text;
    label.append(input, caption);
    return { label, input };
  }

  function updateSelection() {
    const full = selection.size === quizSize;
    find("quiz-selected").textContent = "Выбрано " + selection.size + " из " + quizSize;
    begin.disabled = !full;
    for (const { entry, input } of poolChoices) {
      input.checked = selection.has(entry);
      input.disabled = full && !input.checked;
    }
  }

  function filterPool() {
    const terms = searchTerms(filter.value);
    let anyVisible = false;
    for (const { entry, label } of poolChoices) {
      label.hidden = !terms.every(term => entry.searchText.includes(term));
      if (!label.hidden) anyVisible = true;
    }
    find("quiz-builder-empty").hidden = anyVisible;
  }

  function openBuilder() {
    if (!poolChoices.length) {
      poolChoices = bank.map(entry => {
        const { label, input } = choice("checkbox", "question", entry.question);
        input.addEventListener("change", () => {
          if (!input.checked) selection.delete(entry);
          else if (selection.size < quizSize) selection.add(entry);
          updateSelection();
        });
        return { entry, label, input };
      });
      pool.append(...poolChoices.map(item => item.label));
    }
    filterPool();
    updateSelection();
    show(builder);
    find("quiz-builder-title").focus();
  }

  function openStart() {
    show(start);
    find("quiz-start-title").focus();
  }

  function updateProgress() {
    const count = answers.filter(answer => answer !== null).length;
    find("quiz-answered").textContent = "Отвечено " + count + " из " + quizSize;
    find("quiz-progress").value = count;
    finish.hidden = position < test.length - 1 && count < quizSize;
  }

  function showQuestion() {
    const item = test[position];
    question.textContent = item.question;
    find("quiz-position").textContent = "Вопрос " + (position + 1) + " из " + quizSize;
    options.replaceChildren(...item.options.map((option, optionIndex) => {
      const { label, input } = choice("radio", "quiz-answer", option);
      input.value = String(optionIndex);
      input.checked = answers[position] === optionIndex;
      input.addEventListener("change", () => {
        answers[position] = optionIndex;
        notice.textContent = "";
        updateProgress();
      });
      return label;
    }));
    previous.disabled = position === 0;
    next.hidden = position === test.length - 1;
    notice.textContent = "";
    updateProgress();
    question.focus();
  }

  function beginTest(entries) {
    if (entries.length !== quizSize) return;
    test = entries.map(entry => ({
      question: entry.quiz.question ?? entry.question,
      answer: entry.quiz.answer,
      options: shuffled(entry.options),
    }));
    answers = Array(quizSize).fill(null);
    position = 0;
    show(attempt);
    showQuestion();
  }

  function renderReview(item, selected, correct) {
    const article = document.createElement("article");
    article.className = "question-card";
    const title = document.createElement("h3");
    title.textContent = item.question;
    const answer = document.createElement("p");
    answer.className = correct ? "review-line correct" : "review-line incorrect";
    answer.textContent = (correct ? "Верно · " : "Ваш ответ · ") + selected;
    article.append(title, answer);
    if (!correct) {
      const correction = document.createElement("p");
      correction.className = "review-line";
      correction.textContent = "Верный ответ · " + item.answer;
      article.append(correction);
    }
    return article;
  }

  function finishTest() {
    const firstUnanswered = answers.indexOf(null);
    if (firstUnanswered !== -1) {
      const remaining = answers.filter(answer => answer === null).length;
      position = firstUnanswered;
      showQuestion();
      notice.textContent = "Ответьте ещё на " + questionCount(remaining) + ".";
      return;
    }

    let score = 0;
    const review = test.map((item, index) => {
      const selected = item.options[answers[index]];
      const correct = item.answer === selected;
      if (correct) score++;
      return renderReview(item, selected, correct);
    });
    find("quiz-score").textContent = score + " из " + quizSize + " верно";
    find("quiz-review").replaceChildren(...review);
    show(result);
    find("quiz-result-title").focus();
  }

  random.addEventListener("click", () => beginTest(shuffled(bank).slice(0, quizSize)));
  pick.addEventListener("click", openBuilder);
  find("quiz-builder-back").addEventListener("click", openStart);
  filter.addEventListener("input", filterPool);
  begin.addEventListener("click", () => beginTest([...selection]));
  previous.addEventListener("click", () => {
    position--;
    showQuestion();
  });
  next.addEventListener("click", () => {
    position++;
    showQuestion();
  });
  finish.addEventListener("click", finishTest);
  find("quiz-new").addEventListener("click", () => {
    selection.clear();
    filter.value = "";
    find("quiz-review").replaceChildren();
    openStart();
  });
})();
