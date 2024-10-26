import {SortOption} from "./obsidian";


export function createSortPopup(options: SortOption[], buttonElement: any, setSortOrderCallback: (selectedOption: string) => void, currentSortOrder: string) {
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

    // Close the tooltip when clicking outside
    const outsideClickListener = (event: any) => {
        if (!tooltip.contains(event.target) && !buttonElement.contains(event.target)) {
            tooltip.remove();
            document.removeEventListener('click', outsideClickListener);
        }
    };
    document.addEventListener('click', outsideClickListener);
}


