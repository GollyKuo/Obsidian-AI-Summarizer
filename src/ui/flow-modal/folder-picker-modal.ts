import { Modal } from "obsidian";

import type AISummarizerPlugin from "@plugin/AISummarizerPlugin";
import type { VaultFolderTreeNode } from "@ui/flow-modal/types";

export class FlowVaultFolderTreeModal extends Modal {
  public constructor(
    plugin: AISummarizerPlugin,
    private readonly rootNode: VaultFolderTreeNode,
    private readonly selectedFolderPath: string,
    private readonly onChooseFolder: (folderPath: string) => void
  ) {
    super(plugin.app);
    this.modalEl.addClass("ai-summarizer-flow", "ai-summarizer-flow-folder-picker");
    this.contentEl.addClass("ai-summarizer-flow-content");
    this.setTitle("選擇輸出資料夾");
  }

  public onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();

    const treeEl = contentEl.createDiv({ cls: "ai-summarizer-flow-folder-tree" });
    this.renderFolderNode(treeEl, this.rootNode, 0, new Set(), true);
  }

  public onClose(): void {
    this.contentEl.empty();
  }

  private renderFolderNode(
    containerEl: HTMLElement,
    node: VaultFolderTreeNode,
    depth: number,
    ancestorNodes: Set<VaultFolderTreeNode>,
    expanded = false
  ): void {
    if (ancestorNodes.has(node)) {
      return;
    }

    const rowEl = containerEl.createDiv({ cls: "ai-summarizer-flow-folder-row" });
    rowEl.style.setProperty("--ais-folder-tree-depth", String(depth));
    const isSelected = node.path === this.selectedFolderPath;
    rowEl.setAttribute("data-selected", String(isSelected));

    const toggleEl = rowEl.createSpan({ cls: "ai-summarizer-flow-folder-toggle" });
    toggleEl.setText(node.children.length > 0 ? (expanded ? "v" : ">") : "");
    rowEl.createSpan({ cls: "ai-summarizer-flow-folder-icon" });
    rowEl.createSpan({ cls: "ai-summarizer-flow-folder-label", text: node.name });
    rowEl.title = node.path || "Vault 根目錄";
    rowEl.setAttr("role", "button");
    rowEl.tabIndex = 0;

    const chooseFolder = (): void => {
      this.onChooseFolder(node.path);
      this.close();
    };
    rowEl.addEventListener("click", chooseFolder);
    rowEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      event.preventDefault();
      chooseFolder();
    });

    if (node.children.length === 0) {
      return;
    }

    const childrenEl = containerEl.createDiv({ cls: "ai-summarizer-flow-folder-children" });
    childrenEl.style.display = expanded ? "" : "none";
    const childAncestors = new Set(ancestorNodes);
    childAncestors.add(node);
    for (const child of node.children) {
      this.renderFolderNode(childrenEl, child, depth + 1, childAncestors);
    }

    const toggleChildren = (): void => {
      const isOpen = childrenEl.style.display !== "none";
      childrenEl.style.display = isOpen ? "none" : "";
      toggleEl.setText(isOpen ? ">" : "v");
      rowEl.setAttr("aria-expanded", String(!isOpen));
    };
    rowEl.setAttr("aria-expanded", String(expanded));
    toggleEl.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleChildren();
    });
  }
}
