// ==UserScript==
// @name         Calendar for UniPG SOL
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Add a button to create an .ics event for each exam with multiple calendar sync options
// @author       LukeGotBored
// @match        https://unipg.esse3.cineca.it/auth/studente/Appelli/BachecaPrenotazioni.do
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==


(function() {
    'use strict';

    const EXAM_DURATION_HOURS = 2;
    const ERROR_DISPLAY_DURATION_MS = 3000;

    const LANGUAGES = {
        en: {
            addToCalendar: 'Add to calendar',
            errorDate: 'Invalid date format.',
            errorPastDate: 'The exam date is in the past.',
            errorICS: 'Error creating ICS file.',
            downloadICS: 'Download ICS',
            addToGoogleCalendar: 'Add to Google Calendar',
            addToOutlook: 'Add to Outlook',
        },
        fr: {
            addToCalendar: 'Ajouter au calendrier',
            errorDate: 'Format de date invalide.',
            errorPastDate: 'La date de l\'examen est dans le passé.',
            errorICS: 'Erreur lors de la création du fichier ICS.',
            downloadICS: 'Télécharger ICS',
            addToGoogleCalendar: 'Ajouter à Google Agenda',
            addToOutlook: 'Ajouter à Outlook',
        },
        it: {
            addToCalendar: 'Aggiungi al calendario',
            errorDate: 'Formato data non valido.',
            errorPastDate: 'La data dell\'esame è nel passato.',
            errorICS: 'Errore durante la creazione del file ICS.',
            downloadICS: 'Scarica ICS',
            addToGoogleCalendar: 'Aggiungi a Google Calendar',
            addToOutlook: 'Aggiungi a Outlook',
        }
    };

    let currentLanguage = (navigator.language || navigator.userLanguage).split('-')[0];
    if (!LANGUAGES[currentLanguage]) {
        currentLanguage = 'en';
    }

    const t = (key) => LANGUAGES[currentLanguage][key] || LANGUAGES['en'][key];

    const showMessage = (message, isError = false) => {
        const dialog = document.createElement('dialog');
        Object.assign(dialog.style, {
            padding: '20px',
            borderRadius: '8px',
            backgroundColor: '#fff',
            color: '#333',
            border: 'none',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            fontFamily: 'Arial, sans-serif',
            maxWidth: '400px',
            width: '100%'
        });
        dialog.innerHTML = `
            <div style="display: flex; align-items: center; ${isError ? 'color: #ff6b6b;' : 'color: #4CAF50;'}">
                <span style="margin-right: 10px;">${isError ? '❌' : '✅'}</span>
                <span style="flex-grow: 1;">${message}</span>
            </div>
        `;
        document.body.appendChild(dialog);
        dialog.showModal();
        setTimeout(() => {
            dialog.close();
            document.body.removeChild(dialog);
        }, ERROR_DISPLAY_DURATION_MS);
    };

    const createButton = (isDisabled = false) => {
        const button = document.createElement('button');
        button.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar-plus"><path d="M8 2v4"/><path d="M16 2v4"/><path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8"/><path d="M3 10h18"/><path d="M16 19h6"/><path d="M19 16v6"/></svg>';
        button.id = 'AddToCalendarBtn'
        Object.assign(button.style, {
            color: '#fff',
            backgroundColor: isDisabled ? '#ccc' : '#194e72',
            textDecoration: 'none',
            marginRight: '5px',
            marginBottom: '0.3em',
            padding: '7px',
            border: 'none',
            borderRadius: '4px',
            width: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.3s ease',
            position: 'relative',
            border: 'solid 1px #00305c'
        });
        button.setAttribute('aria-label', t('addToCalendar'));
        button.setAttribute('title', t('addToCalendar'));
        button.disabled = isDisabled;

        if (!isDisabled) {
            button.addEventListener('mouseover', () => {
                button.style.backgroundColor = '#266D91';
            });
            button.addEventListener('mouseout', () => {
                button.style.backgroundColor = '#194e72';
            });
        }

        return button;
    };

    const createDropdown = (button, examInfo) => {
        const dropdown = document.createElement('div');
        Object.assign(dropdown.style, {
            position: 'absolute',
            top: '100%',
            left: '0',
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '8px',
            display: 'none',
            zIndex: '1000',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            color: '#000',
            width: 'max-content',
            textAlign: 'start'
        });

        const createOption = (text, onClick, iconUrl) => {
            const option = document.createElement('div');
            option.style.padding = '12px 16px';
            option.style.cursor = 'pointer';
            option.style.display = 'flex';
            option.style.alignItems = 'center';

            const icon = document.createElement('img');
            icon.src = iconUrl;
            icon.style.width = '16px';
            icon.style.height = '16px';
            icon.style.marginRight = '8px';

            const textSpan = document.createElement('span');
            textSpan.textContent = text;

            option.appendChild(icon);
            option.appendChild(textSpan);

            option.addEventListener('click', onClick);
            option.addEventListener('mouseover', () => option.style.backgroundColor = '#f0f0f0');
            option.addEventListener('mouseout', () => option.style.backgroundColor = 'transparent');
            return option;
        };

        dropdown.appendChild(createOption(t('downloadICS'), () => downloadICS(createICS(examInfo), formatTitle(examInfo.subject)), 'https://www.google.com/s2/favicons?domain=ics'));
        dropdown.appendChild(createOption(t('addToGoogleCalendar'), () => addToGoogleCalendar(examInfo), 'https://www.google.com/s2/favicons?domain=calendar.google.com'));
        dropdown.appendChild(createOption(t('addToOutlook'), () => addToOutlookCalendar(examInfo), 'https://www.google.com/s2/favicons?domain=outlook.com'));

        button.appendChild(dropdown);
    };

    const formatDate = (dateString) => {
        const [day, month, year] = dateString.split('/');
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    };

    const isDateInPast = (date, time) => {
        const examDateTime = new Date(`${date}T${time}:00`);
        return examDateTime < new Date();
    };

    const createICS = ({ subject, date, time }) => {
        const startDateTime = new Date(`${date}T${time}:00`);
        const endDateTime = new Date(startDateTime.getTime() + EXAM_DURATION_HOURS * 60 * 60 * 1000);

        const formatICSDate = (date) => date.toISOString().replace(/-|:|\.\d+/g, "");

        return `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${subject} - Esame
DTSTART:${formatICSDate(startDateTime)}
DTEND:${formatICSDate(endDateTime)}
DESCRIPTION:Esame di ${subject}
LOCATION:Aula da confermare
END:VEVENT
END:VCALENDAR`;
    };

    const downloadICS = (icsContent, title) => {
        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = title + '.ics';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const addToGoogleCalendar = ({ subject, date, time }) => {
        const startDateTime = new Date(`${date}T${time}:00`);
        const endDateTime = new Date(startDateTime.getTime() + EXAM_DURATION_HOURS * 60 * 60 * 1000);
        const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(subject + ' - Esame')}&dates=${startDateTime.toISOString().replace(/-|:|\.\d+/g, "")}/${endDateTime.toISOString().replace(/-|:|\.\d+/g, "")}&details=${encodeURIComponent('Esame di ' + subject)}&location=${encodeURIComponent('Aula da confermare')}`;
        window.open(url, '_blank');
    };

    const addToOutlookCalendar = ({ subject, date, time }) => {
        const startDateTime = new Date(`${date}T${time}:00`);
        const endDateTime = new Date(startDateTime.getTime() + EXAM_DURATION_HOURS * 60 * 60 * 1000);
        const url = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(subject + ' - Esame')}&startdt=${startDateTime.toISOString()}&enddt=${endDateTime.toISOString()}&body=${encodeURIComponent('Esame di ' + subject)}&location=${encodeURIComponent('Aula da confermare')}`;
        window.open(url, '_blank');
    };

    function formatTitle(str) {
        // https://stackoverflow.com/questions/32589197/
        var splitStr = str.toLowerCase().split(' ');
        for (var i = 0; i < splitStr.length; i++) {
            splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);
        }
        return splitStr.join('');
    }

    const main = () => {
        const examBoxes = document.querySelectorAll('#boxPrenotazione');
        const actionBoxes = document.querySelectorAll('#toolbarAzioni');

        examBoxes.forEach((box, index) => {
            const toolbar = actionBoxes[index];
            if (!toolbar) return;

            const subjectName = box.querySelector('h2').textContent.trim();
            const examDateTimeElement = box.querySelector('.app-box_dati_data_esame');
            const examDateTime = examDateTimeElement ? examDateTimeElement.textContent.trim() : null;

            if (!examDateTime) {
                console.error('Exam date and time not found');
                return;
            }

            const [examDate, examTime] = examDateTime.split(/\s+/);
            const formattedDate = formatDate(examDate);

            if (!formattedDate) {
                showMessage(t('errorDate'), true);
                return;
            }

            const isPastEvent = isDateInPast(formattedDate, examTime);
            const button = createButton(isPastEvent);

            if (isPastEvent) {
                box.style.opacity = '0.5';
                box.style.backgroundColor = '#f0f0f0';
            } else {
                const examInfo = { subject: subjectName, date: formattedDate, time: examTime };
                createDropdown(button, examInfo);

                let dropdownVisible = false;
                button.addEventListener('mouseover', () => {
                    button.querySelector('div').style.display = 'block';
                    dropdownVisible = true;
                });

                button.addEventListener('mouseout', () => {
                    setTimeout(() => {
                        if (!button.matches(':hover') && !button.querySelector('div').matches(':hover')) {
                            button.querySelector('div').style.display = 'none';
                            dropdownVisible = false;
                        }
                    }, 100);
                });

                document.addEventListener('click', (e) => {
                    if (dropdownVisible && !button.contains(e.target)) {
                        button.querySelector('div').style.display = 'none';
                        dropdownVisible = false;
                    }
                });
            }

            toolbar.appendChild(button);
            toolbar.style.display = 'flex';
            toolbar.style.justifyContent = 'center';
            toolbar.style.alignItems = 'center';
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
})();
