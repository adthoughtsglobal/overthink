const notesObject = {};

function createCardElements(notedef = {}) {
    const {
        title = "",
        desc = "",
        timeRangeString = "09:00 - 09:30 AM",
        _timeKey = null
    } = notedef;

    const noteData = {
        title,
        body: desc,
        _timeKey
    };

    const originalData = { ...noteData };

    const singularNote = document.createElement("div");
    singularNote.className = "singular_note";

    const noteNav = document.createElement("div");
    noteNav.className = "note_nav";

    const noteTitleInput = document.createElement("input");
    noteTitleInput.className = "note_title";
    noteTitleInput.type = "text";
    noteTitleInput.value = title;
    noteTitleInput.setAttribute("placeholder", "Give a title...");

    const noteOptions = document.createElement("div");
    noteOptions.className = "note_options";

    const time = document.createElement("div");
    time.className = "btn time_btn";

    noteOptions.appendChild(time);

    const noteTextarea = document.createElement("textarea");
    noteTextarea.className = "note_para";
    noteTextarea.setAttribute("placeholder", "Hit Enter once you're done with the title. And how would this even look like? At least ideally...");
    noteTextarea.value = desc;

    const resizeTextarea = () => {
        noteTextarea.style.height = "auto";
        noteTextarea.style.height = noteTextarea.scrollHeight + "px";
    };
    resizeTextarea();

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "button-container";

    const saveButton = document.createElement("button");
    saveButton.innerHTML = `<div class="tooltip">
                        <div class="tooltitit">Save task</div>
                        <kbd>ENTER</kbd> </div><span>Save </span>  <i class="msr btn">check</i>`;
    saveButton.classList.add("toolticont", "btnrl");

    const discardButton = document.createElement("button");
    discardButton.innerHTML = `Discard <i class="msr btn">close</i>`;
    discardButton.classList.add("btnrl", "greybtn");

    buttonContainer.appendChild(saveButton);
    buttonContainer.appendChild(discardButton);

    noteNav.appendChild(noteTitleInput);
    noteNav.appendChild(noteOptions);
    singularNote.appendChild(noteNav);
    singularNote.appendChild(noteTextarea);
    singularNote.appendChild(buttonContainer);

    const singularTimeBlock = document.createElement("div");
    singularTimeBlock.classList.add("time_block");

    const timeBlockText = document.createElement("div");
    timeBlockText.classList.add("time_block_text");
    time.innerText = timeRangeString;
    timeBlockText.innerText = timeRangeString;

    const timeBlockOptions = document.createElement("div");
    timeBlockOptions.classList.add("time_block_options", "btn", "toolticont");

    const tooltip = document.createElement("div");
    tooltip.classList.add("tooltip", "byright");

    const tooltitit = document.createElement("div");
    tooltitit.classList.add("tooltitit");
    tooltitit.textContent = "Remove event";

    tooltip.appendChild(tooltitit);

    const closeSpan = document.createElement("span");
    closeSpan.classList.add("msr");
    closeSpan.textContent = "close";

    timeBlockOptions.appendChild(tooltip);
    timeBlockOptions.appendChild(closeSpan);

    singularTimeBlock.appendChild(timeBlockText);
    singularTimeBlock.appendChild(timeBlockOptions);

    noteData._timeKey = notedef?._timeKey || null;
    singularNote._timeKey = _timeKey;
    singularTimeBlock.dataset.timeKey = _timeKey;


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

    noteTitleInput.addEventListener("input", () => {
        resizeTextarea();
        showButtonsIfChanged();
    });

    noteTextarea.addEventListener("input", () => {
        resizeTextarea();
        showButtonsIfChanged();
    });

    noteTitleInput.addEventListener("keydown", async (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            await timeset();
            noteTextarea.focus();
        }
    });

    noteTextarea.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            saveButton.click();
        }
    });

    [noteTitleInput, noteTextarea].forEach(el => {
        el.addEventListener("focus", showButtonsIfChanged);
        el.addEventListener("blur", showButtonsIfChanged);
    });

    saveButton.addEventListener("click", () => {
        noteData.title = noteTitleInput.value;
        noteData.body = noteTextarea.value;
        originalData.title = noteData.title;
        originalData.body = noteData.body;
        buttonContainer.classList.remove("visible");
        noteTitleInput.blur();
        noteTextarea.blur();
        updateNoteData(noteData._timeKey, noteData.title, noteData.body);
        glow(singularNote);
    });

    discardButton.addEventListener("click", () => {
        noteTitleInput.value = originalData.title;
        noteTextarea.value = originalData.body;
        buttonContainer.classList.remove("visible");
        glow(singularNote);
    });

    time.addEventListener("click", timeset);

    async function timeset() {
        const { startTimestamp, endTimestamp, timeRangeString } = await askTimes();

        const timeKey = `${startTimestamp}-${endTimestamp}`;

        time.innerText = timeRangeString;
        timeBlockText.innerText = timeRangeString;

        noteData.title = noteTitleInput.value;
        noteData.body = noteTextarea.value;

        if (noteData._timeKey && noteData._timeKey !== timeKey) {
            delete notesObject[noteData._timeKey];
            removeTimeBlockFromDOM(noteData._timeKey);
        }

        notesObject[timeKey] = {
            title: noteData.title,
            desc: noteData.body
        };
        noteData._timeKey = timeKey;

        updateSortedNotes();

        singularTimeBlock.dataset.timeKey = timeKey;

        timeBlockText.textContent = timeRangeString;

        glow(singularNote);
    }

    if (noteData._timeKey) {
        singularTimeBlock.dataset.timeKey = noteData._timeKey;
    }

    return {
        singularNote,
        singularTimeBlock,
        noteData,
        time,
        timeBlockText,
        noteTitleInput,
        noteTextarea,
        saveButton,
        discardButton
    };

}

function appendNoteCard(cardElements) {
    const notesContainer = document.getElementById("notes");
    const timeBlocksContainer = document.getElementById("time_blocks");

    notesContainer.appendChild(cardElements.singularNote);
    timeBlocksContainer.appendChild(cardElements.singularTimeBlock);
}

function updateNoteData(timeKey, title, desc) {
    if (!timeKey) return;

    notesObject[timeKey] = { title, desc };

    const timeBlocksContainer = document.getElementById("time_blocks");

    const timeBlock = [...timeBlocksContainer.children].find(
        el => el.dataset.timeKey === timeKey
    );
    if (timeBlock) {
        const timeBlockText = timeBlock.querySelector(".time_block_text");
        if (timeBlockText) timeBlockText.textContent = buildTimeRangeStringFromKey(timeKey);
    }

}

function removeTimeBlockFromDOM(timeKey) {
    const timeBlocksContainer = document.getElementById("time_blocks");
    const notesContainer = document.getElementById("notes");

    const timeBlock = [...timeBlocksContainer.children].find(
        el => el.dataset.timeKey === timeKey
    );
    if (timeBlock) {
        timeBlock.remove();
    }

    for (const noteCard of notesContainer.children) {
        if (noteCard._timeKey === timeKey) {
            noteCard.remove();
            break;
        }
    }
}

function buildTimeRangeStringFromKey(timeKey) {
    const [startTimestamp, endTimestamp] = timeKey.split("-").map(Number);
    if (isNaN(startTimestamp) || isNaN(endTimestamp)) return "";
    const startDate = new Date(startTimestamp);
    const endDate = new Date(endTimestamp);
    return buildTimeRangeString(startDate, endDate);
}

function glow(element) {
    element.classList.add("glow");
    setTimeout(() => {
        element.classList.remove("glow");
    }, 1000);
}

document.getElementById("notes").addEventListener("click", (e) => {
    if (e.target.closest(".btn.toolticont i.msr") && e.target.closest(".btn.toolticont").querySelector(".msr").textContent === "close") {
        const singularNote = e.target.closest(".singular_note");
        if (!singularNote) return;

        const timeKey = singularNote._timeKey;
        if (timeKey && notesObject[timeKey]) {
            delete notesObject[timeKey];
            removeTimeBlockFromDOM(timeKey);
        }
        singularNote.remove();
    }
});

function createAndAppendCard(notedef = {}) {
    const cardElements = createCardElements(notedef);
    appendNoteCard(cardElements);
    cardElements.noteTitleInput.focus();
    return cardElements;
}

createAndAppendCard();

document.getElementById("newnotebtn").addEventListener("click", () => {
    createAndAppendCard();
});

document.addEventListener("keyup", (event) => {
    if (event.key == "n" && isNotFocusedOnInput()) {
        createAndAppendCard();
    }
});

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

function renderNotesFromObject() {
    const notesContainer = document.getElementById("notes");
    const timeBlocksContainer = document.getElementById("time_blocks");

    const existingNoteCards = {};
    const existingTimeBlocks = {};

    for (const child of notesContainer.children) {
        if (child._timeKey) {
            existingNoteCards[child._timeKey] = child;
        }
    }

    for (const child of timeBlocksContainer.children) {
        if (child.dataset.timeKey) {
            existingTimeBlocks[child.dataset.timeKey] = child;
        }
    }

    const sortedKeys = Object.keys(notesObject).sort((a, b) => {
        const aStart = parseInt(a.split("-")[0], 10);
        const bStart = parseInt(b.split("-")[0], 10);
        return aStart - bStart;
    });

    for (const key of sortedKeys) {
        const note = notesObject[key];
        if (!note.title.trim() && !note.desc.trim()) continue;

        if (existingNoteCards[key] && existingTimeBlocks[key]) {
            notesContainer.appendChild(existingNoteCards[key]);
            timeBlocksContainer.appendChild(existingTimeBlocks[key]);
        } else {
            const cardElements = createCardElements({}, {
                title: note.title,
                desc: note.desc,
                _timeKey: key
            });

            cardElements.singularNote._timeKey = key;
            cardElements.singularTimeBlock.dataset.timeKey = key;

            appendNoteCard(cardElements);
        }
    }
}

function updateSortedNotes() {
    const sortedKeys = Object.keys(notesObject).sort((a, b) => {
        const aStart = parseInt(a.split("-")[0], 10);
        const bStart = parseInt(b.split("-")[0], 10);
        return aStart - bStart;
    });

    console.log("Sorted Notes:");
    for (const key of sortedKeys) {
        console.log(`${key}:, notesObject[key]`);
    }
}

function buildTimeRangeString(startDate, endDate) {
    function formatTime(date) {
        let hours = date.getHours();
        let minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;
        const paddedMinutes = minutes.toString().padStart(2, '0');
        return { time: `${hours}:${paddedMinutes}`, ampm };
    }

    const start = formatTime(startDate);
    const end = formatTime(endDate);

    if (start.ampm === end.ampm) {
        return `${start.time} - ${end.time} ${end.ampm}`;
    } else {
        return `${start.time} ${start.ampm} - ${end.time} ${end.ampm}`;
    }
}


async function askTimes() {
    const picker = document.querySelector('#timepicker');
    picker.style.display = "flex";
    return new Promise((resolve, reject) => {
        const startTimeInput = document.getElementById('startTime');
        const endTimeInput = document.getElementById('endTime');

        function pad(num) {
            return num.toString().padStart(2, '0');
        }

        const now = new Date();
        const nowPlus5 = new Date(now.getTime() + 5 * 60000);

        const formatTime = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

        startTimeInput.value = formatTime(now);
        endTimeInput.value = formatTime(nowPlus5);

        const checkButton = document.querySelector('#timesubbtn');

        function formatAMPM(date) {
            let hours = date.getHours();
            let minutes = date.getMinutes();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            minutes = minutes < 10 ? '0' + minutes : minutes;
            return `${hours}:${minutes} ${ampm}`;
        }

        function isValidTimeDifference(start, end) {
            const today = new Date().toISOString().split('T')[0];
            let startDate = new Date(`${today}T${start}`);
            let endDate = new Date(`${today}T${end}`);

            if (endDate <= startDate) {
                endDate.setDate(endDate.getDate() + 1);
            }

            const diffInMs = endDate - startDate;
            const diffInMinutes = diffInMs / 60000;

            return diffInMinutes >= 1 && diffInMinutes <= 70 * 365 * 24 * 60;
        }

        checkButton.addEventListener('click', () => {
            picker.style.display = "none";
            const start = startTimeInput.value;
            const end = endTimeInput.value;

            if (start && end) {
                const today = new Date().toISOString().split('T')[0];
                let startDate = new Date(`${today}T${start}`);
                let endDate = new Date(`${today}T${end}`);

                if (endDate <= startDate) {
                    endDate.setDate(endDate.getDate() + 1);
                }

                if (isValidTimeDifference(start, end)) {
                    const rangeString = buildTimeRangeString(startDate, endDate);
                    resolve({
                        startTime: (startDate),
                        endTime: (endDate),
                        startTimestamp: startDate.getTime(),
                        endTimestamp: endDate.getTime(),
                        timeRangeString: rangeString
                    });
                } else {
                    askTimes();
                }
            } else {
                askTimes();
            }
        });
    });
}


function updateClock() {
    const now = new Date();

    const seconds = now.getSeconds();
    const minutes = now.getMinutes();
    const hours = now.getHours();

    const secondDeg = seconds * 6;
    const minuteDeg = minutes * 6 + seconds * 0.1;
    const hourDeg = ((hours % 12) + minutes / 60) * 30;

    document.getElementById('secondHand').style.transform = `translateX(-50%) rotate(${secondDeg}deg)`;
    document.getElementById('minuteHand').style.transform = `translateX(-50%) rotate(${minuteDeg}deg)`;
    document.getElementById('hourHand').style.transform = `translateX(-50%) rotate(${hourDeg}deg)`;

    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    const minuteStr = minutes.toString().padStart(2, '0');
    const timeStr = `${hour12}:${minuteStr} ${ampm}`;
    document.getElementById('textClock').textContent = timeStr;
}

setInterval(updateClock, 1000);
updateClock();
