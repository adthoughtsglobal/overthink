const notesArray = [];

function createCard({ title = "", body = "Editable note content." } = {}) {
    const noteData = { title, body };
    notesArray.push(noteData);

    const originalData = { ...noteData };

    const singularNote = document.createElement("div");
    singularNote.className = "singular_note";

    const noteNav = document.createElement("div");
    noteNav.className = "note_nav";

    const noteTitle = document.createElement("h1");
    noteTitle.className = "note_title";
    noteTitle.contentEditable = "true";
    noteTitle.innerText = noteData.title;

    const noteOptions = document.createElement("div");
    noteOptions.className = "note_options msr btn";
    noteOptions.innerText = "delete";
    noteOptions.addEventListener("click", () => {
        const index = notesArray.indexOf(noteData);
        if (index !== -1) {
            notesArray.splice(index, 1);
        }
        singularNote.remove();
    });

    const notePara = document.createElement("div");
    notePara.className = "note_para";
    notePara.contentEditable = "true";
    notePara.innerText = noteData.body;

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "button-container";

    const saveButton = document.createElement("button");
    saveButton.innerHTML = `Save <i class="msr btn">check</i>`;
    saveButton.classList.add("btnrl");

    const discardButton = document.createElement("button");
    discardButton.innerHTML = `Discard <i class="msr btn">close</i>`;
    discardButton.classList.add("btnrl", "greybtn");

    saveButton.addEventListener("click", () => {
        noteData.title = noteTitle.innerText;
        noteData.body = notePara.innerText;
        originalData.title = noteData.title;
        originalData.body = noteData.body;
        buttonContainer.classList.remove("visible");
        glow(singularNote);
    });

    discardButton.addEventListener("click", () => {
        noteTitle.innerText = originalData.title;
        notePara.innerText = originalData.body;
        buttonContainer.classList.remove("visible");
        glow(singularNote);
    });

    const showButtonsIfChanged = () => {
        const titleChanged = noteTitle.innerText !== originalData.title;
        const bodyChanged = notePara.innerText !== originalData.body;
        if (titleChanged || bodyChanged) {
            buttonContainer.classList.add("visible");
        } else {
            buttonContainer.classList.remove("visible");
        }
    };

    noteTitle.addEventListener("input", showButtonsIfChanged);
    notePara.addEventListener("input", showButtonsIfChanged);

    noteTitle.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            notePara.focus();
        }
    });

    notePara.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            saveButton.click();
        }
    });

    buttonContainer.appendChild(saveButton);
    buttonContainer.appendChild(discardButton);

    noteNav.appendChild(noteTitle);
    noteNav.appendChild(noteOptions);
    singularNote.appendChild(noteNav);
    singularNote.appendChild(notePara);
    singularNote.appendChild(buttonContainer);

    document.getElementById("notes").appendChild(singularNote);
    noteTitle.focus();
}

function glow(element) {
    element.classList.add("glow");
    setTimeout(() => {
        element.classList.remove("glow");
    }, 1000);
}

createCard({ title: "", body: "" });
