const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const appJs = fs.readFileSync(path.join(root, "app.js"), "utf8");
const KEY = "todo-items";
const ALERT = "Please enter a task.";

// Loads the app in a fresh jsdom "page". Pass `stored` (a localStorage string)
// to simulate a reload with previously persisted data.
function loadApp(stored) {
  const alerts = [];
  const dom = new JSDOM(html, {
    url: "http://localhost/",
    runScripts: "outside-only",
    beforeParse(window) {
      window.alert = (message) => alerts.push(message);
      if (stored !== undefined && stored !== null) {
        window.localStorage.setItem(KEY, stored);
      }
    },
  });
  const { window } = dom;
  window.eval(appJs);
  const { document } = window;

  const app = {
    window,
    alerts,
    input: document.getElementById("taskInput"),
    addButton: document.getElementById("addButton"),
    items: () => [...document.querySelectorAll("#taskList li")],
    texts: () =>
      app.items().map((li) => {
        const span = li.querySelector("span");
        return span ? span.textContent : null;
      }),
    stored: () => window.localStorage.getItem(KEY),
    storedTasks: () => JSON.parse(window.localStorage.getItem(KEY)),
    button: (li, label) =>
      [...li.querySelectorAll("button")].find((b) => b.textContent === label),
    editors: () => document.querySelectorAll(".task-edit-input"),
    add(text) {
      app.input.value = text;
      app.addButton.click();
    },
    reload: () => loadApp(window.localStorage.getItem(KEY)),
  };
  return app;
}

function pressKey(window, element, key) {
  element.dispatchEvent(
    new window.KeyboardEvent("keydown", { key, bubbles: true }),
  );
}

function setup(...tasks) {
  const app = loadApp();
  tasks.forEach((t) => app.add(t));
  app.alerts.length = 0;
  return app;
}

test.describe("existing behaviour (FR-001..FR-005)", () => {
  test("FR-001 Add button adds a task", () => {
    const app = loadApp();
    app.add("Buy milk");
    assert.deepEqual(app.texts(), ["Buy milk"]);
    assert.equal(app.input.value, "");
  });

  test("FR-002 Enter key adds a task", () => {
    const app = loadApp();
    app.input.value = "Walk dog";
    pressKey(app.window, app.input, "Enter");
    assert.deepEqual(app.texts(), ["Walk dog"]);
  });

  test("FR-003 empty and whitespace-only input is rejected with exact alert", () => {
    const app = loadApp();
    app.add("");
    app.add("   \t ");
    app.input.value = "  ";
    pressKey(app.window, app.input, "Enter");
    assert.deepEqual(app.alerts, [ALERT, ALERT, ALERT]);
    assert.deepEqual(app.texts(), []);
    assert.equal(app.stored(), null);
  });

  test("FR-001 new task input is trimmed", () => {
    const app = loadApp();
    app.add("  padded  ");
    assert.deepEqual(app.storedTasks(), ["padded"]);
  });

  test("FR-004 delete removes only the selected task", () => {
    const app = setup("a", "b", "c");
    app.button(app.items()[1], "Delete").click();
    assert.deepEqual(app.texts(), ["a", "c"]);
    assert.deepEqual(app.storedTasks(), ["a", "c"]);
  });

  test("FR-005 additions and deletions persist across reload", () => {
    const app = setup("a", "b", "c");
    app.button(app.items()[0], "Delete").click();
    const reloaded = app.reload();
    assert.deepEqual(reloaded.texts(), ["b", "c"]);
    assert.deepEqual(reloaded.storedTasks(), ["b", "c"]);
  });

  test("FR-005 corrupt or non-array storage falls back to empty list", () => {
    assert.deepEqual(loadApp("not json").texts(), []);
    assert.deepEqual(loadApp('{"a":1}').texts(), []);
    assert.deepEqual(loadApp('["ok", 5, null]').texts(), ["ok"]);
  });
});

test.describe("inline edit (EDIT-001..EDIT-007)", () => {
  test("EDIT-001 every task has an Edit action alongside Delete", () => {
    const app = setup("a", "b", "c");
    for (const li of app.items()) {
      assert.ok(app.button(li, "Edit"), "Edit button present");
      assert.ok(app.button(li, "Delete"), "Delete button present");
    }
  });

  test("EDIT-002 Edit opens an editor prefilled with the selected task only", () => {
    const app = setup("a", "b", "c");
    app.button(app.items()[1], "Edit").click();
    assert.equal(app.editors().length, 1);
    assert.equal(app.editors()[0].value, "b");
    assert.ok(app.items()[1].contains(app.editors()[0]));
    assert.ok(app.button(app.items()[1], "Save"));
    assert.ok(app.button(app.items()[1], "Cancel"));
    assert.deepEqual(app.storedTasks(), ["a", "b", "c"]);
  });

  test("EDIT-003 only one editor at a time; switching discards the old draft", () => {
    const app = setup("a", "b", "c");
    app.button(app.items()[0], "Edit").click();
    app.editors()[0].value = "unsaved draft";
    app.button(app.items()[2], "Edit").click();
    assert.equal(app.editors().length, 1);
    assert.equal(app.editors()[0].value, "c");
    assert.ok(app.items()[2].contains(app.editors()[0]));
    assert.deepEqual(app.storedTasks(), ["a", "b", "c"]);
    assert.deepEqual(app.texts(), ["a", "b", null]);
  });

  test("EDIT-003 deleting a task above the editor keeps the editor on the same task", () => {
    const app = setup("a", "b", "c", "d");
    app.button(app.items()[2], "Edit").click(); // editing "c"
    app.button(app.items()[0], "Delete").click(); // delete "a"
    assert.equal(app.editors().length, 1);
    assert.equal(app.editors()[0].value, "c");
    app.editors()[0].value = "C edited";
    app.button(app.items()[1], "Save").click();
    assert.deepEqual(app.storedTasks(), ["b", "C edited", "d"]);
  });

  test("EDIT-003 deleting a task below the editor keeps the editor on the same task", () => {
    const app = setup("a", "b", "c");
    app.button(app.items()[0], "Edit").click();
    app.button(app.items()[2], "Delete").click();
    assert.equal(app.editors()[0].value, "a");
    assert.deepEqual(app.storedTasks(), ["a", "b"]);
  });

  test("EDIT-004 Save trims, updates only the selected task, keeps order, persists", () => {
    const app = setup("a", "b", "c");
    app.button(app.items()[1], "Edit").click();
    app.editors()[0].value = "   B updated  ";
    app.button(app.items()[1], "Save").click();
    assert.equal(app.editors().length, 0);
    assert.deepEqual(app.texts(), ["a", "B updated", "c"]);
    assert.deepEqual(app.storedTasks(), ["a", "B updated", "c"]);
    assert.deepEqual(app.reload().texts(), ["a", "B updated", "c"]);
  });

  test("EDIT-004 Enter in the editor saves, Escape cancels", () => {
    const app = setup("a", "b");
    app.button(app.items()[0], "Edit").click();
    app.editors()[0].value = "a2";
    pressKey(app.window, app.editors()[0], "Enter");
    assert.deepEqual(app.storedTasks(), ["a2", "b"]);

    app.button(app.items()[1], "Edit").click();
    app.editors()[0].value = "zzz";
    pressKey(app.window, app.editors()[0], "Escape");
    assert.equal(app.editors().length, 0);
    assert.deepEqual(app.storedTasks(), ["a2", "b"]);
  });

  test("EDIT-005 empty/whitespace Save alerts, keeps editor, preserves task and storage", () => {
    const app = setup("a", "b");
    const before = app.stored();
    app.button(app.items()[0], "Edit").click();
    for (const bad of ["", "    \t "]) {
      app.editors()[0].value = bad;
      app.button(app.items()[0], "Save").click();
      assert.equal(app.alerts.at(-1), ALERT);
      assert.equal(app.editors().length, 1, "editor stays open");
      assert.equal(app.stored(), before);
    }
    assert.equal(app.alerts.length, 2);

    app.editors()[0].value = "a fixed";
    app.button(app.items()[0], "Save").click();
    assert.deepEqual(app.storedTasks(), ["a fixed", "b"]);
  });

  test("EDIT-005 original task is intact after an invalid Save then Cancel", () => {
    const app = setup("a", "b");
    app.button(app.items()[0], "Edit").click();
    app.editors()[0].value = " ";
    app.button(app.items()[0], "Save").click();
    app.button(app.items()[0], "Cancel").click();
    assert.deepEqual(app.texts(), ["a", "b"]);
    assert.deepEqual(app.storedTasks(), ["a", "b"]);
  });

  test("EDIT-006 Cancel discards the draft and restores the display", () => {
    const app = setup("a", "b");
    const before = app.stored();
    app.button(app.items()[0], "Edit").click();
    app.editors()[0].value = "draft";
    app.button(app.items()[0], "Cancel").click();
    assert.equal(app.editors().length, 0);
    assert.deepEqual(app.texts(), ["a", "b"]);
    assert.equal(app.stored(), before);
    assert.deepEqual(app.reload().texts(), ["a", "b"]);
  });

  test("EDIT-007 Add, Enter, Delete and validation still work after editing", () => {
    const app = setup("a", "b");
    app.button(app.items()[0], "Edit").click();
    app.editors()[0].value = "a2";
    app.button(app.items()[0], "Save").click();

    app.add("c");
    app.input.value = "d";
    pressKey(app.window, app.input, "Enter");
    app.add("   ");
    assert.deepEqual(app.alerts, [ALERT]);
    assert.deepEqual(app.storedTasks(), ["a2", "b", "c", "d"]);

    app.button(app.items()[1], "Delete").click();
    assert.deepEqual(app.storedTasks(), ["a2", "c", "d"]);
    assert.deepEqual(app.reload().texts(), ["a2", "c", "d"]);
  });

  test("EDIT-007 deleting the task being edited closes the editor and removes only it", () => {
    const app = setup("a", "b", "c");
    app.button(app.items()[1], "Edit").click();
    app.button(app.items()[1], "Delete").click();
    assert.equal(app.editors().length, 0);
    assert.deepEqual(app.texts(), ["a", "c"]);
    assert.deepEqual(app.storedTasks(), ["a", "c"]);
  });

  test("task text is rendered as text, not HTML", () => {
    const app = loadApp();
    app.add("<b>bold</b>");
    assert.equal(app.window.document.querySelectorAll("#taskList b").length, 0);
    assert.deepEqual(app.texts(), ["<b>bold</b>"]);
  });
});
