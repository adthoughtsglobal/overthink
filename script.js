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

function renderTask(tree, task, container, depth, parentId = "") {

    const wrap = document.createElement("div")
    wrap.className = "ind_task"
    wrap.dataset.taskid = task.taskid
    wrap.dataset.parent = parentId || ""


    for (let i = -1; i < depth; i++) {
        const line = document.createElement("div")
        line.className = "task_hir_line"
        line.style.left = (i * 4) + 3.2 + "em"
        wrap.appendChild(line)
    }

    const inner = document.createElement("div")
    inner.className = "task_inner"
    inner.style.marginLeft = depth * 4 + "em"

    inner.draggable = true

    inner.addEventListener("dragstart", e => {
        e.dataTransfer.setData("text/plain", task.taskid)
        e.dataTransfer.effectAllowed = "move"
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

    let expand = false;
    if (task.children.length > 0) {
        expand = document.createElement("div")
        expand.className = "icn task_expand"
        expand.textContent = "chevron_right"
    }

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
            const el = renderTask(tree, child, container, depth + 1, task.taskid)
        }

    })
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

const tree = taskTreeFromJSON({
    "tasks": [
        {
            "taskid": "a1",
            "data": "Plan weekend",
            "status": "pending",
            "children": ["a2", "a3"]
        },
        {
            "taskid": "a2",
            "data": "Buy groceries",
            "status": "done",
            "children": ["a4", "a5"]
        },
        {
            "taskid": "a3",
            "data": "Fix bike",
            "status": "pending",
            "children": []
        },
        {
            "taskid": "a4",
            "data": "Milk and eggs",
            "status": "done",
            "children": []
        },
        {
            "taskid": "a5",
            "data": "Coffee beans",
            "status": "pending",
            "children": []
        },
        {
            "taskid": "b1",
            "data": "Learn something new",
            "status": "pending",
            "children": ["b2"]
        },
        {
            "taskid": "b2",
            "data": "Read about astrophysics",
            "status": "pending",
            "children": []
        }
    ]
})
renderTasks(tree, document.getElementById("tasks_main_tree"))

function isDescendant(tree, id, target) {
    if (id === target) return true
    const t = tree.getTaskById(id)
    if (!t) return false
    for (const c of t.children) if (isDescendant(tree, c, target)) return true
    return false
}

