const notesArray = [];

function createCard({ title = "Give a title...", body = "What would be happening by then? A brief summary would fit just right." } = {}) {
    const noteData = { title, body };
    notesArray.push(noteData);

    const originalData = { ...noteData };

    const singularNote = document.createElement("div");
    singularNote.className = "singular_note";

    const noteNav = document.createElement("div");
    noteNav.className = "note_nav";

    const noteTitleInput = document.createElement("input");
    noteTitleInput.className = "note_title";
    noteTitleInput.type = "text";
    noteTitleInput.setAttribute("placeholder", noteData.title);

    const noteOptions = document.createElement("div");
    noteOptions.className = "note_options";

    const delbtn = document.createElement("div");
    delbtn.className = " btn toolticont";
    delbtn.innerHTML = `<div class="tooltip">
                        <div class="tooltitit">Delete</div>
                        <kbd>CTRL</kbd> + <kbd>D</kbd>
                    </div><i class="msr">delete</i>
    
    `;
    delbtn.addEventListener("click", () => {
        const index = notesArray.indexOf(noteData);
        if (index !== -1) {
            notesArray.splice(index, 1);
        }
        singularNote.remove();
    });

    const time = document.createElement("div");
    time.className = "btn time_btn";
    time.innerText = "09:00 - 09:30 AM";
    time.addEventListener("click", () => {

    });

    noteOptions.appendChild(time);
    noteOptions.appendChild(delbtn);

    const noteTextarea = document.createElement("textarea");
    noteTextarea.className = "note_para";
    noteTextarea.setAttribute("placeholder", noteData.body);

    const resizeTextarea = () => {
        noteTextarea.style.height = "auto";
        noteTextarea.style.height = noteTextarea.scrollHeight + "px";
    };

    noteTextarea.addEventListener("input", () => {
        resizeTextarea();
        showButtonsIfChanged();
    });

    resizeTextarea();

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "button-container";

    const saveButton = document.createElement("button");
    saveButton.innerHTML = `<div class="tooltip">
                        <div class="tooltitit">Save task</div>
                        <kbd>ENTER</kbd> </div><span>Save </span>  <i class="msr btn">check</i>
    `;
    saveButton.classList.add("toolticont");
    saveButton.classList.add("btnrl");

    const discardButton = document.createElement("button");
    discardButton.innerHTML = `Discard <i class="msr btn">close</i>`;
    discardButton.classList.add("btnrl", "greybtn");

    saveButton.addEventListener("click", () => {
        noteData.title = noteTitleInput.value;
        noteData.body = noteTextarea.value;
        originalData.title = noteData.title;
        originalData.body = noteData.body;
        buttonContainer.classList.remove("visible");
        glow(singularNote);
    });

    discardButton.addEventListener("click", () => {
        noteTitleInput.value = originalData.title;
        noteTextarea.value = originalData.body;
        buttonContainer.classList.remove("visible");
        glow(singularNote);
    });

    const showButtonsIfChanged = () => {
        const titleChanged = noteTitleInput.value !== originalData.title;
        const bodyChanged = noteTextarea.value !== originalData.body;
        const titleFocused = document.activeElement === noteTitleInput;
        const bodyFocused = document.activeElement === noteTextarea;

        if ((titleChanged || bodyChanged) && (titleFocused || bodyFocused)) {
            buttonContainer.classList.add("visible");
        } else {
            buttonContainer.classList.remove("visible");
        }
    };


    noteTitleInput.addEventListener("input", showButtonsIfChanged);
    noteTextarea.addEventListener("input", showButtonsIfChanged);

    noteTitleInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            noteTextarea.focus();
        }
    });

    noteTextarea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            saveButton.click();
        }
    });

    noteTitleInput.addEventListener("focus", showButtonsIfChanged);
    noteTitleInput.addEventListener("blur", showButtonsIfChanged);
    noteTextarea.addEventListener("focus", showButtonsIfChanged);
    noteTextarea.addEventListener("blur", showButtonsIfChanged);

    saveButton.addEventListener("click", () => {
        noteData.title = noteTitleInput.value;
        noteData.body = noteTextarea.value;
        originalData.title = noteData.title;
        originalData.body = noteData.body;
        buttonContainer.classList.remove("visible");
        noteTitleInput.blur();
        noteTextarea.blur();
        glow(singularNote);
    });    

    buttonContainer.appendChild(saveButton);
    buttonContainer.appendChild(discardButton);

    noteNav.appendChild(noteTitleInput);
    noteNav.appendChild(noteOptions);
    singularNote.appendChild(noteNav);
    singularNote.appendChild(noteTextarea);
    singularNote.appendChild(buttonContainer);

    document.getElementById("notes").appendChild(singularNote);
    noteTitleInput.focus();
}

function glow(element) {
    element.classList.add("glow");
    setTimeout(() => {
        element.classList.remove("glow");
    }, 1000);
}

createCard();

document.getElementById("newnotebtn").addEventListener("click", () => {
    createCard();
})

document.addEventListener("keyup", (event) => {
    if (event.key == "n" && isNotFocusedOnInput()) {
        createCard()
    }
})

function isNotFocusedOnInput() {
    const active = document.activeElement;
    return !(
      active && (
        active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.isContentEditable
      )
    );
  }
  