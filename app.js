const TODO_STORAGE_KEY = "todo-items";

const taskInput = document.getElementById("taskInput");
const addButton = document.getElementById("addButton");
const taskList = document.getElementById("taskList");

let tasks = readTasksFromStorage();
let editingIndex = null;

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

    if (editingIndex === index) {
      const editInput = document.createElement("input");
      editInput.type = "text";
      editInput.value = task;
      editInput.setAttribute("aria-label", "Edit task");
      editInput.className = "task-edit-input";

      const saveButton = document.createElement("button");
      saveButton.textContent = "Save";
      saveButton.className = "task-action edit-save-button";
      saveButton.type = "button";

      const cancelButton = document.createElement("button");
      cancelButton.textContent = "Cancel";
      cancelButton.className = "task-action edit-cancel-button";
      cancelButton.type = "button";

      const deleteButton = document.createElement("button");
      deleteButton.textContent = "Delete";
      deleteButton.className = "delete-button";
      deleteButton.type = "button";

      saveButton.addEventListener("click", () => {
        const updatedTask = editInput.value.trim();

        if (updatedTask === "") {
          alert("Please enter a task.");
          return;
        }

        tasks[index] = updatedTask;
        editingIndex = null;
        saveTasksToStorage();
        renderTasks();
      });

      cancelButton.addEventListener("click", () => {
        editingIndex = null;
        renderTasks();
      });

      deleteButton.addEventListener("click", () => {
        if (editingIndex === index) {
          editingIndex = null;
        }
        tasks.splice(index, 1);
        saveTasksToStorage();
        renderTasks();
      });

      editInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          saveButton.click();
        }

        if (event.key === "Escape") {
          cancelButton.click();
        }
      });

      listItem.append(editInput, saveButton, cancelButton, deleteButton);
      taskList.appendChild(listItem);

      queueMicrotask(() => {
        editInput.focus();
        editInput.select();
      });
      return;
    }

    const taskText = document.createElement("span");
    taskText.textContent = task;

    const actionsWrapper = document.createElement("div");
    actionsWrapper.className = "task-actions";

    const editButton = document.createElement("button");
    editButton.textContent = "Edit";
    editButton.className = "task-action edit-button";
    editButton.type = "button";

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.className = "delete-button";
    deleteButton.type = "button";

    editButton.addEventListener("click", () => {
      editingIndex = index;
      renderTasks();
    });

    deleteButton.addEventListener("click", () => {
      if (editingIndex === index) {
        editingIndex = null;
      } else if (editingIndex !== null && index < editingIndex) {
        editingIndex -= 1;
      }
      tasks.splice(index, 1);
      saveTasksToStorage();
      renderTasks();
    });

    actionsWrapper.append(editButton, deleteButton);
    listItem.append(taskText, actionsWrapper);
    taskList.appendChild(listItem);
  });
}

function addTask() {
  const task = taskInput.value.trim();

  if (task === "") {
    alert("Please enter a task.");
    return;
  }

  editingIndex = null;
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
