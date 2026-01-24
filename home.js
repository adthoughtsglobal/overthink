const db = new IDBKV('OverthinkLocalRepo', 'lists');
let dblistkeys;
let renderToken = 0;

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
    document.getElementById("homeInps").style.display = screen === "listsGrid" ? "flex" : "none"
    document.getElementById("file_actions").style.display = screen === "listsGrid" ? "none" : "flex"
}

function progressPieSVG(percent, size = 100, stroke = 10) {
    if (isNaN(percent)) percent = 100;
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

async function renderTimeStats() {
    let bannerText;
    if (dblistkeys && dblistkeys.length >= 1) {
        bannerText = `You have ${(dblistkeys.length == 1) ? "an" : dblistkeys.length} open list${(dblistkeys.length == 1) ? "" : "s"}.`
    } else {
        bannerText = "This is the homepage, where all your future lists live.";
    }
    document.getElementById("BannerStatusText").innerHTML = bannerText;

    if (!dblistkeys) return;
    const gListData = await db.get("gListData") || {}

    let totalDone = 0
    let doneToday = 0
    let createdToday = 0
    let totalTasks = 0

    for (const s of Object.values(gListData)) {
        totalDone += s.completedTasks || 0
        doneToday += s.completedToday || 0
        createdToday += s.createdToday || 0
        totalTasks += s.totalTasks || 0
    }

    const setOrHide = (selector, value) => {
        const el = document.querySelector(selector);
        if (el) {
            console.log(el.parentElement, value)
            el.parentElement.style.display = value ? "" : "none";
            el.textContent = value;
        }
    }

    setOrHide('[data-need="totalDone"]', totalDone)
    setOrHide('[data-need="totalTasks"]', totalTasks)
    setOrHide('[data-need="totalDoneToday"]', doneToday)
    setOrHide('[data-need="createdToday"]', createdToday)
}
function makeListEl(key) {
    const el = document.createElement("div");
    el.className = "singList dropdown";
    el.dataset.key = key;

    const statusIcon = document.createElement("div");
    statusIcon.className = "statusicn";

    const title = document.createElement("div");
    title.className = "title";

    const separator = document.createElement("div");
    separator.className = "seperator";

    const moreOptions = document.createElement("div");
    moreOptions.className = "icn moreOptions";
    moreOptions.textContent = "more_vert";
    moreOptions.onclick = e => {
        e.stopPropagation();
        e.preventDefault();
        createDropDownMenu(moreOptions);
    };

    el.append(statusIcon, title, separator, moreOptions);
    el.onclick = () => loadUpList(key);

    return el;
}

async function renderLists() {
    const token = ++renderToken;
    const root = eleObjs.listsList;
    const pinnedRoot = document.getElementById("pinnedListsList");

    const loadingTimer = setTimeout(() => {
        if (token === renderToken && !root.childNodes.length) {
            const s = document.createElement("span");
            s.className = "awaittext";
            s.textContent = "Loading...";
            root.replaceChildren(s);
        }
    }, 1000);

    let keys = (await db.keys()).filter(k => k !== "gListData").sort();
    if (token !== renderToken) return;

    if (!keys.length) {
        clearTimeout(loadingTimer);
        const s = document.createElement("span");
        s.className = "awaittext";
        s.textContent = "Click + to make your first list!";
        root.replaceChildren(s);
        const d = document.createElement("span");
        d.className = "awaittext";
        d.textContent = "Lists you pin show up here.";
        if (pinnedRoot) pinnedRoot.replaceChildren(d);
        document.getElementById("welcomeheading").innerText = "Welcome to Overthink!";
        document.getElementById("statdisplay").style.opacity = "0";
        renderTimeStats();
        return;
    }

    document.getElementById("statdisplay").style.opacity = "1";
    clearTimeout(loadingTimer);

    const gListData = await db.get("gListData") || {};
    if (token !== renderToken) return;

    const existing = new Map([...root.children].map(n => [n.dataset.key, n]));
    const pinnedExisting = new Map(pinnedRoot ? [...pinnedRoot.children].map(n => [n.dataset.key, n]) : []);

    const frag = document.createDocumentFragment();
    const pinnedFrag = document.createDocumentFragment();

    for (const key of keys) {
        let el = existing.get(key) || makeListEl(key);

        const data = gListData[key];
        let x = 0;
        if (data) {
            x = (data.completedTasks / data.totalTasks * 100);
            el.querySelector(".title").textContent = data.name || key;
        }

        const statusIcon = el.querySelector(".statusicn");
        statusIcon.innerHTML = progressPieSVG(x);
        statusIcon.style.display = "";

        frag.appendChild(el);
        existing.delete(key);

        if (pinnedRoot && data?.pinned) {
            let pel = pinnedExisting.get(key) || makeListEl(key);

            const pStatusIcon = pel.querySelector(".statusicn");
            pStatusIcon.innerHTML = progressPieSVG(x);
            pStatusIcon.style.display = "";
            pel.querySelector(".title").textContent = data.name || key;

            pinnedFrag.appendChild(pel);
            pinnedExisting.delete(key);
        }
    }

    if (token !== renderToken) return;

    root.replaceChildren(frag);

    if (pinnedRoot) {
        pinnedRoot.replaceChildren(pinnedFrag);
        if (pinnedRoot.childElementCount < 1) {
            const d = document.createElement("span");
            d.className = "awaittext";
            d.innerHTML = "Open list options menu (<a class='icn'>more_vert</a>) to pin lists.";
            pinnedRoot.replaceChildren(d);
        }
    }

    dblistkeys = keys;
    renderTimeStats();
}


document.addEventListener("DOMContentLoaded", async () => {
    await renderLists();
    document.getElementById("titleEditor").addEventListener("keyup", (key) => {
        tree._commit();
    })
    document.addEventListener("keydown", (key) => {
        if (key.ctrlKey && key.key == "s") {
            key.preventDefault();
            tree._commit();
        }
    })
});

function switchlistview(newview, elem) {
    document.querySelectorAll(".viewctrls>.icn").forEach(x => x.classList.remove("active"));
    elem.classList.add("active");

    const list = document.getElementById("listsList");
    list.classList.remove("grid", "list");
    list.classList.add(newview);

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

    async function closeDropdown(e) {
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
                case "pin":
                    const gListData = await db.get("gListData") || {};
                    if (!gListData[thelistsid]?.pinned) {
                        gListData[thelistsid].pinned = 1;
                        await db.set("gListData", gListData)
                    } else {
                        gListData[thelistsid].pinned = 0;
                        await db.set("gListData", gListData)
                    }
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
    document.getElementById("titleEditor").focus();
}

function updateCounters(stats) {
    let completitionpercent = stats.completedTasks / stats.totalTasks * 100;
    if (isNaN(completitionpercent)) completitionpercent = 100;
    document.getElementById("in_file_completition_text").innerHTML = completitionpercent.toPrecision(3) + "% done";
    document.getElementById("in_file_completition_bar").style.width = completitionpercent + "%"
}