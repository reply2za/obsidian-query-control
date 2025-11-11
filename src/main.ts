import {around} from "monkey-around";
import {
  BacklinkDOMClass,
  BacklinksClass,
  Component,
  EmbeddedSearchClass,
  Modal,
  Notice,
  Plugin,
  SearchHeaderDOM,
  SearchResultDOM,
  SearchResultItem,
  SearchView,
  Setting,
  ViewCreator,
  WorkspaceLeaf
} from "obsidian";
import {SearchMarkdownRenderer} from "./search-renderer";
import {
  ControlVisibilityKey,
  ControlVisibilityOption,
  DEFAULT_SETTINGS,
  EmbeddedQueryControlSettings,
  SettingTab,
  sortOptions
} from "./settings";
import {translate} from "./utils";
import {createSortPopup} from "./sort";
import {SortOption} from "./obsidian";

// Live Preview creates an embedded query block
// LP calls addChild with an instance of the EmbeddedSearch class

// EmbeddedSearch `onload` is patched to add a nav bar
// a new component is added to handle the lifecycle of the rendered markdown elements

// EmbeddedSearch has a `dom` property which holds an instance ofthe SearchResultDOM class
// SearchResultDOM has children which are of type SearchResultItem

// SearchResultItem has children which are of type SearchResultItemMatch
// There is one SearchResultItem per matched TFile

// SearchResultItemMatch has a render() method which is used to render matches
// There is a SearchResultItemMatch for every match found within a TFile

// Hierarchy
// - LivePreviewDOM
//   - EmbeddedSearch
//     - SearchResultDOM
//       - SearchResultItem
//         - SearchResultItemMatch


const backlinkDoms = new WeakMap<HTMLElement, any>();

export default class EmbeddedQueryControlPlugin extends Plugin {
  SearchHeaderDOM: typeof SearchHeaderDOM;
  SearchResultsExport: any;
  settings: EmbeddedQueryControlSettings;
  settingsTab: SettingTab;
  embeddedSearchResultDoms: Set<SearchResultDOM> = new Set();
  backlinkControlContexts: Map<BacklinkDOMClass, BacklinksClass> = new Map();
  isSearchResultItemPatched: boolean;
  isSearchResultItemMatchPatched: boolean;
  isBacklinksPatched: boolean;
  isSearchPatched: boolean;

  getControlVisibility(control: ControlVisibilityKey): ControlVisibilityOption {
    return this.settings?.controlVisibility?.[control] ?? DEFAULT_SETTINGS.controlVisibility[control];
  }

  isControlVisible(control: ControlVisibilityKey): boolean {
    return this.getControlVisibility(control) === "visible";
  }

  refreshControlVisibility() {
    for (const dom of Array.from(this.embeddedSearchResultDoms)) {
      const domAny = dom as any;
      if (!domAny?.el?.isConnected) {
        this.embeddedSearchResultDoms.delete(dom);
        continue;
      }
      this.applyEmbeddedSearchControlVisibility(domAny);
    }
    for (const [dom, backlinksInstance] of Array.from(this.backlinkControlContexts.entries())) {
      const domAny = dom as any;
      const backlinksAny = backlinksInstance as any;
      const headerConnected = backlinksAny?.headerDom?.navHeaderEl?.isConnected;
      if (!domAny?.el?.isConnected || !headerConnected) {
        this.backlinkControlContexts.delete(dom);
        continue;
      }
      this.applyBacklinkControlVisibility(dom as BacklinkDOMClass, backlinksInstance);
    }
  }

  private toggleVisibility(el: HTMLElement | null | undefined, visible: boolean) {
    if (!el) return;
    const element: any = el;
    if (typeof element.toggleClass === "function") {
      element.toggleClass("is-hidden", !visible);
    } else {
      el.classList.toggle("is-hidden", !visible);
    }
  }

  applyEmbeddedSearchControlVisibility(searchResultDom: SearchResultDOM) {
    const dom = searchResultDom as any;
    const headerDom = dom?.headerDom;
    if (!headerDom?.addNavButton) return;

    const ensureButton = (property: string, factory: () => HTMLElement | null) => {
      if (!dom[property]) {
        dom[property] = factory();
      }
      return dom[property] as HTMLElement | null;
    };

    const collapseButton = ensureButton("collapseAllButtonEl", () =>
        headerDom.addNavButton(
            "bullet-list",
            translate("plugins.search.label-collapse-results"),
            (event: MouseEvent) => {
              event.stopPropagation();
              return dom.setCollapseAll(!dom.collapseAll);
            }
        )
    );
    this.toggleVisibility(collapseButton, this.isControlVisible("collapseAll"));

    const extraContextButton = ensureButton("extraContextButtonEl", () =>
        headerDom.addNavButton(
            "expand-vertically",
            translate("plugins.search.label-more-context"),
            (event: MouseEvent) => {
              event.stopPropagation();
              return dom.setExtraContext(!dom.extraContext);
            }
        )
    );
    this.toggleVisibility(extraContextButton, this.isControlVisible("extraContext"));

    const sortButton = ensureButton("showSortButtonEl", () =>
        headerDom.addNavButton(
            "arrow-up-narrow-wide",
            "Sort",
            (event: MouseEvent) => {
              event.stopPropagation();
              const validSortOptionKeys = sortOptions.map(option => option.key);
              const setSortOrderCallback = (selectedOptionKey: string) => {
                if (validSortOptionKeys.includes(selectedOptionKey)) {
                  dom.sortOrder = selectedOptionKey;
                  dom.setSortOrder(selectedOptionKey);
                } else {
                  console.error(`Invalid sort option: ${selectedOptionKey}`);
                }
              };
              const targetEl = dom.showSortButtonEl ?? (event.currentTarget as HTMLElement);
              if (targetEl) {
                createSortPopup(sortOptions, targetEl, setSortOrderCallback, dom.sortOrder, this.app);
              }
            }
        )
    );
    this.toggleVisibility(sortButton, this.isControlVisible("sort"));

    const hideTitleButton = ensureButton("showTitleButtonEl", () =>
        headerDom.addNavButton("strikethrough-glyph", "Hide title", (event: MouseEvent) => {
          event.stopPropagation();
          return dom.setTitleDisplay(!dom.showTitle);
        })
    );
    this.toggleVisibility(hideTitleButton, this.isControlVisible("hideTitle"));

    const hideResultsButton = ensureButton("showResultsButtonEl", () =>
        headerDom.addNavButton("minus-with-circle", "Hide results", (event: MouseEvent) => {
          event.stopPropagation();
          return dom.setResultsDisplay(!dom.showResults);
        })
    );
    this.toggleVisibility(hideResultsButton, this.isControlVisible("hideResults"));

    const renderMarkdownButton = ensureButton("renderMarkdownButtonEl", () =>
        headerDom.addNavButton("reading-glasses", "Render Markdown", (event: MouseEvent) => {
          event.stopPropagation();
          return dom.setRenderMarkdown(!dom.renderMarkdown);
        })
    );
    this.toggleVisibility(renderMarkdownButton, this.isControlVisible("renderMarkdown"));

    const copyResultsButton = ensureButton("copyResultsButtonEl", () =>
        headerDom.addNavButton(
            "documents",
            "Copy results",
            dom.onCopyResultsClick ? dom.onCopyResultsClick.bind(dom) : () => {}
        )
    );
    this.toggleVisibility(copyResultsButton, this.isControlVisible("copyResults"));
  }

  applyBacklinkControlVisibility(instance: BacklinkDOMClass, backlinksInstance: BacklinksClass) {
    const dom = instance as any;
    const backlinks = backlinksInstance as any;
    const headerDom = backlinks?.headerDom;
    if (!headerDom?.addNavButton) return;

    const ensureButton = (property: string, factory: () => HTMLElement | null) => {
      if (!dom[property]) {
        dom[property] = factory();
      }
      return dom[property] as HTMLElement | null;
    };

    const renderButton = ensureButton("renderMarkdownButtonEl", () =>
        headerDom.addNavButton("reading-glasses", "Render Markdown", (event: MouseEvent) => {
          event.stopPropagation();
          return dom.setRenderMarkdown(!dom.renderMarkdown);
        })
    );
    this.toggleVisibility(renderButton, this.isControlVisible("renderMarkdown"));

    const copyButton = ensureButton("copyResultsButtonEl", () =>
        headerDom.addNavButton(
            "documents",
            "Copy results",
            dom.onCopyResultsClick ? dom.onCopyResultsClick.bind(dom) : () => {}
        )
    );
    this.toggleVisibility(copyButton, this.isControlVisible("copyResults"));
  }

  async onload() {
    await this.loadSettings();
    let plugin = this;
    this.registerSettingsTab();
    this.register(
        around(this.app.viewRegistry.constructor.prototype, {
          registerView(old: any) {
            return function (type: string, viewCreator: ViewCreator, ...args: unknown[]) {
              plugin.app.workspace.trigger("view-registered", type, viewCreator);
              return old.call(this, type, viewCreator, ...args);
            };
          },
        })
    );
    let uninstall: () => void;
    if (!this.app.workspace.layoutReady) {
      let eventRef = this.app.workspace.on("view-registered", (type: string, viewCreator: ViewCreator) => {
        if (type !== "search") return;
        this.app.workspace.offref(eventRef);
        // @ts-ignore we need a leaf before any leafs exists in the workspace, so we create one from scratch
        let leaf = new WorkspaceLeaf(plugin.app);
        let searchView = viewCreator(leaf) as SearchView;
        plugin.patchNativeSearch(searchView);
        let uninstall = around(Modal.prototype, {
          open(old: any) {
            return function (...args: any[]) {
              plugin.SearchResultsExport = this.constructor;
              return;
            };
          },
        });
        searchView.onCopyResultsClick(new MouseEvent(null));
        uninstall();
      });
      let eventRef2 = this.app.workspace.on("view-registered", (type: string, viewCreator: ViewCreator) => {
        if (type !== "backlink") return;
        this.app.workspace.offref(eventRef2);
        // @ts-ignore we need a leaf before any leafs exists in the workspace, so we create one from scratch
        let leaf = new WorkspaceLeaf(plugin.app);
        let searchView = viewCreator(leaf) as SearchView;
        plugin.SearchHeaderDOM = searchView.backlink.headerDom.constructor as typeof SearchHeaderDOM;
      });
    }

    // The only way to obtain the EmbeddedSearch class is to catch it while it's being added to a parent component
    // The following will patch Component.addChild and will remove itself once it finds and patches EmbeddedSearch
    this.register(
        (uninstall = around(Component.prototype, {
          addChild(old: any) {
            return function (child: unknown, ...args: any[]) {
              try {
                if (
                    !plugin.isSearchPatched &&
                    child instanceof Component &&
                    child.hasOwnProperty("searchQuery") &&
                    child.hasOwnProperty("sourcePath") &&
                    child.hasOwnProperty("dom")
                ) {
                  let EmbeddedSearch = child as EmbeddedSearchClass;
                  plugin.patchSearchView(EmbeddedSearch);
                  plugin.isSearchPatched = true;
                }
                if (child instanceof Component && child.hasOwnProperty("backlinkDom")) {
                  let backlinks = child as BacklinksClass;
                  backlinkDoms.set(backlinks.backlinkDom.el.closest(".backlink-pane"), child);
                  if (!plugin.isBacklinksPatched) {
                    plugin.patchBacklinksView(backlinks);
                    plugin.isBacklinksPatched = true;
                  }
                }
              } catch (err) {
                console.error('Error in Component.addChild around patch:', err);
              }
              const result = old.call(this, child, ...args);
              return result;
            };
          },
        }))
    );
  }

  async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    this.settings.controlVisibility = Object.assign(
        {},
        DEFAULT_SETTINGS.controlVisibility,
        data?.controlVisibility ?? {}
    );
    this.refreshControlVisibility();
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  registerSettingsTab() {
    this.settingsTab = new SettingTab(this.app, this);
    this.addSettingTab(this.settingsTab);
  }

  getSearchHeader(): typeof SearchHeaderDOM {
    let backlinkTab = this.app.workspace.getLeavesOfType("backlink")?.first();
    backlinkTab?.loadIfDeferred();
    let searchHeader: any = backlinkTab?.view?.backlink?.headerDom;
    return searchHeader?.constructor;
  }


  onunload(): void {
    const unloadMessage = "Query Control: Please restart Obsidian to complete plugin unload.";
    console.log(unloadMessage);
    new Notice(unloadMessage);
  }

  patchNativeSearch(searchView: SearchView) {
    const plugin = this;
    this.register(
        around(searchView.constructor.prototype, {
          onResize(old: any) {
            return function (...args: any[]) {
              // this works around measurement issues when the search el width
              // goes to zero and then back to a non-zero value
              const _children = this.dom.vChildren?._children;
              if (this.dom.el.clientWidth === 0) {
                _children.forEach((child: any) => {
                  child.setCollapse(true, false);
                });
                this.dom.hidden = true;
              } else if (this.dom.hidden) {
                this.dom.hidden = false;
                // if we toggle too quickly, measurement happens before we want it to
                setTimeout(() => {
                  _children.forEach((child: any) => {
                    child.setCollapse(this.dom.collapseAll, false);
                  });
                }, 100);
              }
              return old.call(this, ...args);
            };
          },
          stopSearch(old: any) {
            return function (...args: any[]) {
              const result = old.call(this, ...args);
              if (this.renderComponent) {
                this.renderComponent.unload();
                this.renderComponent = new Component();
              }
              return result;
            };
          },
          addChild(old: any) {
            return function (...args: any[]) {
              try {
                if (!this.patched) {
                  if (!this.renderComponent) {
                    this.renderComponent = new Component();
                    this.renderComponent.load();
                  }
                  this.patched = true;
                  this.dom.parent = this;
                  plugin.patchSearchResultDOM(this.dom.constructor);
                  this.setRenderMarkdown = function (value: boolean) {
                    const _children = this.dom.vChildren?._children;
                    this.dom.renderMarkdown = value;
                    _children.forEach((child: any) => {
                      child.renderContentMatches();
                    });
                    this.dom.infinityScroll.invalidateAll();
                    this.dom.childrenEl.toggleClass("cm-preview-code-block", value);
                    this.dom.childrenEl.toggleClass("is-rendered", value);
                    this.renderMarkdownButtonEl?.toggleClass("is-active", value);
                  };
                  this.renderMarkdownButtonEl = this.headerDom?.addNavButton("reading-glasses", "Render Markdown", () => {
                    return this.setRenderMarkdown(!this.dom.renderMarkdown);
                  });

                  let allSettings = {
                    renderMarkdown: plugin.settings.defaultRenderMarkdown,
                  };
                  if (!this.settings) this.settings = {};
                  Object.entries(allSettings).forEach(([setting, defaultValue]) => {
                    if (!this.settings.hasOwnProperty(setting)) {
                      this.settings[setting] = defaultValue;
                    } else if (setting === "sort" && !sortOptions.hasOwnProperty(this.settings.sort)) {
                      this.settings[setting] = defaultValue;
                    }
                  });
                  this.setRenderMarkdown(this.settings.renderMarkdown);
                }
              } catch (err) {
                console.error('Error in searchView.addChild around patch:', err);
              }
              const result = old.call(this, ...args);
              return result;
            };
          },
        })
    );
  }

  patchSearchResultDOM(SearchResult: typeof SearchResultDOM) {
    const plugin = this;
    let uninstall = around(SearchResult.prototype, {
      addResult(old: any) {
        return function (...args: any[]) {
          uninstall();
          const result = old.call(this, ...args);
          let SearchResultItem = result.constructor;
          if (!plugin.isSearchResultItemPatched) {
            plugin.patchSearchResultItem(SearchResultItem);
          }
          return result;
        };
      },
    });
    this.register(uninstall);
    this.register(
        around(SearchResult.prototype, {
          // startLoader is called for many different use cases
          // in this patch, we try to determine the context we were called in
          // if we recognize a context (backlinks, embedded search, native search), we patch it
          startLoader(old: any) {
            return function (...args: any[]) {
              try {
                // Are we in a backlinks view?
                const containerEl = this.el.closest(".backlink-pane");
                if (containerEl) {
                  const backlinksInstance = backlinkDoms.get(containerEl);
                  if (backlinksInstance) {
                    if (!backlinksInstance.patched) {
                      handleBacklinks(this, plugin, backlinksInstance);
                    }
                  }
                }
                // Are we in a native search view?
                if (
                    !this.parent?.searchParamsContainerEl?.patched &&
                    this.el?.parentElement?.getAttribute("data-type") === "search"
                ) {
                  if (!this.parent) return;
                  this.parent.searchParamsContainerEl.patched = true;
                  new Setting(this.parent.searchParamsContainerEl)
                      .setName("Render Markdown")
                      .setClass("mod-toggle")
                      .addToggle((toggle) => {
                        toggle.setValue(plugin.settings.defaultRenderMarkdown);
                        toggle.onChange((value) => {
                          this.renderMarkdown = value;
                          const _children = this.vChildren?._children;
                          _children.forEach((child: any) => {
                            child.renderContentMatches();
                          });
                          this.infinityScroll.invalidateAll();
                          this.childrenEl.toggleClass("cm-preview-code-block", value);
                          this.childrenEl.toggleClass("is-rendered", value);
                        });
                      });
                }

                // Are we in an embedded search view?
                if (!this.patched && this.el.parentElement?.hasClass("internal-query")) {
                  let _SearchHeaderDOM = plugin.SearchHeaderDOM ? plugin.SearchHeaderDOM : plugin.getSearchHeader();

                  if (!_SearchHeaderDOM) {
                    console.error('Error: _SearchHeaderDOM is undefined. Cannot create headerDom.');
                    // Handle the error or exit the function
                    return;
                  }

                  if (this.el?.closest(".internal-query")) {
                    this.patched = true;
                    let defaultHeaderEl = this.el.parentElement.querySelector(".internal-query-header");
                    this.setExtraContext = function (value: boolean) {
                      const _children = this.vChildren?._children;
                      this.extraContext = value;
                      this.extraContextButtonEl?.toggleClass("is-active", value);
                      _children.forEach((child: any) => {
                        child.setExtraContext(value);
                      });
                      this.infinityScroll.invalidateAll();
                    };
                    this.setTitleDisplay = function (value: boolean) {
                      this.showTitle = value;
                      this.showTitleButtonEl?.toggleClass("is-active", value);
                      defaultHeaderEl?.toggleClass("is-hidden", value);
                    };
                    this.setResultsDisplay = function (value: boolean) {
                      this.showResults = value;
                      this.showResultsButtonEl?.toggleClass("is-active", value);
                      this.el.toggleClass("is-hidden", value);
                    };
                    this.setRenderMarkdown = function (value: boolean) {
                      this.renderMarkdown = value;
                      const _children = this.vChildren?._children;
                      _children.forEach((child: any) => {
                        child.renderContentMatches();
                      });
                      this.infinityScroll.invalidateAll();
                      this.childrenEl.toggleClass("cm-preview-code-block", value);
                      this.childrenEl.toggleClass("is-rendered", value);
                      this.renderMarkdownButtonEl?.toggleClass("is-active", value);
                    };
                    this.setCollapseAll = function (value: boolean) {
                      const _children = this.vChildren?._children;
                      this.collapseAllButtonEl?.toggleClass("is-active", value);
                      this.collapseAll = value;
                      _children.forEach((child: any) => {
                        child.setCollapse(value, false);
                      });
                      this.infinityScroll.invalidateAll();
                    };
                    this.setSortOrder = (sortType: string) => {
                      this.sortOrder = sortType;
                      this.changed();
                      this.infinityScroll.invalidateAll();
                      this.showSortButtonEl?.setAttribute('aria-label', `Sort (${sortOptions.find(option => option.key === sortType)?.label ?? sortType})`);
                    };
                    this.onCopyResultsClick = async (event: MouseEvent) => {
                      event.preventDefault();

                      // Collect the search results
                      let results = [];
                      const _children = this.vChildren?._children;

                      for (let item of _children) {
                        let filePath = item.file.path;
                        let matchesText = '';
                        const matches = item.vChildren?._children;
                        for (let match of matches) {
                          let content = match.parent.content.substring(match.start, match.end);
                          matchesText += content + '\n';
                        }
                        results.push(`## ${filePath}\n${matchesText}`);
                      }

                      let resultsText = results.join('\n');
                      try {
                        await navigator.clipboard.writeText(resultsText);
                        new Notice('Search results copied to clipboard.');
                      } catch (err) {
                        console.error('Failed to copy search results:', err);
                        new Notice('Failed to copy search results.');
                      }
                    };


                    this.headerDom = new _SearchHeaderDOM(this.app, this.el.parentElement);
                    defaultHeaderEl?.insertAdjacentElement("afterend", this.headerDom.navHeaderEl);
                    plugin.embeddedSearchResultDoms.add(this);
                    plugin.applyEmbeddedSearchControlVisibility(this);

                    const allSettings: Record<string, any> = {};
                    allSettings.collapsed = plugin.settings.defaultCollapse;
                    allSettings.context = plugin.settings.defaultShowContext;
                    allSettings.hideTitle = plugin.settings.defaultHideTitle;
                    allSettings.hideResults = plugin.settings.defaultHideResults;
                    allSettings.renderMarkdown = plugin.settings.defaultRenderMarkdown;
                    allSettings.sort = plugin.settings.defaultSortOrder;

                    if (!this.settings) this.settings = {};
                    Object.entries(allSettings).forEach(([setting, defaultValue]) => {
                      if (!Object.prototype.hasOwnProperty.call(this.settings, setting)) {
                        this.settings[setting] = defaultValue;
                      } else if (
                          setting === "sort" &&
                          typeof this.settings.sort === "string" &&
                          !sortOptions.some(option => option.key === this.settings.sort)
                      ) {
                        this.settings[setting] = defaultValue;
                      }
                    });

                    const hasSetting = (key: string) => Object.prototype.hasOwnProperty.call(this.settings, key);

                    if (typeof this.settings.context === "boolean") {
                      this.setExtraContext(this.settings.context);
                    }
                    if (typeof this.settings.sort === "string") {
                      this.sortOrder = this.settings.sort;
                      this.setSortOrder(this.settings.sort);
                    }
                    if (typeof this.settings.collapsed === "boolean") {
                      this.setCollapseAll(this.settings.collapsed);
                    }
                    if (typeof this.settings.hideTitle === "boolean") {
                      this.setTitleDisplay(this.settings.hideTitle);
                    }
                    if (typeof this.settings.renderMarkdown === "boolean") {
                      this.setRenderMarkdown(this.settings.renderMarkdown);
                    }
                    if (typeof this.settings.hideResults === "boolean") {
                      this.setResultsDisplay(this.settings.hideResults);
                    }
                  }
                }
              } catch (err) {
                console.error('Error in SearchResultDOM.startLoader around patch:', err);
              }
              const result = old.call(this, ...args);
              return result;
            };
          }
          ,
        })
    );
  }

  patchSearchResultItem(SearchResultItemClass: typeof SearchResultItem) {
    this.isSearchResultItemPatched = true;
    const plugin = this;
    let uninstall = around(SearchResultItemClass.prototype, {
      onResultClick(old: any) {
        return function (event: MouseEvent, e: any, ...args: any[]) {
          if (
              // TODO: Improve this exclusion list which allows for clicking
              //       on elements without navigating to the match result
              event.target instanceof HTMLElement &&
              (event.target.hasClass("internal-link") ||
                  event.target.hasClass("task-list-item-checkbox") ||
                  event.target.hasClass("admonition-title-content"))
          ) {
            // Do nothing
          } else {
            return old.call(this, event, e, ...args);
          }
        };
      },
      renderContentMatches(old: any) {
        return function (...args: any[]) {
          // TODO: Move this to its own around registration and uninstall on patch
          const result = old.call(this, ...args);
          const _children = this.vChildren?._children;
          if (!plugin.isSearchResultItemMatchPatched && _children.length) {
            let SearchResultItemMatch = _children.first().constructor;
            plugin.patchSearchResultItemMatch(SearchResultItemMatch);
          }
          return result;
        };
      },
    });
    plugin.register(uninstall);
  }

  patchSearchResultItemMatch(SearchResultItemMatch: any) {
    this.isSearchResultItemMatchPatched = true;
    const plugin = this;
    plugin.register(
        around(SearchResultItemMatch.prototype, {
          render(old: any) {
            return function (...args: any[]) {
              // NOTE: if we don't mangle ```query blocks, we could end up with infinite query recursion
              let _parent = this.parentDom;
              let content = _parent.content.substring(this.start, this.end).replace("```query", "\\`\\`\\`query");
              let leadingSpaces = content.match(/^\s+/g)?.first();
              if (leadingSpaces) {
                content = content.replace(new RegExp(`^${leadingSpaces}`, "gm"), "");
              }
              let parentComponent = _parent.parent.parent;
              if (parentComponent && _parent.parent.renderMarkdown) {
                let component = parentComponent?.renderComponent;
                this.el.empty();
                let renderer = new SearchMarkdownRenderer(plugin.app, this.el, this);
                renderer.onRenderComplete = () => {
                  // TODO: See if we can improve measurement
                  // It exists because the markdown renderer is rendering async
                  // and the measurement processes are happening before the content has been rendered
                  _parent?.parent?.infinityScroll.measure(_parent, this);
                };
                component.addChild(renderer);
                renderer.renderer.set(content);
              } else {
                return old.call(this, ...args);
              }
            };
          },
        })
    );
  }

  patchSearchView(embeddedSearch: EmbeddedSearchClass) {
    const plugin = this;
    const EmbeddedSearch = embeddedSearch.constructor as typeof EmbeddedSearchClass;
    const SearchResult = embeddedSearch.dom.constructor as typeof SearchResultDOM;

    this.register(
        around(EmbeddedSearch.prototype, {
          onunload(old: any) {
            return function (...args: any[]) {
              if (this.dom) {
                plugin.embeddedSearchResultDoms.delete(this.dom);
              }
              if (this.renderComponent) {
                this.renderComponent.unload();
                this.dom = null;
                this.queue = null;
                this.renderComponent = null;
                this._children = null;
                this.containerEl = null;
              }

              const result = old.call(this, ...args);
              return result;
            };
          },
          onload(old: any) {
            return function (...args: any[]) {
              try {
                if (!this.renderComponent) {
                  this.renderComponent = new Component();
                  this.renderComponent.load();
                }
                this.dom.parent = this;
                let defaultHeaderEl = this.containerEl.parentElement.querySelector(
                    ".internal-query-header"
                ) as HTMLElement;
                let matches = this.query.matchAll(
                    /^(?<key>collapsed|context|hideTitle|renderMarkdown|hideResults|sort|title):\s*(?<value>.+?)$/gm
                );
                let settings: Record<string, string> = {};
                for (let match of matches) {
                  let value = match.groups.value.toLowerCase();
                  if (value === "true" || value === "false") {
                    match.groups.value = value === "true";
                  }
                  settings[match.groups.key] = match.groups.value;
                }
                this.query = this.query
                    .replace(/^((collapsed|context|hideTitle|renderMarkdown|hideResults|sort|title):.+?)$/gm, "")
                    .trim();
                defaultHeaderEl.setText(settings.title || this.query);
                this.dom.settings = settings;
              } catch (err) {
                console.error('Error in EmbeddedSearch.onload:', err);
              }
              const result = old.call(this, ...args);
              return result;
            };
          },
        })
    );
    this.patchSearchResultDOM(SearchResult);
  }

  patchBacklinksView(backlinks: BacklinksClass) {
    const plugin = this;
    const Backlink = backlinks.constructor as typeof EmbeddedSearchClass;
    const BacklinkDOM = backlinks.backlinkDom.constructor as typeof BacklinkDOMClass;

    this.register(
        around(Backlink.prototype, {
          onunload(old: any) {
            return function (...args: any[]) {
              if (this.backlinkDom) {
                plugin.backlinkControlContexts.delete(this.backlinkDom);
              }
              if (this.unlinkedDom) {
                plugin.backlinkControlContexts.delete(this.unlinkedDom);
              }
              if (this.renderComponent) {
                this.renderComponent.unload();
                this.dom = null;
                this.queue = null;
                this.renderComponent = null;
                this._children = null;
                this.containerEl = null;
              }
              const result = old.call(this, ...args);
              return result;
            };
          },
          onload(old: any) {
            return function (...args: any[]) {
              try {
                if (!this.renderComponent) {
                  this.renderComponent = new Component();
                  this.renderComponent.load();
                }

                if (!this.dom) {
                  console.warn('Backlink `dom` is undefined. Initializing default properties.');
                  this.dom = {};
                }

                this.backlinkDom.parent = this;
                this.unlinkedDom.parent = this;

                this.dom.settings = this.dom.settings || {};
              } catch (err) {
                console.error('Error in Backlink.onload:', err);
              }
              return old.call(this, ...args);
            };
          },
        })
    );
    this.patchSearchResultDOM(BacklinkDOM);
  }
}

function handleBacklinks(
    instance: BacklinkDOMClass,
    plugin: EmbeddedQueryControlPlugin,
    backlinksInstance: BacklinksClass
) {
  if (backlinksInstance) {
    const backlinks = backlinksInstance as any;
    const instanceDom = instance as any;
    backlinks.patched = true;
    instanceDom.setRenderMarkdown = function (value: boolean) {
      const doms = [backlinks.backlinkDom, backlinks.unlinkedDom];
      doms.forEach(dom => {
        dom.renderMarkdown = value;
        const _children = dom.vChildren?._children;
        _children.forEach((child: any) => {
          child.renderContentMatches();
        });
        dom.infinityScroll.invalidateAll();
        dom.childrenEl.toggleClass("cm-preview-code-block", value);
        dom.childrenEl.toggleClass("is-rendered", value);
      });
      this.renderMarkdownButtonEl?.toggleClass("is-active", value);
    };

    // Updated onCopyResultsClick method
    instanceDom.onCopyResultsClick = async (event: MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();

      // Collect the search results
      let results = [];
      const doms = [backlinks.backlinkDom, backlinks.unlinkedDom];

      for (let dom of doms) {
        const _children = dom.vChildren?._children;

        for (let item of _children) {
          let filePath = item.file.path;
          let matchesText = '';
          const matches = item.vChildren?._children;
          for (let match of matches) {
            let content = match.parent.content.substring(match.start, match.end);
            matchesText += content + '\n';
          }
          results.push(`## ${filePath}\n${matchesText}`);
        }
      }

      let resultsText = results.join('\n');
      try {
        await navigator.clipboard.writeText(resultsText);
      } catch (err) {
        console.error('Failed to copy backlinks:', err);
        new Notice('Failed to copy backlinks.');
      }
    };

    plugin.backlinkControlContexts.set(instance, backlinksInstance);
    plugin.applyBacklinkControlVisibility(instance, backlinksInstance);

    const allSettings: Record<string, any> = {};
    allSettings.collapsed = plugin.settings.defaultCollapse;
    allSettings.context = plugin.settings.defaultShowContext;
    allSettings.renderMarkdown = plugin.settings.defaultRenderMarkdown;
    allSettings.sort = plugin.settings.defaultSortOrder;

    if (!instanceDom.settings) instanceDom.settings = {};
    Object.entries(allSettings).forEach(([setting, defaultValue]) => {
      if (!Object.prototype.hasOwnProperty.call(instanceDom.settings, setting)) {
        instanceDom.settings[setting] = defaultValue;
      } else if (
          setting === "sort" &&
          typeof instanceDom.settings.sort === "string" &&
          !sortOptions.some(option => option.key === instanceDom.settings.sort)
      ) {
        instanceDom.settings[setting] = defaultValue;
      }
    });

    const hasSetting = (key: string) => Object.prototype.hasOwnProperty.call(instanceDom.settings, key);

    if (typeof instanceDom.settings.context === "boolean") {
      backlinks.setExtraContext(instanceDom.settings.context);
    }
    if (typeof instanceDom.settings.sort === "string") {
      backlinks.sortOrder = instanceDom.settings.sort;
    }
    if (typeof instanceDom.settings.collapsed === "boolean") {
      backlinks.setCollapseAll(instanceDom.settings.collapsed);
    }
    if (typeof instanceDom.settings.renderMarkdown === "boolean") {
      instanceDom.setRenderMarkdown(instanceDom.settings.renderMarkdown);
    }
  }
}

