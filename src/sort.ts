import {sortOptions} from "./settings";

const sortOptionsArray = Object.entries(sortOptions);

export function getNextSortOption(currentOption: keyof typeof sortOptions): string {
    const currentIndex = sortOptionsArray.findIndex(([key]) => key === currentOption);

    // If the current option is found, cycle to the next option
    if (currentIndex !== -1) {
        const nextIndex = (currentIndex + 1) % sortOptionsArray.length;
        return sortOptionsArray[nextIndex][0]; // Return the next option's value (translated label)
    } else {
        throw new Error("Invalid sort option");
    }
}

export function createSortTooltip(options: string[], buttonElement: any, setSortOrderCallback: any) {
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
        optionEl.textContent = `Sort ${option}`;
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
            setSortOrderCallback(option); // Callback function to handle sorting
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


