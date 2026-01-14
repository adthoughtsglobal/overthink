class TaskTree {
    constructor() {
        this.tasks = []
        this.index = new Map()
    }

    _id() {
        return crypto.randomUUID()
    }

    _removeRef(id) {
        for (const t of this.tasks) {
            t.children = t.children.filter(c => c !== id)
        }
    }

    addTaskToTaskId(data = "", status = "pending", parentId = null) {
        const taskid = this._id()
        const task = { taskid, data, status, children: [] }
        this.tasks.push(task)
        this.index.set(taskid, task)
        if (parentId && this.index.has(parentId)) {
            this.index.get(parentId).children.push(taskid)
        }
        return taskid
    }

    removeTaskById(taskid) {
        const task = this.index.get(taskid)
        if (!task) return false
        for (const c of task.children) this.removeTaskById(c)
        this._removeRef(taskid)
        this.tasks = this.tasks.filter(t => t.taskid !== taskid)
        this.index.delete(taskid)
        return true
    }

    editTaskById(taskid, key, value) {
        const task = this.index.get(taskid)
        if (!task || !(key in task)) return false
        task[key] = value
        return true
    }

    moveTaskIdToNewParentTaskId(taskid, newParentId = null) {
        if (!this.index.has(taskid)) return false
        this._removeRef(taskid)
        if (newParentId && this.index.has(newParentId)) {
            this.index.get(newParentId).children.push(taskid)
        }
        return true
    }

    getTaskById(taskid) {
        return this.index.get(taskid) || null
    }
}
function renderTasks(tree, container) {
    container.innerHTML = ""
    const roots = tree.tasks.filter(t => !tree.tasks.some(p => p.children.includes(t.taskid)))
    roots.forEach(t => renderTask(tree, t, container, 0))
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
    input.addEventListener("focus", () => {
        input.classList.add("focus")
        const range = document.createRange()
        range.selectNodeContents(input)
        const sel = window.getSelection()
        sel.removeAllRanges()
        sel.addRange(range)
    })
    input.addEventListener("blur", () => {
        input.classList.remove("focus")
        const sel = window.getSelection()
        sel.removeAllRanges()
    })


    input.addEventListener("input", () => {
        task.data = input.innerText
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

var tree = new TaskTree();
function taskTreeFromJSON(json) {
    for (const t of json.tasks) {
        const task = { taskid: t.taskid, data: t.data, status: t.status, children: [...t.children] }
        tree.tasks.push(task)
        tree.index.set(task.taskid, task)
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

taskTreeFromJSON({
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