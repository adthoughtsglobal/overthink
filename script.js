var tree, currentlyEditingListKey = null;
const db = new IDBKV('OverthinkLocalRepo', 'lists');
class TaskTree {
    constructor(db, key) {
        this.tasks = []
        this.index = new Map()
        this.parents = new Map()
        this.db = db
        this.key = key
    }

    _id() { return crypto.randomUUID() }

    _commit() {
        const currenttreejson = JSON.stringify(taskTreeToJSON(this))
        db.set(currentlyEditingListKey, currenttreejson)
    }

    addTask(data = "", status = "pending", parentId = null) {
        const taskid = this._id()
        const now = Date.now()
        const task = { taskid, data, status, children: [], createdAt: now, updatedAt: now, completedAt: status === "done" ? now : null }
        this.tasks.push(task)
        this.index.set(taskid, task)
        if (parentId && this.index.has(parentId)) {
            this.index.get(parentId).children.push(taskid)
            this.parents.set(taskid, parentId)
        }
        this._commit()
        return taskid
    }

    update(taskid, key, value) {
        const t = this.index.get(taskid)
        if (!t || !(key in t)) return false
        t[key] = value
        t.updatedAt = Date.now()
        if (key === "status" && value === "done") t.completedAt = t.updatedAt
        this._commit()
        return true
    }

    getStats() {
        let total = this.tasks.length
        let completed = 0
        let lastCompleted = null
        let lastAdded = null
        let lastModified = null
        let lastEdit = null

        for (const t of this.tasks) {
            if (t.status === "done") {
                completed++
                if (!lastCompleted || t.completedAt > lastCompleted.completedAt) {
                    lastCompleted = { taskid: t.taskid, completedAt: t.completedAt }
                }
            }
            if (!lastAdded || t.createdAt > lastAdded.createdAt) lastAdded = t
            if (!lastModified || t.updatedAt > lastModified.updatedAt) lastModified = t
        }

        if (lastModified) lastEdit = { taskid: lastModified.taskid, updatedAt: lastModified.updatedAt }

        return {
            totalTasks: total,
            completedTasks: completed,
            lastCompletedTask: lastCompleted,
            lastAddedTask: lastAdded ? { taskid: lastAdded.taskid, createdAt: lastAdded.createdAt } : null,
            lastModified: lastModified ? lastModified.updatedAt : null,
            lastEdit
        }
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
        this._commit()
        return true
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
        this._commit()
        return true
    }

    getRoots() { return this.tasks.filter(t => !this.parents.has(t.taskid)) }

    getTaskById(taskid) { return this.index.get(taskid) || null }
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
        wrap._addBtn = createAddButton(tree, task, depth, container)
        wrap._delBtn = createDeleteButton(tree, task, container)

        attachDragHandlers(wrap._inner, tree, task, wrap._expand, container, dataRem[1].input)

        wrap._inner.append(wrap._expand || "", wrap._data, wrap._toggle, wrap._delBtn)
        wrap.append(wrap._inner, wrap._addBtn)
        nodeCache.set(task.taskid, wrap)
    }

    used.add(task.taskid)

    wrap.dataset.parent = parentId || ""

    updateHierarchyLines(wrap, depth)
    updateInnerLayout(wrap._inner, depth)
    updateExpandState(wrap._expand, task)
    updateData(wrap._data, tree, task)
    updateAddButton(wrap._addBtn, depth)
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
function toggleChildren(tree, container, parentId, hide) {
    const rows = [...container.querySelectorAll(".ind_task")]
    let active = false

    for (const row of rows) {
        if (row.dataset.taskid === String(parentId)) {
            active = true
            continue
        }
        if (!active) continue
        if (!row.dataset.parent) continue

        let p = row.dataset.parent
        let isDescendant = false

        while (p) {
            if (p === String(parentId)) {
                isDescendant = true
                break
            }
            const el = container.querySelector(`[data-taskid="${p}"]`)
            p = el ? el.dataset.parent : ""
        }

        if (!isDescendant) continue

        row.style.display = hide ? "none" : ""
    }
}

function createExpand(tree, task, container) {
    if (!task.children.length) return null
    const expand = document.createElement("div")
    expand.className = "icn task_expand"
    expand.textContent = "chevron_right"
    expand.style.transform = task.collapsed ? "rotate(0deg)" : "rotate(90deg)"
    expand.onclick = e => {
        e.stopPropagation()
        task.collapsed = !task.collapsed
        if (task.collapsed) {
            expand.style.transform = "rotate(0deg)";
        } else {
            expand.style.transform = "rotate(90deg)";
        }
        toggleChildren(tree, container, task.taskid, task.collapsed)
    }
    return expand
}



function updateHierarchyLines(wrap, depth) {
    const lines = wrap.querySelectorAll(".task_hir_line")
    const needed = depth + 1
    while (lines.length > needed) lines[lines.length - 1].remove()
    while (wrap.querySelectorAll(".task_hir_line").length < needed) {
        const i = wrap.querySelectorAll(".task_hir_line").length - 1
        const line = document.createElement("div")
        line.className = "task_hir_line"
        wrap.prepend(line)
    }
    wrap.querySelectorAll(".task_hir_line").forEach((l, i) => {
        l.style.left = (i * 4 - .8) + "em"
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
        data._meta.textContent = `${done}/${task.children.length} done`
    } else {
        data._meta.textContent = status
    }

    if (task.data.length === 0 && !input._autofocus) {
        input._autofocus = true
        setTimeout(() => input.focus(), 50)
    }
}


function updateAddButton(btn, depth) {
    btn.style.marginLeft = depth * 4 + "em"
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
    inner.style.marginLeft = depth * 4 + "em"
    inner.draggable = true

    let currentStatus = task.status;
    const isDone = currentStatus === "done";
    inner.classList.toggle("done", isDone);
    return inner
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
        e.dataTransfer.setDragImage(clone, clone.offsetWidth / 2, clone.offsetHeight / 2)
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
        tree.update(draggedId, "collapsed", false)
        tree.moveTaskIdToNewParentTaskId(draggedId, task.taskid)
        renderTasks(tree, container)
    })
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
    btn.style.marginLeft = depth * 4 + "em"
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
    const btn = document.createElement("div")
    btn.className = "del_task_btn task_btn"
    btn.innerHTML = `<div class="icn">delete</div>`
    btn.onclick = () => {
        tree.removeTask(task.taskid);
        renderTasks(tree, container)
    }
    return btn
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
            children: [...t.children]
        }))
    }
}

function isDescendant(tree, id, target) {
    if (id === target) return true
    const t = tree.getTaskById(id)
    if (!t) return false
    for (const c of t.children) if (isDescendant(tree, c, target)) return true
    return false
}

var eleObjs = {
    allWinCont: document.querySelector("#charlie"),
    listsList: document.querySelector("#listsList")
}
let currentScreen = null;
function switchScreens(screen) {
    if (screen === currentScreen) return
    currentScreen = screen

    const screens = [...eleObjs.allWinCont.querySelectorAll(".screen")]
    const next = eleObjs.allWinCont.querySelector(`#${screen}.screen`)
    const current = screens.find(s => s.classList.contains("active"))

    if (screen === "listsGrid")
        renderLists();

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
    next.offsetHeight
    next.classList.add("active")
    document.getElementById("listSearchInput").style.display = screen === "listsGrid" ? "flex" : "none"
    document.getElementById("file_actions").style.display = screen === "listsGrid" ? "none" : "flex"
}

function progressPieSVG(percent, size = 100, stroke = 10) {
    if (percent === 100) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#4a4a4a" stroke-width="${stroke}"/>
            <polyline points="30,53 45,68 70,35" fill="none" stroke="#54ff54" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
    }
    if (percent === 0) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#4a4a4a" stroke-width="${stroke}"/>
            <line x1="35" y1="35" x2="65" y2="65" stroke="#ff5454" stroke-width="${stroke}" stroke-linecap="round"/>
            <line x1="65" y1="35" x2="35" y2="65" stroke="#ff5454" stroke-width="${stroke}" stroke-linecap="round"/>
        </svg>`;
    }
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference * (1 - percent / 100);
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="#4a4a4a" stroke-width="${stroke}"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${radius}" fill="none" stroke="#54ff54" stroke-width="${stroke}" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    </svg>`;
}

switchScreens("listsGrid");

let dblistkeys;
async function renderLists() {
    const root = eleObjs.listsList;
    let loadingTimer = setTimeout(() => {
        if (!root.childNodes.length) {
            const s = document.createElement("span");
            s.className = "awaittext";
            s.textContent = "Loading...";
            root.replaceChildren(s);
        }
    }, 1000);

    let keys = await db.keys();
    if (!keys.length) {
        const s = document.createElement("span");
        s.className = "awaittext";
        s.textContent = "Click + to make your first list!";
        root.replaceChildren(s);
        keys = await db.keys();
        document.getElementById("welcomeheading").innerText = "Welcome to Overthink!";
        document.getElementById("statdisplay").style.opacity = "0";
        return;
    }
    document.getElementById("statdisplay").style.opacity = "1";

    clearTimeout(loadingTimer);

    const existing = new Map(
        [...root.children].map(n => [n.dataset.key, n])
    );

    const frag = document.createDocumentFragment();

    keys.forEach(key => {
        let el = existing.get(key);
        if (!el) {
            el = document.createElement("div");
            el.className = "singList dropdown";
            el.dataset.key = key;

            const statusIcon = document.createElement("div");
            statusIcon.className = "statusicn";
            statusIcon.innerHTML = progressPieSVG(0);

            const title = document.createElement("div");
            title.className = "title";

            const separator = document.createElement("div");
            separator.className = "seperator";

            const moreOptions = document.createElement("div");
            moreOptions.className = "icn moreOptions";
            moreOptions.textContent = "more_vert";
            moreOptions.onclick = (event) => {
                event.stopPropagation()
                event.preventDefault();
                createDropDownMenu(moreOptions)
            }

            el.append(statusIcon, title, separator, moreOptions);

            el.onclick = async () => {
                loadUpList(key)
            };
        }

        const title = el.querySelector(".title");
        if (title.textContent !== key) title.textContent = key;

        frag.appendChild(el);
        existing.delete(key);
    });

    existing.forEach(n => n.remove());
    root.appendChild(frag);

    dblistkeys = keys;
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
}

document.addEventListener("DOMContentLoaded", async () => {
    await renderLists();
    let bannerText = "This is the homepage, where all your future lists live.";
    if (dblistkeys) {
        bannerText = "Up next: <b>" + dblistkeys[0] + "</b>";
        if (dblistkeys.length > 1) {
            bannerText = `You have ${dblistkeys.length} open lists.`
        }
    }
    document.getElementById("BannerStatusText").innerHTML = bannerText;
})

function switchlistview(newview) {
    document.getElementById("listsList").className = newview;
    renderLists();
}

async function newEmptyList() {
    let x = crypto.randomUUID();
    await db.set(x, '{"tasks":[{"taskid":"t1","data":"Hello","status":"pending", "children": []}]}');
    return x;
}

let elementcache = null;
function createDropDownMenu(element) {
    var dropdown = document.getElementById("listManageDropdown");
    if (elementcache === element) {
        elementcache = null;
        element.classList.remove("active");
        dropdown.style.display = "none";
        return;
    }

    var rect = element.getBoundingClientRect();
    dropdown.style.position = "absolute";
    dropdown.style.left = rect.left + window.scrollX - 115 + "px";
    dropdown.style.top = rect.top + window.scrollY + 45 + "px";
    dropdown.style.display = "block";
    element.classList.add("active");
    elementcache = element;

    function closeDropdown(e) {
        if (!dropdown.contains(e.target) && e.target !== element) {
            dropdown.style.display = "none";
            element.classList.remove("active");
            elementcache = null;
            document.removeEventListener("click", closeDropdown);
        } else {
            let outtask = e.target.closest(".btn");
            let thetask = outtask?.getAttribute("data-todo");
            let thelist = element.closest(".singList");
            let thelistsid = thelist.dataset.key;
            switch (thetask) {
                case "delete":
                    db.delete(thelistsid);
                    renderLists();
                    dropdown.style.display = "none";
                    break;
            }
        }
    }

    setTimeout(() => document.addEventListener("click", closeDropdown), 0);
}

async function UInewEmptyList() {
    let x = await newEmptyList();
    loadUpList(x);
}