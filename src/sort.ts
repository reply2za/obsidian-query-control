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
