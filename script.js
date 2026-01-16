class TaskTree {
    constructor() {
        this.tasks = []
        this.index = new Map()
        this.parents = new Map()
    }

    _id() {
        return crypto.randomUUID()
    }

    _removeRef(id) { for (const t of this.tasks) { t.children = t.children.filter(c => c !== id) } }

    addTask(data = "", status = "pending", parentId = null) {
        const taskid = this._id()
        const task = { taskid, data, status, children: [] }
        this.tasks.push(task)
        this.index.set(taskid, task)
        if (parentId && this.index.has(parentId)) {
            this.index.get(parentId).children.push(taskid)
            this.parents.set(taskid, parentId)
        }
        return taskid
    }

    removeTask(taskid) {
        const task = this.index.get(taskid)
        if (!task) return false
        for (const c of task.children) this.removeTask(c)
        const pid = this.parents.get(taskid)
        if (pid) {
            const p = this.index.get(pid)
            p.children = p.children.filter(c => c !== taskid)
        }
        this.parents.delete(taskid)
        this.index.delete(taskid)
        this.tasks = this.tasks.filter(t => t.taskid !== taskid)
        return true
    }

    update(taskid, key, value) {
        const t = this.index.get(taskid)
        if (!t || !(key in t)) return false
        t[key] = value
        return true
    }

    getRoots() {
        return this.tasks.filter(t => !this.parents.has(t.taskid))
    }

    moveTaskIdToNewParentTaskId(taskid, newParentId = null) {
        if (!this.index.has(taskid)) return false
        const oldParent = this.parents.get(taskid)
        if (oldParent) {
            const p = this.index.get(oldParent)
            p.children = p.children.filter(c => c !== taskid)
        }
        this.parents.delete(taskid)
        if (newParentId && this.index.has(newParentId)) {
            this.index.get(newParentId).children.push(taskid)
            this.parents.set(taskid, newParentId)
        }
        return true
    }

    getTaskById(taskid) { return this.index.get(taskid) || null }
}
function renderTasks(tree, container) {
    container.innerHTML = ""
    tree.getRoots().forEach(t => renderTask(tree, t, container, 0))
}


function renderTask(tree, task, container, depth, parentId = "", hidden = false) {

    function toggleChildren(parentId, hide) {
        const rows = [...container.querySelectorAll(".ind_task")]
        let active = false

        for (const row of rows) {
            if (row.dataset.taskid === String(parentId)) {
                active = true
                continue
            }
            if (!active) continue
            if (!row.dataset.parent) break

            let p = row.dataset.parent
            let isDescendant = false
            let blocked = false

            while (p) {
                if (p === String(parentId)) isDescendant = true
                const t = tree.getTaskById(p)
                if (t && t.collapsed && p !== parentId) blocked = true
                const el = container.querySelector(`[data-taskid="${p}"]`)
                p = el ? el.dataset.parent : ""
            }

            if (!isDescendant) break

            if (hide || blocked) {
                if (row.style.display === "none") continue
                // hide
                row.style.overflowY = "hidden"
                const h = row.scrollHeight
                row.style.height = h + "px"
                row.offsetHeight
                row.style.height = "0px"
                row.style.marginBottom = "0"
                row.style.transition = ".25s  cubic-bezier(0.075, 0.82, 0.165, 1)"
                setTimeout(() => {
                    row.style.display = "none"
                    row.style.opacity = "0"
                }, 250)
            } else {
                if (row.style.display !== "none") continue
                // show
                row.style.display = ""
                row.style.overflowY = "hidden"
                row.style.height = "0px"
                const h = row.scrollHeight
                row.offsetHeight
                row.style.height = h + "px"
                row.style.marginBottom = ".5em"
                row.style.transition = ""
                setTimeout(() => {
                    row.style.height = ""
                    row.style.opacity = "1"
                    row.style.overflowY = ""
                }, 250)
            }
        }
    }



    const wrap = document.createElement("div")
    wrap.className = "ind_task"
    wrap.dataset.taskid = task.taskid
    wrap.dataset.parent = parentId || ""
    if (hidden) wrap.style.display = "none"


    for (let i = -1; i < depth; i++) {
        const line = document.createElement("div")
        line.className = "task_hir_line"
        line.style.left = (i * 4) + 3.2 + "em"
        wrap.appendChild(line)
    }

    const inner = document.createElement("div")
    inner.className = "task_inner"
    inner.style.marginLeft = depth * 4 + "em"


    let expand = null;
    if (task.children.length > 0) {
        expand = document.createElement("div")
        expand.className = "icn task_expand"
        expand.textContent = "chevron_right"
        expand.style.transform = task.collapsed ? "rotate(0deg)" : "rotate(90deg)"

        expand.addEventListener("click", e => {
            e.stopPropagation()
            task.collapsed = !task.collapsed
            if (task.collapsed) {
                expand.style.transform = "rotate(0deg)";
            } else {
                expand.style.transform = "rotate(90deg)";
            }
            toggleChildren(task.taskid, task.collapsed)
        })
    }


    inner.draggable = true

    inner.addEventListener("dragstart", e => {
        if (!task.collapsed) expand?.click();
        e.dataTransfer.setData("text/plain", task.taskid)
        e.dataTransfer.effectAllowed = "move"
        inner.style.opacity = ".5";

        input.contentEditable = "false"
        input.style.userSelect = "none"
        input.blur();

        const clone = inner.cloneNode(true)
        clone.style.position = "fixed"
        clone.style.top = "-1000px"
        clone.style.left = "-1000px"
        clone.style.pointerEvents = "none"
        document.body.appendChild(clone)
        e.dataTransfer.setDragImage(clone, clone.offsetWidth / 2, clone.offsetHeight / 2)
        setTimeout(() => document.body.removeChild(clone), 0)

    })

    inner.addEventListener("dragend", () => {
        inner.style.opacity = "1";
        inner.classList.remove("drag_over");

        input.contentEditable = "true"
        input.style.userSelect = "auto"
    })

    inner.addEventListener("dragover", e => {
        e.preventDefault()
        if (!inner.classList.contains("drag_over")) {
            inner.classList.add("drag_over")
        }
    })


    inner.addEventListener("dragleave", () => {
        inner.classList.remove("drag_over")
    })

    inner.addEventListener("drop", e => {
        e.preventDefault()
        inner.classList.remove("drag_over")
        const draggedId = e.dataTransfer.getData("text/plain")
        if (!draggedId) return
        if (draggedId === task.taskid) return
        if (isDescendant(tree, draggedId, task.taskid)) return
        tree.update(draggedId, "collapsed", false)
        tree.moveTaskIdToNewParentTaskId(draggedId, task.taskid)
        renderTasks(tree, container)
    })

    const data = document.createElement("div")
    data.className = "task_data"

    const input = document.createElement("div");
    input.classList.add("fakeInput");
    input.contentEditable = "true"
    input.tabIndex = 0
    input.innerText = task.data
    const initialHeight = input.style.height
    input.oninput = () => tree.update(task.taskid, "data", input.innerText)
    input.addEventListener("focus", () => {
        input.classList.add("focus")
        input.style.height = "auto"
        input.style.height = (input.scrollHeight + 25) + "px"
        const range = document.createRange()
        range.selectNodeContents(input)
        const sel = window.getSelection()
        sel.removeAllRanges()
        sel.addRange(range)
    })

    input.addEventListener("blur", () => {
        input.classList.remove("focus")
        input.style.height = initialHeight
        const sel = window.getSelection()
        sel.removeAllRanges()
    })

    let inputFocused = 0;
    if (task.data.length == 0) {
        setTimeout(() => {
            if (!inputFocused)
                input.focus()
        }, 50)
    }

    data.appendChild(input)

    if (task.children.length > 0) {
        const meta = document.createElement("div")
        meta.className = "task_additional"
        meta.innerHTML = `${task.children.length} subtasks &bull; Pending`;
        data.appendChild(meta)
    } else {
        const meta = document.createElement("div")
        meta.className = "task_additional"
        meta.textContent = `Pending`;
        data.appendChild(meta)
    }

    const toggle = document.createElement("div")
    toggle.className = "completion_toggle icn"
    toggle.textContent = "check"

    inner.append((expand) ? expand : '', data, toggle)

    const addBtn = document.createElement("div")
    addBtn.className = "new_task_btn"
    addBtn.style.marginLeft = depth * 4 + "em"
    addBtn.innerHTML = `<div class="icn">add</div>`
    addBtn.addEventListener("click", () => {
        tree.addTask("", "pending", task.taskid)
        renderTasks(tree, container)
    })


    wrap.append(inner, addBtn)
    container.appendChild(wrap)
    container.addEventListener("mouseover", e => {
        const row = e.target.closest(".ind_task")
        if (!row) return
        highlightAncestors(row, true)
    })

    container.addEventListener("mouseout", e => {
        const row = e.target.closest(".ind_task")
        if (!row) return
        highlightAncestors(row, false)
    })

    function highlightAncestors(row, on) {
        let current = row
        while (current) {
            current.classList.toggle("ancestor_hover", on)
            const pid = current.dataset.parent
            current = pid ? document.querySelector(`[data-taskid="${pid}"]`) : null
        }
    }


    task.children.forEach(id => {
        const child = tree.getTaskById(id)
        if (child) {
            renderTask(tree, child, container, depth + 1, task.taskid, hidden || task.collapsed)
        }
    })
    if (task.collapsed && !hidden) toggleChildren(task.taskid, true)

    return wrap
}

function taskTreeFromJSON(json) {
    const tree = new TaskTree()
    for (const t of json.tasks) {
        tree.tasks.push(t)
        tree.index.set(t.taskid, t)
        for (const c of t.children) tree.parents.set(c, t.taskid)
    }
    return tree
}

function taskTreeToJSON(tree) {
    return {
        tasks: tree.tasks.map(t => ({
            taskid: t.taskid,
            data: t.data,
            status: t.status,
            children: [...t.children]
        }))
    }
}

function randomTaskTree(maxDepth = 5, maxChildren = 4, idPrefix = "t") {
    let counter = 1;
    const nodes = [];

    function createNode(depth) {
        const taskid = idPrefix + counter++;
        const status = Math.random() < 0.5 ? "pending" : "done";
        const children = [];
        const childrenCount = depth < maxDepth ? Math.floor(Math.random() * (maxChildren + 1)) : 0;
        for (let i = 0; i < childrenCount; i++) {
            const child = createNode(depth + 1);
            children.push(child.taskid);
        }
        const node = { taskid, data: `Task ${taskid}`, status, children };
        nodes.push(node);
        return node;
    }

    const rootsCount = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < rootsCount; i++) createNode(1);

    return { tasks: nodes };
}

const tree = taskTreeFromJSON(randomTaskTree());
console.log(tree);

renderTasks(tree, document.getElementById("tasks_main_tree"))

function isDescendant(tree, id, target) {
    if (id === target) return true
    const t = tree.getTaskById(id)
    if (!t) return false
    for (const c of t.children) if (isDescendant(tree, c, target)) return true
    return false
}

var eleObjs = {
    allWinCont: document.querySelector("#charlie")
}
let currentScreen = null;
function switchScreens(screen) {
    if (screen == currentScreen) return;
    currentScreen = screen;
    const screens = [...eleObjs.allWinCont.querySelectorAll(".screen")]
    const next = eleObjs.allWinCont.querySelector(`#${screen}.screen`)
    const current = screens.find(s => s.classList.contains("active"))

    if (current && current !== next) {
        current.classList.remove("active")
        current.classList.add("left")
    }

    screens.forEach(s => {
        if (s !== next && s !== current) {
            s.classList.remove("active", "left")
        }
    })

    next.classList.remove("left")
    next.classList.add("active")

    document.getElementById("listSearchInput").style.display = screen === "listsGrid" ? "flex" : "none"
    document.getElementById("file_actions").style.display = screen === "listsGrid" ? "none" : "flex"
}


switchScreens("listsGrid")