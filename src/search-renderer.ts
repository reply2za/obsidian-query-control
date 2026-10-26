import { App, MarkdownRenderChild, MarkdownRenderer, TFile } from "obsidian";

export class SearchMarkdownRenderer extends MarkdownRenderChild {
  app: App;
  match: any;
  filePath: string;
  file: TFile;

  constructor(app: App, containerEl: HTMLElement, match: any) {
    super(containerEl);
    this.app = app;
    this.match = match;
    this.filePath = this.match.parentDom.path;
    this.file = this.match.parentDom.file;
  }

  onRenderComplete() {}

  async render(content: string) {
    this.containerEl.empty();
    try {
      await MarkdownRenderer.render(this.app, content, this.containerEl, this.filePath, this);
      this.applyOptions();
    } catch (err) {
      console.error("Query Control: failed to render markdown for search result.", err);
    }
    this.onRenderComplete();
  }

  applyOptions() {
    const el = this.containerEl;
    el.toggleClass("is-readable-line-width", this.app.vault.getConfig("readableLineLength"));
    el.toggleClass("allow-fold-headings", this.app.vault.getConfig("foldHeading"));
    el.toggleClass("allow-fold-lists", this.app.vault.getConfig("foldIndent"));
    el.toggleClass("rtl", this.app.vault.getConfig("rightToLeft"));
    el.toggleClass("show-frontmatter", this.app.vault.getConfig("showFrontmatter"));
    const tabSize = this.app.vault.getConfig("tabSize");
    el.style.setProperty("--tab-size", `${tabSize}px`);
  }
}
