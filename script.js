const notesArray = [];

function createCard({ title = "Give a title...", body = "Hit Enter once you're done with the title. And how would this even look like? At least ideally..." } = {}) {
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
            timeset();
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

    const singularTimeBlock = document.createElement("div");
    singularTimeBlock.classList.add("time_block");

    singularTimeBlock.addEventListener("click", () => {
        singularNote.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
        });
        glow(singularNote);
    })

    async function timeset() {
        let tmp = (await askTimes()).timeRangeString;
        time.innerText = tmp;
        timeBlockText.innerText = tmp;
        noteTextarea.focus();
    }

    const timeBlockText = document.createElement("div");
    timeBlockText.classList.add("time_block_text");
    timeBlockText.textContent = "09:00 - 09:30 AM";
    time.addEventListener("click", timeset);
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

    document.getElementById("notes").appendChild(singularTimeBlock);

    document.getElementById("time_blocks").appendChild(singularTimeBlock);
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
                        startTime: formatAMPM(startDate),
                        endTime: formatAMPM(endDate),
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