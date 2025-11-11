import { App, PluginSettingTab, Setting } from "obsidian";
import EmbeddedQueryControlPlugin from "./main";
import { translate } from "./utils";

export type ControlVisibilityOption = "visible" | "hidden";

export type ControlVisibilityKey =
  | "collapseAll"
  | "extraContext"
  | "sort"
  | "hideTitle"
  | "hideResults"
  | "renderMarkdown"
  | "copyResults";

export interface ControlVisibilitySettings {
  [key: string]: ControlVisibilityOption;
  collapseAll: ControlVisibilityOption;
  extraContext: ControlVisibilityOption;
  sort: ControlVisibilityOption;
  hideTitle: ControlVisibilityOption;
  hideResults: ControlVisibilityOption;
  renderMarkdown: ControlVisibilityOption;
  copyResults: ControlVisibilityOption;
}

export interface EmbeddedQueryControlSettings {
  defaultCollapse: boolean;
  defaultShowContext: boolean;
  defaultHideTitle: boolean;
  defaultHideResults: boolean;
  defaultRenderMarkdown: boolean;
  defaultSortOrder: string;
  controlVisibility: ControlVisibilitySettings;
}

export const DEFAULT_SETTINGS: EmbeddedQueryControlSettings = {
  defaultCollapse: false,
  defaultShowContext: false,
  defaultHideTitle: false,
  defaultHideResults: false,
  defaultRenderMarkdown: false,
  defaultSortOrder: "alphabetical",
  controlVisibility: {
    collapseAll: "visible",
    extraContext: "visible",
    sort: "visible",
    hideTitle: "visible",
    hideResults: "visible",
    renderMarkdown: "visible",
    copyResults: "visible",
  },
};
// alphabetical|alphabeticalReverse|byModifiedTime|byModifiedTimeReverse|byCreatedTime|byCreatedTimeReverse
export const sortOptions = [
  { key: 'alphabetical', label: translate("plugins.file-explorer.label-sort-a-to-z") },
  { key: 'alphabeticalReverse', label: translate("plugins.file-explorer.label-sort-z-to-a") },
  { key: 'byModifiedTime', label: translate("plugins.file-explorer.label-sort-new-to-old") },
  { key: 'byModifiedTimeReverse', label: translate("plugins.file-explorer.label-sort-old-to-new") },
  { key: 'byCreatedTime', label: translate("plugins.file-explorer.label-sort-created-new-to-old") },
  { key: 'byCreatedTimeReverse', label: translate("plugins.file-explorer.label-sort-created-old-to-new") },
];

const convertToRecord = (options: { key: string; label: string }[]): Record<string, string> => {
  return options.reduce((acc, option) => {
    acc[option.key] = option.label;
    return acc;
  }, {} as Record<string, string>);
};

const CONTROL_VISIBILITY_LABELS: Record<ControlVisibilityOption, string> = {
  visible: "Visible",
  hidden: "Hidden",
};

const CONTROL_VISIBILITY_ORDER: ControlVisibilityOption[] = ["visible", "hidden"];

const CONTROL_DISPLAY_NAMES: Record<ControlVisibilityKey, string> = {
  collapseAll: "Collapse results toggle",
  extraContext: "More context toggle",
  sort: "Sort menu",
  hideTitle: "Hide title toggle",
  hideResults: "Hide results toggle",
  renderMarkdown: "Render markdown toggle",
  copyResults: "Copy results button",
};

export class SettingTab extends PluginSettingTab {
  plugin: EmbeddedQueryControlPlugin;

  constructor(app: App, plugin: EmbeddedQueryControlPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  hide() {}

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl).setName("Collapse query results by default").addToggle(toggle =>
      toggle.setValue(this.plugin.settings.defaultCollapse).onChange(value => {
        this.plugin.settings.defaultCollapse = value;
        this.plugin.saveSettings();
      })
    );

    new Setting(containerEl).setName("Show additional query result context by default").addToggle(toggle =>
      toggle.setValue(this.plugin.settings.defaultShowContext).onChange(value => {
        this.plugin.settings.defaultShowContext = value;
        this.plugin.saveSettings();
      })
    );

    new Setting(containerEl).setName("Hide query title by default").addToggle(toggle =>
      toggle.setValue(this.plugin.settings.defaultHideTitle).onChange(value => {
        this.plugin.settings.defaultHideTitle = value;
        this.plugin.saveSettings();
      })
    );

    new Setting(containerEl).setName("Hide query results by default").addToggle(toggle =>
      toggle.setValue(this.plugin.settings.defaultHideResults).onChange(value => {
        this.plugin.settings.defaultHideResults = value;
        this.plugin.saveSettings();
      })
    );

    new Setting(containerEl).setName("Render results as Markdown by default").addToggle(toggle =>
      toggle.setValue(this.plugin.settings.defaultRenderMarkdown).onChange(value => {
        this.plugin.settings.defaultRenderMarkdown = value;
        this.plugin.saveSettings();
      })
    );

    new Setting(containerEl).setName("Default query result sort order").addDropdown(cb => {
      cb.addOptions(convertToRecord(sortOptions));
      cb.setValue(this.plugin.settings.defaultSortOrder);
      cb.onChange(async value => {
        (this.plugin.settings.defaultSortOrder as any) = value;
        await this.plugin.saveSettings();
      });
    });

    containerEl.createEl("h2", { text: "Control visibility" });

    const descriptionMap: Record<ControlVisibilityKey, string> = {
      collapseAll: "Choose whether the Collapse Results toolbar control is shown.",
      extraContext: "Choose whether the More Context toolbar control is shown.",
      sort: "Choose whether the Sort toolbar control is shown.",
      hideTitle: "Choose whether the Hide Title toolbar control is shown.",
      hideResults: "Choose whether the Hide Results toolbar control is shown.",
      renderMarkdown: "Choose whether the Render Markdown toolbar control is shown.",
      copyResults: "Choose whether the Copy Results toolbar control is shown.",
    };

    (Object.keys(CONTROL_DISPLAY_NAMES) as ControlVisibilityKey[]).forEach(controlKey => {
      const visibilityOptions = CONTROL_VISIBILITY_ORDER.reduce((acc, option) => {
        acc[option] = CONTROL_VISIBILITY_LABELS[option];
        return acc;
      }, {} as Record<ControlVisibilityOption, string>);

      new Setting(containerEl)
        .setName(CONTROL_DISPLAY_NAMES[controlKey])
        .setDesc(
          `${descriptionMap[controlKey]} Hidden keeps the control's current state but removes the toolbar button.`
        )
        .addDropdown(drop => {
          drop.addOptions(visibilityOptions);
          drop.setValue(this.plugin.settings.controlVisibility[controlKey]);
          drop.onChange(async value => {
            this.plugin.settings.controlVisibility[controlKey] = value as ControlVisibilityOption;
            this.plugin.refreshControlVisibility();
            await this.plugin.saveSettings();
          });
        });
    });
  }
}
