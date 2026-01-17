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
const nodeCache = new Map()

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

    let wrap = nodeCache.get(task.taskid)

    if (!wrap) {
        wrap = createWrap(task, parentId, hidden)
        wrap._inner = createInner(depth)
        wrap._expand = createExpand(tree, task, container)
        wrap._data = createData(tree, task)
        wrap._toggle = createCompletionToggle()
        wrap._addBtn = createAddButton(tree, task, depth, container)
        wrap._delBtn = createDeleteButton(tree, task, container)

        attachDragHandlers(wrap._inner, tree, task, wrap._expand, container)

        wrap._inner.append(wrap._expand || "", wrap._data, wrap._toggle, wrap._delBtn)
        wrap.append(wrap._inner, wrap._addBtn)
        nodeCache.set(task.taskid, wrap)
    }

    used.add(task.taskid)

    wrap.dataset.parent = parentId || ""
    wrap.style.display = hidden ? "none" : ""

    updateHierarchyLines(wrap, depth)
    updateInnerLayout(wrap._inner, depth)
    updateExpandState(wrap._expand, task)
    updateData(wrap._data, tree, task)
    updateAddButton(wrap._addBtn, depth)

    container.appendChild(wrap)

    for (const id of task.children) {
        const child = tree.getTaskById(id)
        if (child) {
            renderTask(tree, child, container, depth + 1, task.taskid, hidden || task.collapsed, used)
        }
    }

    if (task.collapsed && !hidden) {
        toggleChildren(tree, container, task.taskid, true)
    }

    return wrap
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

    data._meta.textContent =
        task.children?.length ? `${task.children.length} subtasks • Pending` : "Pending"

    if (task.data.length === 0 && !input._autofocus) {
        input._autofocus = true
        setTimeout(() => input.focus(), 50)
    }
}

function updateAddButton(btn, depth) {
    btn.style.marginLeft = depth * 4 + "em"
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

function createInner(depth) {
    const inner = document.createElement("div")
    inner.className = "task_inner"
    inner.style.marginLeft = depth * 4 + "em"
    inner.draggable = true
    return inner
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

function attachDragHandlers(inner, tree, task, expand, container) {
    inner.addEventListener("dragstart", e => {
        if (!task.collapsed) expand?.click()
        e.dataTransfer.setData("text/plain", task.taskid)
        inner.style.opacity = ".5"
        disableInput()

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
        enableInput()
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

    return data
}

function createCompletionToggle() {
    const toggle = document.createElement("div")
    toggle.className = "completion_toggle icn"
    toggle.textContent = "check"
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

function toggleChildren(tree, container, parentId, hide) {
    const rows = [...container.querySelectorAll(".ind_task")]
    let active = false

    for (const row of rows) {
        if (row.dataset.taskid === String(parentId)) {
            active = true
            continue
        }
        if (!active || !row.dataset.parent) break

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
            row.style.height = row.scrollHeight + "px"
            row.offsetHeight
            row.style.height = "0px"
            setTimeout(() => row.style.display = "none", 250)
        } else {
            if (row.style.display !== "none") continue
            row.style.display = ""
            row.style.height = "0px"
            row.offsetHeight
            row.style.height = row.scrollHeight + "px"
            setTimeout(() => row.style.height = "", 250)
        }
    }
}

function disableInput() {
    input.contentEditable = "false"
    input.style.userSelect = "none"
    input.blur()
}

function enableInput() {
    input.contentEditable = "true"
    input.style.userSelect = "auto"
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

const db = new IDBKV('OverthinkLocalRepo', 'lists');

document.addEventListener("DOMContentLoaded", async () => {
    const keys = await db.keys();
    if (!keys.length) {
        await db.set(crypto.randomUUID(), '{"tasks":[{"taskid":"t1","data":"Hello","status":"done","children":["1b020355-0700-4cc4-9eb8-ff8d970abdfe"]},{"taskid":"t2","data":"world","status":"done","children":["8dd11219-56e6-4d1e-bffa-6ac621c9a344"]},{"taskid":"1b020355-0700-4cc4-9eb8-ff8d970abdfe","data":"the first thing to be said on a phone?","status":"pending","children":[]},{"taskid":"8dd11219-56e6-4d1e-bffa-6ac621c9a344","data":"simulation or real life?","status":"pending","children":[]}]}');
    }
    keys.forEach(item => {
        const element = document.createElement("div");
        element.classList.add("singList");
        element.onclick = async () => {
            switchScreens('treeEditor');
            renderTasks(taskTreeFromJSON(JSON.parse(await db.get(item))), document.getElementById("tasks_main_tree"))
        }
        const statusIcon = document.createElement('div');
        statusIcon.className = 'statusicn';
        statusIcon.innerHTML = progressPieSVG(0);

        const title = document.createElement('div');
        title.className = 'title';
        title.textContent = item;

        const separator = document.createElement('div');
        separator.className = 'seperator';

        const moreOptions = document.createElement('div');
        moreOptions.className = 'icn moreOptions';
        moreOptions.textContent = 'more_vert';

        element.append(statusIcon, title, separator, moreOptions);

        eleObjs.listsList.appendChild(element)
    });

    let bannerText = "Up next: <b>" + keys[0] + "</b>";
    if (keys.length > 1) {
        bannerText = `You have ${keys.length} open lists.`
    }
    document.getElementById("BannerStatusText").innerHTML = bannerText;
})