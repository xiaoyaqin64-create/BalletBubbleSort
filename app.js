"use strict";

const DANCERS = [
  { id: 1, level: 6, name: "紫罗兰领舞", image: "assets/1.png", imageWidth: 94, footOffset: 0 },
  { id: 2, level: 5, name: "蔷薇舞者", image: "assets/2.png", imageWidth: 86.3, footOffset: 1.5 },
  { id: 3, level: 4, name: "星蓝舞者", image: "assets/3.png", imageWidth: 84.6, footOffset: 1.3 },
  { id: 4, level: 3, name: "薄荷舞者", image: "assets/4.png", imageWidth: 73.1, footOffset: 0 },
  { id: 5, level: 2, name: "蜜桃舞者", image: "assets/5.png", imageWidth: 56.7, footOffset: 0 },
  { id: 6, level: 1, name: "金铃舞者", image: "assets/6.png", imageWidth: 52.2, footOffset: 0 }
];

const INITIAL_LEVELS = [3, 6, 1, 5, 2, 4];
const byId = (id) => DANCERS.find((dancer) => dancer.id === id);
const idForLevel = (level) => DANCERS.find((dancer) => dancer.level === level).id;
const freshOrder = () => INITIAL_LEVELS.map(idForLevel);
const levelsOf = (order) => order.map((id) => byId(id).level);
const isDescending = (order) => levelsOf(order).every((level, index, list) => index === 0 || list[index - 1] >= level);

const ui = {
  shell: document.querySelector(".app-shell"),
  tabs: [...document.querySelectorAll(".level-tab")],
  views: {
    manual: document.querySelector("#manual-level"),
    auto: document.querySelector("#auto-level")
  },
  manualLayer: document.querySelector("#manual-stage .dancer-layer"),
  manualCount: document.querySelector("#manual-swap-count"),
  manualMessage: document.querySelector("#manual-message"),
  manualReset: document.querySelector("#manual-reset"),
  autoLayer: document.querySelector("#auto-stage .dancer-layer"),
  autoMessage: document.querySelector("#auto-message"),
  stageAction: document.querySelector("#stage-action"),
  scanBeam: document.querySelector("#scan-beam"),
  roundStat: document.querySelector("#round-stat"),
  compareStat: document.querySelector("#compare-stat"),
  autoSwapStat: document.querySelector("#auto-swap-stat"),
  run: document.querySelector("#run-button"),
  step: document.querySelector("#step-button"),
  pause: document.querySelector("#pause-button"),
  autoReset: document.querySelector("#auto-reset"),
  speed: document.querySelector("#speed-range"),
  speedLabel: document.querySelector("#speed-label"),
  choices: {
    outer: document.querySelector("#outer-choice"),
    inner: document.querySelector("#inner-choice"),
    condition: document.querySelector("#condition-choice")
  }
};

let celebrationTimer = null;

function clearCelebration() {
  window.clearTimeout(celebrationTimer);
  celebrationTimer = null;
  ui.shell.classList.remove("celebrating");
  ui.shell.querySelectorAll(".confetti-layer").forEach((layer) => layer.remove());
}

function launchConfetti() {
  clearCelebration();
  const colors = ["#ffd95a", "#ff7eaa", "#9f7cff", "#68e0c2", "#ffffff", "#ff9f57"];
  const layer = document.createElement("div");
  layer.className = "confetti-layer";
  layer.setAttribute("aria-hidden", "true");
  for (let index = 0; index < 42; index += 1) {
    const piece = document.createElement("i");
    piece.className = `confetti-piece shape-${index % 3}`;
    piece.style.setProperty("--x", `${2 + Math.random() * 96}%`);
    piece.style.setProperty("--drift", `${-8 + Math.random() * 16}vw`);
    piece.style.setProperty("--spin", `${360 + Math.random() * 720}deg`);
    piece.style.setProperty("--delay", `${(index % 10) * 0.045}s`);
    piece.style.setProperty("--duration", `${1.8 + Math.random() * 1.15}s`);
    piece.style.setProperty("--confetti-color", colors[index % colors.length]);
    layer.appendChild(piece);
  }
  ui.shell.appendChild(layer);
  ui.shell.classList.add("celebrating");
  celebrationTimer = window.setTimeout(clearCelebration, 3400);
}

const state = {
  manual: { order: freshOrder(), selected: null, swaps: 0, locked: false },
  auto: {
    order: freshOrder(), actions: [], cursor: 0, playing: false, timer: null,
    swaps: 0, fixedSlots: new Set(), comparedSlots: [], configured: false, settings: null
  }
};

function dancerMarkup(dancer) {
  return `<img src="${dancer.image}" alt="${dancer.name}，身高等级${dancer.level}" draggable="false"><span class="height-badge" aria-label="身高等级${dancer.level}">${dancer.level}</span>`;
}

function createDancers(layer, mode) {
  layer.innerHTML = "";
  DANCERS.forEach((dancer) => {
    const element = document.createElement(mode === "manual" ? "button" : "div");
    if (mode === "manual") element.type = "button";
    element.className = "dancer";
    element.dataset.id = String(dancer.id);
    element.style.setProperty("--image-width", `${dancer.imageWidth}%`);
    element.style.setProperty("--foot-offset", `${dancer.footOffset}%`);
    element.setAttribute("aria-label", `${dancer.name}，身高等级${dancer.level}`);
    element.innerHTML = dancerMarkup(dancer);
    if (mode === "manual") element.addEventListener("click", () => chooseManualDancer(dancer.id));
    else element.setAttribute("role", "img");
    layer.appendChild(element);
  });
}

function drawOrder(layer, order, options = {}) {
  const { selected = null, comparing = [], fixedSlots = new Set(), spinning = [] } = options;
  [...layer.querySelectorAll(".dancer")].forEach((element) => {
    const id = Number(element.dataset.id);
    const slot = order.indexOf(id);
    element.style.setProperty("--slot", slot);
    element.classList.toggle("selected", id === selected);
    element.classList.toggle("comparing", comparing.includes(slot));
    element.classList.toggle("fixed", fixedSlots.has(slot));
    element.classList.toggle("spinning", spinning.includes(id));
    if (element.tagName === "BUTTON") element.setAttribute("aria-pressed", id === selected ? "true" : "false");
  });
}

function setMessage(element, type, title, text, icon = "♩") {
  element.hidden = false;
  element.className = `message-card ${type}${element.id === "auto-message" ? " compact" : ""}`;
  element.innerHTML = `<span class="message-icon" aria-hidden="true">${icon}</span><div><strong>${title}</strong><p>${text}</p></div>`;
}

function chooseManualDancer(id) {
  const manual = state.manual;
  if (manual.locked || isDescending(manual.order)) return;
  const clickedSlot = manual.order.indexOf(id);
  if (manual.selected === null) {
    manual.selected = id;
    drawOrder(ui.manualLayer, manual.order, { selected: id });
    setMessage(ui.manualMessage, "info", "已选中", "再点击她左边或右边紧挨着的舞者。", "♩");
    return;
  }
  if (manual.selected === id) {
    manual.selected = null;
    drawOrder(ui.manualLayer, manual.order);
    setMessage(ui.manualMessage, "info", "已取消", "重新选择一位舞者。", "♩");
    return;
  }
  const selectedSlot = manual.order.indexOf(manual.selected);
  if (Math.abs(clickedSlot - selectedSlot) !== 1) {
    const invalidElement = ui.manualLayer.querySelector(`[data-id="${id}"]`);
    invalidElement.classList.remove("invalid");
    void invalidElement.offsetWidth;
    invalidElement.classList.add("invalid");
    manual.selected = id;
    drawOrder(ui.manualLayer, manual.order, { selected: id });
    setMessage(ui.manualMessage, "warning", "不能跨过其他舞者", "只能交换相邻的两位。", "!");
    return;
  }
  manual.locked = true;
  const firstId = manual.order[selectedSlot];
  const secondId = manual.order[clickedSlot];
  [manual.order[selectedSlot], manual.order[clickedSlot]] = [secondId, firstId];
  manual.swaps += 1;
  manual.selected = null;
  ui.manualCount.textContent = String(manual.swaps);
  drawOrder(ui.manualLayer, manual.order, { spinning: [firstId, secondId] });
  window.setTimeout(() => {
    manual.locked = false;
    drawOrder(ui.manualLayer, manual.order);
    if (isDescending(manual.order)) {
      setMessage(ui.manualMessage, "success", "排序成功！", `${levelsOf(manual.order).join("、")}，共交换 ${manual.swaps} 次。`, "✓");
      launchConfetti();
    } else {
      setMessage(ui.manualMessage, "info", "交换完成", `当前顺序：${levelsOf(manual.order).join("、")}`, "♩");
    }
  }, 650);
}

function resetManual() {
  clearCelebration();
  state.manual = { order: freshOrder(), selected: null, swaps: 0, locked: false };
  ui.manualCount.textContent = "0";
  drawOrder(ui.manualLayer, state.manual.order);
  ui.manualMessage.hidden = true;
  ui.manualMessage.innerHTML = "";
}

function switchLevel(level) {
  stopAutoPlayback();
  clearCelebration();
  ui.tabs.forEach((tab) => {
    const active = tab.dataset.level === level;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  Object.entries(ui.views).forEach(([name, view]) => {
    const active = name === level;
    view.hidden = !active;
    view.classList.toggle("active", active);
  });
}

function readSettings() {
  return { outer: Number(ui.choices.outer.value), inner: ui.choices.inner.value, condition: ui.choices.condition.value };
}

function choicesComplete() {
  const firstMissing = Object.values(ui.choices).find((select) => !select.value);
  if (!firstMissing) return true;
  setMessage(ui.autoMessage, "warning", "程序还没补完整", "请完成 3 个选择。", "!");
  firstMissing.focus();
  return false;
}

function comparisonCount(mode, round) {
  if (mode === "fixed") return 5;
  if (mode === "grow") return Math.min(round + 1, 5);
  return Math.max(0, 5 - round);
}

function shouldSwap(leftLevel, rightLevel, condition) {
  if (condition === "desc") return leftLevel < rightLevel;
  if (condition === "asc") return leftLevel > rightLevel;
  return true;
}

function buildActions(settings) {
  const simulation = freshOrder();
  const actions = [];
  for (let round = 0; round < settings.outer; round += 1) {
    const count = comparisonCount(settings.inner, round);
    for (let index = 0; index < count; index += 1) {
      const leftId = simulation[index];
      const rightId = simulation[index + 1];
      const swap = shouldSwap(byId(leftId).level, byId(rightId).level, settings.condition);
      actions.push({ type: "compare", round, index, count, swap });
      if (swap) {
        [simulation[index], simulation[index + 1]] = [simulation[index + 1], simulation[index]];
        actions.push({ type: "swap", round, index, count });
      }
    }
    actions.push({ type: "roundEnd", round, count });
  }
  actions.push({ type: "finish" });
  return actions;
}

function lockChoices(locked) {
  Object.values(ui.choices).forEach((select) => { select.disabled = locked; });
}

function prepareAutoRun() {
  stopAutoPlayback();
  const auto = state.auto;
  auto.order = freshOrder();
  auto.settings = readSettings();
  auto.actions = buildActions(auto.settings);
  auto.cursor = 0;
  auto.swaps = 0;
  auto.fixedSlots = new Set();
  auto.comparedSlots = [];
  auto.configured = true;
  ui.autoSwapStat.textContent = "0";
  ui.roundStat.textContent = "—";
  ui.compareStat.textContent = "—";
  ui.stageAction.textContent = "程序开始运行";
  ui.scanBeam.classList.remove("visible");
  lockChoices(true);
  drawOrder(ui.autoLayer, auto.order);
  setMessage(ui.autoMessage, "info", "开始运行", "金色光圈每次比较相邻两位。", "▶");
}

function executeNextAction() {
  const auto = state.auto;
  if (!auto.configured || auto.cursor >= auto.actions.length) return false;
  const action = auto.actions[auto.cursor];
  auto.cursor += 1;
  if (action.type === "compare") {
    auto.comparedSlots = [action.index, action.index + 1];
    ui.roundStat.textContent = `${action.round + 1}/${auto.settings.outer}`;
    ui.compareStat.textContent = `${action.index + 1}/${action.count}`;
    ui.scanBeam.style.setProperty("--beam-slot", action.index);
    ui.scanBeam.classList.add("visible");
    const leftLevel = byId(auto.order[action.index]).level;
    const rightLevel = byId(auto.order[action.index + 1]).level;
    ui.stageAction.textContent = `${leftLevel} 和 ${rightLevel}：${action.swap ? "交换" : "不交换"}`;
    drawOrder(ui.autoLayer, auto.order, { comparing: auto.comparedSlots, fixedSlots: auto.fixedSlots });
  }
  if (action.type === "swap") {
    const leftId = auto.order[action.index];
    const rightId = auto.order[action.index + 1];
    [auto.order[action.index], auto.order[action.index + 1]] = [rightId, leftId];
    auto.swaps += 1;
    ui.autoSwapStat.textContent = String(auto.swaps);
    ui.stageAction.textContent = "条件成立，交换位置！";
    drawOrder(ui.autoLayer, auto.order, { comparing: [action.index, action.index + 1], fixedSlots: auto.fixedSlots, spinning: [leftId, rightId] });
  }
  if (action.type === "roundEnd") {
    auto.comparedSlots = [];
    ui.scanBeam.classList.remove("visible");
    if (auto.settings.inner === "shrink" && auto.settings.condition !== "always" && action.round < 5) auto.fixedSlots.add(5 - action.round);
    ui.stageAction.textContent = `第 ${action.round + 1} 轮完成`;
    drawOrder(ui.autoLayer, auto.order, { fixedSlots: auto.fixedSlots });
    setMessage(ui.autoMessage, "info", `第 ${action.round + 1} 轮完成`, levelsOf(auto.order).join("、"), "♩");
  }
  if (action.type === "finish") finishAutoRun();
  return auto.cursor < auto.actions.length;
}

function actionDelay() {
  const speedMultiplier = [1.45, 1, .58][Number(ui.speed.value)];
  const previousAction = state.auto.actions[Math.max(0, state.auto.cursor - 1)];
  const base = previousAction?.type === "swap" ? 850 : previousAction?.type === "compare" ? 680 : 480;
  return base * speedMultiplier;
}

function scheduleNext() {
  if (!state.auto.playing) return;
  const hasMore = executeNextAction();
  if (!hasMore || !state.auto.playing) return;
  state.auto.timer = window.setTimeout(scheduleNext, actionDelay());
}

function playAuto() {
  if (!choicesComplete()) return;
  if (!state.auto.configured || state.auto.cursor >= state.auto.actions.length) prepareAutoRun();
  state.auto.playing = true;
  ui.run.disabled = true;
  ui.step.disabled = true;
  ui.pause.disabled = false;
  scheduleNext();
}

function stopAutoPlayback() {
  window.clearTimeout(state.auto.timer);
  state.auto.timer = null;
  state.auto.playing = false;
  ui.run.disabled = false;
  ui.step.disabled = false;
  ui.pause.disabled = true;
}

function pauseAuto() {
  if (!state.auto.playing) return;
  stopAutoPlayback();
  ui.run.textContent = "▶ 继续";
  setMessage(ui.autoMessage, "info", "已暂停", "可单步观察，或继续运行。", "Ⅱ");
}

function stepAuto() {
  if (state.auto.playing || !choicesComplete()) return;
  if (!state.auto.configured || state.auto.cursor >= state.auto.actions.length) prepareAutoRun();
  executeNextAction();
  ui.run.textContent = "▶ 继续";
}

function describeMistakes(settings) {
  const notes = [];
  if (settings.condition === "asc") notes.push("比较方向反了");
  if (settings.condition === "always") notes.push("不能每次都交换");
  if (settings.outer < 5) notes.push("轮数太少");
  if (settings.outer > 5) notes.push("第 6 轮多余");
  if (settings.inner === "fixed") notes.push("能排序，但重复比较了已排好的位置");
  if (settings.inner === "grow") notes.push("每轮比较次数方向不对");
  return notes;
}

function finishAutoRun() {
  const auto = state.auto;
  stopAutoPlayback();
  ui.run.textContent = "▶ 再运行";
  ui.scanBeam.classList.remove("visible");
  lockChoices(false);
  const finalLevels = levelsOf(auto.order);
  const correctProgram = auto.settings.outer === 5 && auto.settings.inner === "shrink" && auto.settings.condition === "desc";
  const sorted = isDescending(auto.order);
  if (correctProgram && sorted) {
    auto.fixedSlots = new Set([0, 1, 2, 3, 4, 5]);
    drawOrder(ui.autoLayer, auto.order, { fixedSlots: auto.fixedSlots });
    ui.stageAction.textContent = "排序完成：6 → 1";
    setMessage(ui.autoMessage, "success", "编程成功！", finalLevels.join("、"), "✓");
    launchConfetti();
    return;
  }
  const notes = describeMistakes(auto.settings);
  ui.stageAction.textContent = sorted ? "结果正确，但程序还可优化" : "结果不正确，请修改程序";
  setMessage(ui.autoMessage, "warning", sorted ? "可以更高效" : "再试一次", `${finalLevels.join("、")}。${notes.join("；")}。`, "!");
}

function resetAuto() {
  clearCelebration();
  stopAutoPlayback();
  state.auto = { order: freshOrder(), actions: [], cursor: 0, playing: false, timer: null, swaps: 0, fixedSlots: new Set(), comparedSlots: [], configured: false, settings: null };
  lockChoices(false);
  Object.values(ui.choices).forEach((select) => { select.value = ""; });
  ui.run.textContent = "▶ 运行";
  ui.roundStat.textContent = "—";
  ui.compareStat.textContent = "—";
  ui.autoSwapStat.textContent = "0";
  ui.stageAction.textContent = "请先补全左侧程序";
  ui.scanBeam.classList.remove("visible");
  drawOrder(ui.autoLayer, state.auto.order);
  ui.autoMessage.hidden = true;
  ui.autoMessage.innerHTML = "";
}

function init() {
  createDancers(ui.manualLayer, "manual");
  createDancers(ui.autoLayer, "auto");
  resetManual();
  resetAuto();
  ui.tabs.forEach((tab) => tab.addEventListener("click", () => switchLevel(tab.dataset.level)));
  ui.manualReset.addEventListener("click", resetManual);
  ui.run.addEventListener("click", playAuto);
  ui.step.addEventListener("click", stepAuto);
  ui.pause.addEventListener("click", pauseAuto);
  ui.autoReset.addEventListener("click", resetAuto);
  ui.speed.addEventListener("input", () => { ui.speedLabel.textContent = ["慢速", "标准", "快速"][Number(ui.speed.value)]; });
}

init();
