var tree, currentlyEditingListKey = null;
class History {
    constructor(limit = 50) {
        this.undo = []
        this.redo = []
        this.limit = limit
    }
    push(state) {
        this.undo.push(state)
        if (this.undo.length > this.limit) this.undo.shift()
        this.redo.length = 0
    }
    undoState(current) {
        if (!this.undo.length) return null
        this.redo.push(current)
        return this.undo.pop()
    }
    redoState(current) {
        if (!this.redo.length) return null
        this.undo.push(current)
        return this.redo.pop()
    }
}
class TaskTree {
    constructor() {
        this.tasks = [],
            this.data = {},
            this.index = new Map(),
            this.parents = new Map()
        this.history = new History()
    }

    _id() { return crypto.randomUUID() }

    async _commit() {
        saveUI.startLoader()
        const now = Date.now()
        this.tasks.forEach(t => {
            if (!t.createdAt) t.createdAt = now
            if (!t.updatedAt) t.updatedAt = now
            if (t.status === "done" && !t.completedAt) t.completedAt = now
            if (t.status !== "done") t.completedAt = null
            if (!("color" in t)) t.color = null
        })

        await db.set(currentlyEditingListKey, JSON.stringify(taskTreeToJSON(this)))
        const stats = this.getStats()
        stats["name"] = document.getElementById("titleEditor").value;
        const g = await db.get("gListData") || {}
        g[currentlyEditingListKey] = stats
        await db.set("gListData", g)
        updateCounters(stats)
        setTimeout(() => {
            saveUI.markDone();
            setTimeout(() => saveUI.endLoader(), 1000);
        }, 500)
    }
    scheduleSnapshot() {
        if (this._isRestoring) return
        this._pendingSnapshot = this.snapshot()

        if (!this._snapshotTimer) {
            this._snapshotTimer = setTimeout(() => {
                if (this._pendingSnapshot) {
                    this.history.push(this._pendingSnapshot)
                    this._pendingSnapshot = null
                }
                this._snapshotTimer = null
            }, 500)
        }
    }
    addTask(data = "", status = "pending", parentId = null) {
        const task = {
            taskid: this._id(),
            data,
            status,
            children: [],
            color: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            completedAt: status === "done" ? Date.now() : null
        }

        this.tasks.push(task)
        this.index.set(task.taskid, task)

        if (parentId && this.index.has(parentId)) {
            this.index.get(parentId).children.push(task.taskid)
            this.parents.set(task.taskid, parentId)
        }
        this.scheduleSnapshot()

        this._commit()
        return task.taskid
    }
    update(taskid, key, value) {
        const t = this.index.get(taskid)
        if (!t || !(key in t)) return false

        if (key === "status") {
            t.status = value
            t.completedAt = value === "done" ? Date.now() : null
        } else {
            t[key] = value
        }

        t.updatedAt = Date.now()
        this.scheduleSnapshot()
        this._commit()
        console.log("tree update", taskid, key, value)
        return true
    }


    getDerivedStatus(taskid) {
        const t = this.index.get(taskid)
        if (!t) return null
        if (!t.children.length) return t.status
        let hasPending = false
        let allDone = true
        for (const cid of t.children) {
            const s = this.getDerivedStatus(cid)
            if (s !== "done") allDone = false
            if (s === "pending") hasPending = true
        }
        if (allDone) return "done"
        if (hasPending) return "pending"
        return "in-progress"
    }
    getStats() {
        const today = startOfToday().getTime()
        let totalTasks = 0
        let completedTasks = 0
        let lastCompletedTask = null
        let lastAddedTask = null
        let lastEditTask = null

        for (const t of this.tasks) {
            if (t.children.length) continue

            totalTasks++
            const createdAt = t.createdAt
            const updatedAt = t.updatedAt
            const completedAt = t.completedAt

            if (t.status === "done") {
                completedTasks++
                if (!lastCompletedTask || completedAt > lastCompletedTask.completedAt) {
                    lastCompletedTask = { taskid: t.taskid, completedAt }
                }
            }

            if (!lastAddedTask || createdAt > lastAddedTask.createdAt) {
                lastAddedTask = { taskid: t.taskid, createdAt }
            }

            if (!lastEditTask || updatedAt > lastEditTask.updatedAt) {
                lastEditTask = { taskid: t.taskid, updatedAt }
            }
        }

        const completedToday = lastCompletedTask && lastCompletedTask.completedAt >= today ? 1 : 0
        const createdToday = lastAddedTask && lastAddedTask.createdAt >= today ? 1 : 0

        return { totalTasks, completedTasks, completedToday, createdToday, lastCompletedTask, lastAddedTask, lastEdit: lastEditTask }
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
        this.scheduleSnapshot()
        this._commit()
        return true
    }

    moveTaskIdToNewParentTaskId(taskid, newParentId = null) {
        if (!this.index.has(taskid)) return false
        const oldParent = this.parents.get(taskid)
        if (oldParent && this.index.has(oldParent)) {
            const p = this.index.get(oldParent)
            if (Array.isArray(p.children)) {
                p.children = p.children.filter(c => c !== taskid)
            } else {
                p.children = []
            }
        }

        this.parents.delete(taskid)
        if (newParentId && this.index.has(newParentId)) {
            this.index.get(newParentId).children.push(taskid)
            this.parents.set(taskid, newParentId)
        }
        this.scheduleSnapshot()
        this._commit()
        return true
    }

    getRoots() { return this.tasks.filter(t => !this.parents.has(t.taskid)) }

    getTaskById(taskid) { return this.index.get(taskid) || null }

    snapshot() {
        return JSON.stringify({
            tasks: this.tasks,
            parents: [...this.parents.entries()]
        })
    }
    load(snapshot) {
        const s = JSON.parse(snapshot)
        this.tasks = s.tasks.map(t => ({ ...t, color: t.color ?? null }))
        this.parents = new Map(s.parents)
        this.index = new Map()
        for (const t of this.tasks) this.index.set(t.taskid, t)
    }


    _mutate(fn) {
        this.history.push(this.snapshot())
        fn()
        this._commit()
    }

    undo() {
        const s = this.history.undoState(this.snapshot())
        if (!s) return
        this._isRestoring = true
        this.load(s)
        this._commit()
        this._isRestoring = false
        renderTasks(tree,
            document.getElementById("tasks_main_tree"))
    }
    redo() {
        const s = this.history.redoState(this.snapshot())
        if (!s) return
        this._isRestoring = true
        this.load(s)
        this._commit()
        this._isRestoring = false
        renderTasks(tree,
            document.getElementById("tasks_main_tree"))
    }

}

function startOfToday() {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
}

let nodeCache = new Map()

function renderTasks(tree, container) {
    const used = new Set()
    const roots = tree.getRoots()

    for (const t of roots) {
        renderTask(tree, t, container, 0, "", false, used)
    }

    for (const [id, el] of nodeCache) {
        if (!used.has(id)) {
            el.remove()
            nodeCache.delete(id)
        }
    }
}
function renderTask(tree, task, container, depth, parentId, hidden, used) {
    let isDone = task.status === "done"

    if (task.children?.length) {
        let done = 0
        for (const id of task.children) {
            const c = tree.getTaskById(id)
            if (c && c.status === "done") done++
        }
        isDone = done === task.children.length
    }

    let wrap = nodeCache.get(task.taskid)

    if (!wrap) {
        wrap = createWrap(task, parentId, hidden)
        wrap._inner = createInner(depth, task)
        wrap._expand = createExpand(tree, task, container)
        let dataRem = createData(tree, task);
        wrap._data = dataRem[0];
        wrap._toggle = createCompletionToggle(tree, task, container, wrap)

        wrap._btns = document.createElement("div")
        wrap._btns.className = "task_btns"
        wrap._addBtn = createAddButton(tree, task, depth, container)
        wrap._delBtn = createDeleteButton(tree, task, container)
        wrap._btns.append(wrap._addBtn, wrap._delBtn)

        attachDragHandlers(wrap._inner, tree, task, wrap._expand, container, dataRem[1].input)

        wrap._inner.append(wrap._expand || "", wrap._data, wrap._toggle, wrap._btns)
        wrap.append(wrap._inner)
        nodeCache.set(task.taskid, wrap)
    }

    used.add(task.taskid)

    wrap.dataset.parent = parentId || ""

    updateHierarchyLines(wrap, depth)
    updateInnerLayout(wrap._inner, depth)
    const shouldHaveExpand = task.children?.length > 0

    if (shouldHaveExpand && !wrap._expand) {
        wrap._expand = createExpand(tree, task, container)
        wrap._inner.insertBefore(wrap._expand, wrap._inner.firstChild)
    }

    if (!shouldHaveExpand && wrap._expand) {
        wrap._expand.remove()
        wrap._expand = null
    }

    updateExpandState(wrap._expand, task)
    updateData(wrap._data, tree, task)
    updateCompletionToggle(wrap._toggle, isDone)
    wrap._inner.classList.toggle("done", isDone)

    container.appendChild(wrap)

    for (const id of task.children) {
        const child = tree.getTaskById(id)
        if (child) {
            renderTask(tree, child, container, depth + 1, task.taskid, false, used)
        }
    }

    return wrap
}


function toggleChildren(container, parentId, hide) {
    const rows = [...container.querySelectorAll(".ind_task")]
    const pid = String(parentId)

    for (const row of rows) {
        let p = row.dataset.parent
        while (p) {
            if (p === pid) {
                row.style.display = "none"
                break
            }
            const el = container.querySelector(`[data-taskid="${p}"]`)
            p = el ? el.dataset.parent : ""
        }
    }

    if (!hide) {
        for (const row of rows) {
            if (row.dataset.parent === pid) {
                row.style.display = ""
            }
        }
    }

    return !hide
}
function createExpand(tree, task, container) {
    if (!task.children.length) return null

    const expand = document.createElement("div")
    expand.className = "icn task_expand"

    const setState = open => {
        expand.textContent = "chevron_right"
        expand.style.transform = open ? "rotate(90deg)" : "rotate(0deg)"
    }

    const apply = () => {
        const open = !task.collapsed
        toggleChildren(container, task.taskid, task.collapsed)
        setState(open)
    }

    apply()

    expand.onclick = e => {
        e.stopPropagation()
        task.collapsed = !task.collapsed
        apply()
    }

    return expand
}
function updateHierarchyLines(wrap, depth) {
    const needed = depth + 1
    const lines = wrap.querySelectorAll(".task_hir_line")
    const current = lines.length

    if (current > needed) {
        for (let i = current - 1; i >= needed; i--) {
            lines[i].remove()
        }
    } else if (current < needed) {
        for (let i = current; i < needed; i++) {
            const line = document.createElement("div")
            line.className = "task_hir_line"
            wrap.prepend(line)
        }
    }

    wrap.querySelectorAll(".task_hir_line").forEach((l, i) => {
        l.style.left = (i * 4 - 0.8) + "em"
    })
}
function updateInnerLayout(inner, depth) {
    inner.style.marginLeft = depth * 4 + "em"
}

function updateExpandState(expand, task) {
    if (!expand) return
    expand.style.transform = task.collapsed ? "rotate(0deg)" : "rotate(90deg)"
}

function updateData(data, tree, task) {
    const input = data._input
    if (document.activeElement !== input && input.innerText !== task.data) {
        input.innerText = task.data
    }

    let status = task.status

    if (task.children?.length) {
        let done = 0
        for (const id of task.children) {
            const c = tree.getTaskById(id)
            if (c && c.status === "done") done++
        }
        status = done === task.children.length ? "done" : "pending"
        data._meta.innerHTML = progressPieSVG((done / task.children.length) * 100) + `${done}/${task.children.length} done`
    } else {
        data._meta.textContent = status
    }

    if (task.data.length === 0 && !input._autofocus) {
        input._autofocus = true
        setTimeout(() => input.focus(), 50)
    }
}

function updateCompletionToggle(toggle, isDone) {
    toggle.textContent = isDone ? "undo" : "check"
    toggle.classList.toggle("done", isDone)
}

function createWrap(task, parentId, hidden) {
    const wrap = document.createElement("div")
    wrap.className = "ind_task"
    wrap.dataset.taskid = task.taskid
    wrap.dataset.parent = parentId || ""
    if (hidden) wrap.style.display = "none"
    return wrap
}

function addHierarchyLines(wrap, depth) {
    for (let i = -1; i < depth; i++) {
        const line = document.createElement("div")
        line.className = "task_hir_line"
        line.style.left = (i * 4 + 3.2) + "em"
        wrap.appendChild(line)
    }
}

function createInner(depth, task) {
    const inner = document.createElement("div")
    inner.className = "task_inner"
    console.log(445, task)
    inner.style.border = `1px solid ${task.color || "var(--box-crisp-col)"}`
    inner.draggable = true

    let currentStatus = task.status;
    const isDone = currentStatus === "done";
    inner.classList.toggle("done", isDone);
    return inner
}

function createData(tree, task) {
    const data = document.createElement("div")
    data.className = "task_data"

    const input = document.createElement("div")
    input.className = "fakeInput"
    input.contentEditable = "true"
    input.tabIndex = 0
    input._taskid = task.taskid
    input._initialHeight = input.style.height
    input.innerText = task.data

    input.oninput = () => tree.update(input._taskid, "data", input.innerText)

    input.addEventListener("focus", () => {
        input.classList.add("focus")
        input.style.height = "auto"
        input.style.height = input.scrollHeight + 25 + "px"
        const r = document.createRange()
        r.selectNodeContents(input)
        const s = getSelection()
        s.removeAllRanges()
        s.addRange(r)
    })

    input.addEventListener("blur", () => {
        input.classList.remove("focus")
        input.style.height = input._initialHeight
        getSelection().removeAllRanges()
    })

    data._input = input
    data.appendChild(input)

    const meta = document.createElement("div")
    meta.className = "task_additional"
    data._meta = meta
    data.appendChild(meta)

    return [data, { input }]
}

function createCompletionToggle(tree, task, container, wrap) {
    const toggle = document.createElement("div")
    toggle.className = "completion_toggle icn"

    toggle.onclick = async () => {
        if (task.children?.length) {
            let done = 0
            for (const id of task.children) {
                const c = tree.getTaskById(id)
                if (c && c.status === "done") done++
            }
            const markDone = done !== task.children.length
            for (const id of task.children) {
                const c = tree.getTaskById(id)
                if (c) {
                    await tree.update(c.taskid, "status", markDone ? "done" : "pending")
                }
            }
        } else {
            const isDone = task.status === "done"
            await tree.update(task.taskid, "status", isDone ? "pending" : "done")
        }

        renderTasks(tree, container)
    }

    return toggle
}

function createAddButton(tree, task, depth, container) {
    const btn = document.createElement("div")
    btn.className = "new_task_btn task_btn"
    btn.innerHTML = `<div class="icn">add</div>`
    btn.onclick = () => {
        tree.addTask("", "pending", task.taskid)
        renderTasks(tree, container)
    }

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
    return btn
}
function createDeleteButton(tree, task, container) {
    const colors = {
        red: "#7a3b3b",
        blue: "#3b5f7a",
        green: "#3f6b52",
        yellow: "#7a6b3b",
        purple: "#5e4a7a"
    }
    const btn = document.createElement("div")
    btn.className = "del_task_btn task_btn dropdown"
    btn.innerHTML = `<div class="icn">more_vert</div>
<div class="dropdown_content">
    <div class="btngrp horiz"></div>
    <div class="btn">
        <div class="label">Delete task</div>
        <div class="icn">close</div>
    </div>
</div>`

    btn.querySelector(".dropdown_content .btn").addEventListener("click", e => {
        e.stopPropagation()
        tree.removeTask(task.taskid)
        renderTasks(tree, container)
    })

    const btnGrp = btn.querySelector(".btngrp")

    Object.entries(colors).forEach(([name, value]) => {
        const colorDiv = document.createElement("div")
        colorDiv.className = "btn colorBob"
        colorDiv.style.backgroundColor = value
        colorDiv.innerHTML = `<div class="tooltip">${name}</div>`;
        colorDiv.onclick = e => {
            e.stopPropagation()
            tree.update(task.taskid, "color", name)
            renderTasks(tree, container)
        }
        btnGrp.appendChild(colorDiv)
    })

    btn.onclick = e => {
        e.stopPropagation()
        btn.classList.toggle("open")
    }

    requestAnimationFrame(() => {
        const parentTask = btn.closest(".ind_task")
        if (parentTask) {
            parentTask.addEventListener("mouseleave", () => {
                btn.classList.remove("open")
            })
        }
    })

    return btn
}

function disableInput(input) {
    input.contentEditable = "false"
    input.style.userSelect = "none"
    input.blur()
}

function enableInput(input) {
    input.contentEditable = "true"
    input.style.userSelect = "auto"
}

function attachDragHandlers(inner, tree, task, expand, container, input) {
    inner.addEventListener("dragstart", e => {
        if (!task.collapsed) expand?.click()
        e.dataTransfer.setData("text/plain", task.taskid)
        inner.style.opacity = ".5"
        disableInput(input)

        const clone = inner.cloneNode(true)
        clone.style.position = "fixed"
        clone.style.top = "-1000px"
        document.body.appendChild(clone)
        e.dataTransfer.setDragImage(clone, 24, 24)
        setTimeout(() => document.body.removeChild(clone), 0)
    })

    inner.addEventListener("dragend", () => {
        inner.style.opacity = "1"
        inner.classList.remove("drag_over")
        enableInput(input)
    })

    inner.addEventListener("dragover", e => {
        e.preventDefault()
        inner.classList.add("drag_over")
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
        tree.moveTaskIdToNewParentTaskId(draggedId, task.taskid)
        renderTasks(tree, container)
    })
}

function renderChildren(tree, task, container, depth, hidden) {
    task.children.forEach(id => {
        const child = tree.getTaskById(id)
        if (child) renderTask(tree, child, container, depth + 1, task.taskid, hidden || task.collapsed)
    })
}

function attachAncestorHover(container) {
    container.onmouseover = e => toggleAncestorHover(e, true)
    container.onmouseout = e => toggleAncestorHover(e, false)
}

function toggleAncestorHover(e, on) {
    let row = e.target.closest(".ind_task")
    while (row) {
        row.classList.toggle("ancestor_hover", on)
        const pid = row.dataset.parent
        row = pid ? document.querySelector(`[data-taskid="${pid}"]`) : null
    }
}

function createTaskInput(tree, task) {
    const input = document.createElement("div")
    input.className = "fakeInput"
    input.contentEditable = "true"
    input.tabIndex = 0
    input._taskid = task.taskid
    input._initialHeight = input.style.height

    input.oninput = () => tree.update(input._taskid, "data", input.innerText)

    input.addEventListener("focus", () => {
        input.classList.add("focus")
        input.style.height = "auto"
        input.style.height = input.scrollHeight + 25 + "px"
        const r = document.createRange()
        r.selectNodeContents(input)
        const s = getSelection()
        s.removeAllRanges()
        s.addRange(r)
    })

    input.addEventListener("blur", () => {
        input.classList.remove("focus")
        input.style.height = input._initialHeight
        getSelection().removeAllRanges()
    })

    return input
}
function updateTaskInput(input, task) {
    if (document.activeElement !== input && input.innerText !== task.data) {
        input.innerText = task.data
    }

    if (task.data.length === 0 && !input._autofocus) {
        input._autofocus = true
        setTimeout(() => input.focus(), 50)
    }
}


function taskTreeFromJSON(json) {
    tree = new TaskTree()
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
            color: t.color,
            children: t.children,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
            completedAt: t.completedAt
        })),
        parents: [...tree.parents.entries()]
    }
}

function isDescendant(tree, id, target) {
    if (id === target) return true
    const t = tree.getTaskById(id)
    if (!t) return false
    for (const c of t.children) if (isDescendant(tree, c, target)) return true
    return false
}


async function loadUpList(key) {
    switchScreens("treeEditor");
    currentlyEditingListKey = key;

    nodeCache.forEach(el => el.remove())
    nodeCache.clear()

    renderTasks(
        taskTreeFromJSON(JSON.parse(await db.get(key))),
        document.getElementById("tasks_main_tree")
    );

    const gListData = await db.get("gListData") || {};
    document.getElementById("titleEditor").value = gListData[key]?.name || "";
    await updateCounters(tree.getStats());
}

const saveUI = {
    el: document.getElementById("saveStatus"),
    lastStart: 0,
    loader() {
        return this.el.querySelector(".loader");
    },
    startLoader() {
        const now = Date.now();
        if (now - this.lastStart < 2000) return;
        this.lastStart = now;
        this.el.classList.add("show");
        this.el.classList.remove("done");
        this.el.firstChild.textContent = "Saving… ";
        this.loader().classList.remove("done");
    },
    markDone() {
        this.el.firstChild.textContent = "Saved ";
        this.loader().classList.add("done");
        this.el.classList.add("done");
    },
    endLoader() {
        this.el.classList.remove("show");
    }
};
