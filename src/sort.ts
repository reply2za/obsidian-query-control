import {SortOption} from "./obsidian";


export function createSortPopup(options: SortOption[], buttonElement: any, setSortOrderCallback: (selectedOption: string) => void) {
    // Check if tooltip already exists
    let existingTooltip = document.getElementById('sort-tooltip');
    if (existingTooltip) {
        existingTooltip.remove(); // Remove the existing tooltip if it's open
        return;
    }

    // Create the tooltip-like div
    const tooltip = document.createElement('div');
    tooltip.id = 'sort-tooltip';
    tooltip.style.position = 'absolute';
    tooltip.style.background = '#333';
    tooltip.style.color = '#fff';
    tooltip.style.borderRadius = '4px';
    tooltip.style.padding = '5px';
    tooltip.style.zIndex = '1000';
    tooltip.style.top = `${buttonElement.getBoundingClientRect().bottom + window.scrollY}px`;
    tooltip.style.left = `${buttonElement.getBoundingClientRect().left}px`;

    // Populate the tooltip with options
    options.forEach(option => {
        const optionEl = document.createElement('div');
        optionEl.textContent = option.label; // Use the display label
        optionEl.style.padding = '5px';
        optionEl.style.cursor = 'pointer';

        // Add hover effect
        optionEl.addEventListener('mouseover', () => {
            optionEl.style.background = '#555';
        });
        optionEl.addEventListener('mouseout', () => {
            optionEl.style.background = 'none';
        });

        // Click event to set the sort order
        optionEl.addEventListener('click', () => {
            setSortOrderCallback(option.key); // Pass the key
            tooltip.remove(); // Remove the tooltip after selection
        });

        tooltip.appendChild(optionEl); // Add each option to the tooltip
    });

    // Append the tooltip to the body
    document.body.appendChild(tooltip);

    // Close the tooltip when clicking outside
    const outsideClickListener = (event) => {
        if (!tooltip.contains(event.target) && !buttonElement.contains(event.target)) {
            tooltip.remove();
            document.removeEventListener('click', outsideClickListener); // Remove the listener after it's called
        }
    };
    document.addEventListener('click', outsideClickListener);
}


