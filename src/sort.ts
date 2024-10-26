import {SortOption} from "./obsidian";
import { App } from "obsidian";


export function createSortPopup(options: SortOption[], buttonElement: any,
                                setSortOrderCallback: (selectedOption: string) => void,
                                currentSortOrder: string, app: App) {
    // Check if tooltip already exists
    let existingTooltip = document.getElementById('query-control-sort-tooltip');
    if (existingTooltip) {
        existingTooltip.remove(); // Remove the existing tooltip if it's open
        return;
    }

    // Create the tooltip-like div
    const tooltip = document.createElement('div');
    tooltip.classList.add('query-control-sort-tooltip');
    const rect = buttonElement.getBoundingClientRect();
    tooltip.style.top = `${rect.bottom + window.scrollY + 5}px`;
    tooltip.style.left = `${rect.left + window.scrollX}px`;


    // Populate the tooltip with options
    options.forEach(option => {
        const optionEl = document.createElement('div');
        optionEl.classList.add('query-control-sort-option');
        optionEl.textContent = option.label;

        if (option.key === currentSortOrder) {
            optionEl.setAttribute('aria-current', 'true');
            const checkmarkSpan = document.createElement('span');
            checkmarkSpan.textContent = '✔️'; // Unicode checkmark
            checkmarkSpan.classList.add('query-control-sort-option-checkmark');
            optionEl.appendChild(checkmarkSpan);
        }

        optionEl.addEventListener('click', () => {
            setSortOrderCallback(option.key); // Pass the key
            tooltip.remove(); // Remove the tooltip after selection
        });

        tooltip.appendChild(optionEl); // Add each option to the tooltip
    });

    // Append the tooltip to the body
    document.body.appendChild(tooltip);



    const removeEventListeners = () => {
        document.removeEventListener('mousedown', outsideClickListener, true);
        document.removeEventListener('touchstart', outsideClickListener, true);
        document.removeEventListener('click', outsideClickListener, true);
        document.removeEventListener('keydown', keydownListener, true);
        app.workspace.off('active-leaf-change', onWorkspaceChange);
    };

    const onWorkspaceChange = () => {
        if (tooltip.parentElement) {
            tooltip.remove();
            removeEventListeners();
        }
    };


    const outsideClickListener = (event: MouseEvent | TouchEvent) => {
        if (!tooltip.contains(event.target as Node) && !buttonElement.contains(event.target as Node)) {
            tooltip.remove();
            removeEventListeners();
        }
    };

    const keydownListener = (event: KeyboardEvent) => {
        tooltip.remove();
        removeEventListeners();
    };

    document.addEventListener('mousedown', outsideClickListener, true);
    document.addEventListener('touchstart', outsideClickListener, true);
    document.addEventListener('click', outsideClickListener);
    document.addEventListener('keydown', keydownListener, true);
    app.workspace.on('active-leaf-change', onWorkspaceChange);
}


