const TODO_STORAGE_KEY = "todo-items";

const taskInput = document.getElementById("taskInput");
const addButton = document.getElementById("addButton");
const taskList = document.getElementById("taskList");

let tasks = readTasksFromStorage();

function readTasksFromStorage() {
  try {
    const savedTasks = localStorage.getItem(TODO_STORAGE_KEY);

    if (savedTasks === null) {
      return [];
    }

    const parsedTasks = JSON.parse(savedTasks);

    return Array.isArray(parsedTasks)
      ? parsedTasks.filter((task) => typeof task === "string")
      : [];
  } catch {
    return [];
  }
}

function saveTasksToStorage() {
  localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(tasks));
}

function renderTasks() {
  taskList.replaceChildren();

  tasks.forEach((task, index) => {
    const listItem = document.createElement("li");

    const taskText = document.createElement("span");
    taskText.textContent = task;

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.className = "delete-button";
    deleteButton.type = "button";

    deleteButton.addEventListener("click", () => {
      tasks.splice(index, 1);
      saveTasksToStorage();
      renderTasks();
    });

    listItem.append(taskText, deleteButton);
    taskList.appendChild(listItem);
  });
}

function addTask() {
  const task = taskInput.value.trim();

  if (task === "") {
    alert("Please enter a task.");
    return;
  }

  tasks.push(task);
  saveTasksToStorage();

  taskInput.value = "";
  renderTasks();
  taskInput.focus();
}

addButton.addEventListener("click", addTask);

taskInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    addTask();
  }
});

renderTasks();
