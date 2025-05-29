// script.js
// ========= DARK MODE EARLY LOAD =========
const savedDarkMode = JSON.parse(localStorage.getItem('darkMode'));
if (savedDarkMode) document.body.classList.add('dark-mode');

// ========= TASK & LIST DATA =========
let customLists = JSON.parse(localStorage.getItem('customLists')) || {};
let taskLists = JSON.parse(localStorage.getItem('taskLists')) || {
  myday: [], important: [], planned: [], tasks: []
};
let awardedTasks = JSON.parse(localStorage.getItem('awardedTasks')) || [];
let currentList = 'myday';

// ========= UTILITY FUNCTIONS =========
function confirmAction(message) {
  return confirm(message);
}

function saveData() {
  localStorage.setItem('customLists', JSON.stringify(customLists));
  localStorage.setItem('taskLists', JSON.stringify(taskLists));
  localStorage.setItem('awardedTasks', JSON.stringify(awardedTasks));
}

function generateTaskId() {
  return '_' + Math.random().toString(36).substr(2, 9);
}

function updateTaskEverywhere(taskId, updateCallback) {
  const allLists = { ...taskLists, ...customLists };
  for (const key in allLists) {
    allLists[key] = allLists[key].map(task => {
      if (task.id === taskId) updateCallback(task);
      return task;
    });
  }
  saveData();
}

// ========= INITIALIZE =========
document.addEventListener("DOMContentLoaded", () => {
  const currentUser = JSON.parse(localStorage.getItem("currentUser"));
  const usernameEl = document.getElementById("sidebar-username");
  if (currentUser?.username && usernameEl) usernameEl.textContent = currentUser.username;

  const allTasks = [...Object.values(taskLists).flat(), ...Object.values(customLists).flat()];
  allTasks.forEach(task => { if (!task.id) task.id = generateTaskId(); });
  saveData();

  document.getElementById("search")?.addEventListener("input", function () {
    const query = this.value.toLowerCase();
    document.querySelectorAll("#task-list .task-item").forEach(task => {
      const text = task.textContent.toLowerCase();
      task.style.display = text.includes(query) ? "block" : "none";
    });
  });

  const darkToggle = document.getElementById("dark-mode-toggle");
  if (darkToggle) {
    darkToggle.checked = savedDarkMode;
    darkToggle.addEventListener("change", () => {
      const isDark = darkToggle.checked;
      localStorage.setItem("darkMode", isDark);
      document.body.classList.toggle("dark-mode", isDark);
    });
  }

  document.getElementById("newList")?.addEventListener("click", () => {
    const input = document.getElementById("newListInput");
    input.style.display = input.style.display === "none" ? "block" : "none";
  });

  document.getElementById("newListInput")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      const name = e.target.value.trim();
      if (name && !customLists[name]) {
        customLists[name] = [];
        saveData();
        renderLists();
        setActiveList(name);
        e.target.value = '';
        e.target.style.display = "none";
      }
    }
  });

  document.getElementById("new-task-input")?.addEventListener("keydown", handleNewTaskInput);

  renderLists();
  renderTasks();

  // ========= SHOW TUTORIAL FOR FIRST-TIME USERS =========
  const hasSeenTutorial = localStorage.getItem("hasSeenTutorial");
  if (!hasSeenTutorial) {
    showTutorialStep(0);
    localStorage.setItem("hasSeenTutorial", "true");
  }
});

// ========= RENDER TASK =========
function renderTask(task, index, listName = currentList) {
  const taskList = document.getElementById('task-list');
  const li = document.createElement('li');
  li.classList.add('task-item', `task-priority-${task.priority}`);
  li.style.backgroundColor = task.color || "#fff";
  const progress = task.progress || 0;

  li.innerHTML = `
    <strong>${task.name}</strong><br>
    <small>Due: ${task.dueDate}</small><br>
    <small>${task.description}</small><br>
    <div class="subtasks-container">
      ${task.subtasks?.length ? task.subtasks.map((sub, i) => `
        <div class="subtask">
          <input type="checkbox" class="subtask-checkbox" data-index="${i}" ${sub.done ? "checked" : ""}>
          <label>${sub.name}</label>
        </div>
      `).join("") : "<em>No subtasks</em>"}
      <div class="progress-label">Progress: ${progress}%</div>
    </div>
    <span class="delete-task"><i class="fas fa-trash"></i></span>
  `;

  li.querySelectorAll(".subtask-checkbox").forEach(checkbox => {
    checkbox.addEventListener("change", () => {
      const subIndex = parseInt(checkbox.getAttribute("data-index"));

      updateTaskEverywhere(task.id, updatedTask => {
        if (!updatedTask.subtasks || !updatedTask.subtasks[subIndex]) return;
        updatedTask.subtasks[subIndex].done = checkbox.checked;
        const doneCount = updatedTask.subtasks.filter(st => st.done).length;
        const total = updatedTask.subtasks.length;
        updatedTask.progress = total > 0 ? Math.round((doneCount / total) * 100) : 0;
        updatedTask.completed = updatedTask.progress === 100 ? new Date().toISOString().split("T")[0] : false;

        if (updatedTask.progress === 100 && !awardedTasks.includes(updatedTask.id)) {
          awardedTasks.push(updatedTask.id);
          showCongratsToast();
        }
      });

      saveData();
      renderTasks();
    });
  });

  li.querySelector('.delete-task').addEventListener('click', () => {
    if (confirmAction(`Delete task "${task.name}"?`)) {
      const list = taskLists[listName] || customLists[listName];
      const deletedTask = list.splice(index, 1)[0];

      if (deletedTask?.id) {
      // Remove from awardedTasks
      awardedTasks = awardedTasks.filter(id => id !== deletedTask.id);

      // Remove from earnedAwards
      const earnedAwards = JSON.parse(localStorage.getItem('earnedAwards')) || [];
      const updatedAwards = earnedAwards.filter(award => award.id !== deletedTask.id);
      localStorage.setItem('earnedAwards', JSON.stringify(updatedAwards));
      }

      saveData();
      renderTasks();
    }
  });

  taskList.appendChild(li);
}

function renderTasks() {
  clearTasks();
  const tasks = taskLists[currentList] || customLists[currentList] || [];
  document.getElementById('list-title').textContent = currentList.charAt(0).toUpperCase() + currentList.slice(1);
  tasks.forEach((task, index) => renderTask(task, index, currentList));
}

function clearTasks() {
  document.getElementById('task-list').innerHTML = '';
}

// ========= RENDER LISTS =========
function renderLists() {
  const listNav = document.getElementById('list-nav');
  listNav.innerHTML = `
    <li data-list="myday" class="${currentList === 'myday' ? 'active' : ''}"><i class="fas fa-sun"></i><span>My Day</span></li>
    <li data-list="important" class="${currentList === 'important' ? 'active' : ''}"><i class="fas fa-star"></i><span>Important</span></li>
    <li data-list="planned" class="${currentList === 'planned' ? 'active' : ''}"><i class="fas fa-calendar-alt"></i><span>Planned</span></li>
    <li data-list="tasks" class="${currentList === 'tasks' ? 'active' : ''}"><i class="fas fa-tasks"></i><span>Tasks</span></li>
  `;

  Object.keys(customLists).forEach(renderCustomList);
  document.querySelectorAll('#list-nav li').forEach(li => {
    li.addEventListener('click', () => {
      const list = li.getAttribute('data-list');
      setActiveList(list);
    });
  });
}

function renderCustomList(name) {
  const listNav = document.getElementById('list-nav');
  const li = document.createElement('li');
  li.setAttribute('data-list', name);
  li.innerHTML = `
    <i class="fas fa-list"></i>
    <span>${name}</span>
    <span class="delete-list" title="Delete list" style="margin-left:auto; cursor:pointer;">
      <i class="fas fa-trash-alt"></i>
    </span>
  `;

  li.querySelector('.delete-list').addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirmAction(`Delete the list "${name}"?`)) {
      delete customLists[name];
      saveData();
      renderLists();
      clearTasks();
    }
  });

  li.addEventListener('click', () => setActiveList(name));
  listNav.appendChild(li);
}

function setActiveList(name) {
  currentList = name;
  renderLists();
  renderTasks();
}

// ========= NEW TASK CREATION =========
function handleNewTaskInput(e) {
  if (e.key === "Enter" && e.target.value.trim()) {
    const name = e.target.value.trim();
    const priority = prompt("Set priority (high, normal, low)", "normal") || "normal";
    const dueDate = prompt("Enter due date (yyyy-mm-dd)") || "";
    const reminder = prompt("Enter reminder date (yyyy-mm-dd)") || "";
    const color = prompt("Enter a background color") || "#ffffff";
    const description = prompt("Add a description") || "";
    const created = new Date().toISOString().split("T")[0];

    const subtasks = (prompt("Enter subtasks separated by commas") || "")
      .split(",").map(name => ({ name: name.trim(), done: false })).filter(st => st.name);

    const task = {
      id: generateTaskId(),
      name, priority, dueDate, reminder, color, description,
      subtasks, progress: 0, completed: false, created
    };

    taskLists.tasks.push(task);
    const today = new Date().toISOString().split("T")[0];
    if (dueDate === today) taskLists.myday.push(task); else taskLists.planned.push(task);
    if (priority.toLowerCase() === "high") taskLists.important.push(task);

    saveData();
    renderTasks();
    e.target.value = '';
  }
}

// ========= TOAST FOR AWARD =========
function showCongratsToast() {
  const toast = document.getElementById("congrats-toast");
  const blur = document.getElementById("planner-blur");
  if (!toast || !blur) return;

  blur.style.display = "block";

  // Reset the animation
  toast.classList.remove("show");
  void toast.offsetWidth; // Force reflow
  toast.classList.add("show");

  // Hide blur and toast after animation ends
  setTimeout(() => {
    toast.classList.remove("show");
    blur.style.display = "none";
  }, 4000);
}

// automatically save data
window.addEventListener("beforeunload", function () {
  saveData(); // Just save silently without triggering any warning
});

// Tutorial Steps Content
const tutorialSteps = [
  "📋 <strong>How to create a task:</strong> Use the 'Add Task' input field on your planner page to quickly add new tasks by typing the task name and hitting Enter.",
  "🖋 <strong>How to create a list:</strong> Click the 'New List' button, enter your list name, and press Enter to organize your tasks by category.",
  "🗓 <strong>How to plan a task:</strong> Assign due dates or add tasks to the 'Planned' list to keep track of your schedule.",
  "📋 <strong>How to complete/delete a task:</strong> Use the checkbox next to subtasks to mark them done, or click the trash icon to delete a task.",
  "🛠 <strong>How to customize your view:</strong> Use the theme toggle in settings to switch between light and dark mode and tailor your experience."
];

let currentTutorialStep = 0;

function showTutorialStep(stepIndex) {
  const overlay = document.getElementById("tutorial-overlay");
  const textContainer = document.getElementById("tutorial-step-text");

  if (stepIndex < 0 || stepIndex >= tutorialSteps.length) return;

  currentTutorialStep = stepIndex;
  textContainer.innerHTML = tutorialSteps[stepIndex];
  overlay.style.display = "block";

  // Disable Prev on first step, Next on last step
  document.getElementById("tutorial-prev-btn").disabled = stepIndex === 0;
  document.getElementById("tutorial-next-btn").disabled = stepIndex === tutorialSteps.length - 1;
}

function closeTutorial() {
  document.getElementById("tutorial-overlay").style.display = "none";
  currentTutorialStep = 0;
}

document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("start-tutorial-btn");
  const prevBtn = document.getElementById("tutorial-prev-btn");
  const nextBtn = document.getElementById("tutorial-next-btn");
  const exitBtn = document.getElementById("tutorial-exit-btn");

  startBtn.addEventListener("click", () => {
    showTutorialStep(0);
  });

  prevBtn.addEventListener("click", () => {
    if (currentTutorialStep > 0) showTutorialStep(currentTutorialStep - 1);
  });

  nextBtn.addEventListener("click", () => {
    if (currentTutorialStep < tutorialSteps.length - 1) showTutorialStep(currentTutorialStep + 1);
  });

  exitBtn.addEventListener("click", () => {
    closeTutorial();
  });
});