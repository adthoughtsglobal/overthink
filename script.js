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

    const input = document.createElement("input")
    input.type = "text"
    input.value = task.data

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

    inner.append((expand)?expand:'', data, toggle)

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

const tree = new TaskTree()

const root = tree.addTaskToTaskId("Prepare product launch")

const research = tree.addTaskToTaskId("Market research", false, root)
tree.addTaskToTaskId("Identify target audience", false, research)
tree.addTaskToTaskId("Analyze competitors", false, research)
tree.addTaskToTaskId("Define value proposition", false, research)

const product = tree.addTaskToTaskId("Finalize product", false, root)
const features = tree.addTaskToTaskId("Lock features", false, product)
tree.addTaskToTaskId("Core functionality", false, features)
tree.addTaskToTaskId("Edge cases", false, features)
tree.addTaskToTaskId("Performance constraints", false, features)

const qa = tree.addTaskToTaskId("Quality assurance", false, product)
tree.addTaskToTaskId("Unit tests", false, qa)
tree.addTaskToTaskId("Integration tests", false, qa)
tree.addTaskToTaskId("Regression tests", false, qa)

const marketing = tree.addTaskToTaskId("Marketing rollout", false, root)
const content = tree.addTaskToTaskId("Content creation", false, marketing)
tree.addTaskToTaskId("Landing page copy", false, content)
tree.addTaskToTaskId("Email campaign", false, content)
tree.addTaskToTaskId("Social media posts", false, content)

const ops = tree.addTaskToTaskId("Operations", false, root)
tree.addTaskToTaskId("Deployment plan", false, ops)
tree.addTaskToTaskId("Monitoring setup", false, ops)
tree.addTaskToTaskId("Rollback strategy", false, ops)

renderTasks(tree, document.getElementById("tasks_main_tree"))
