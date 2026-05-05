import { Setting } from "obsidian";

import type { AISummarizerPluginSettings } from "@domain/settings";
import {
  createCustomTemplateReference,
  describeTemplateReference,
  getCustomTemplatePath,
  isBuiltinTemplateReference,
  listBuiltinTemplates,
  UNIVERSAL_FRONTMATTER_TEMPLATE_REFERENCE
} from "@services/obsidian/template-library";
import { SOURCE_TYPE_LABELS } from "@ui/settings-copy";

const CUSTOM_TEMPLATE_OPTION = "__custom__";

function getTemplateDropdownValue(templateReference: string): string {
  if (isBuiltinTemplateReference(templateReference)) {
    return UNIVERSAL_FRONTMATTER_TEMPLATE_REFERENCE;
  }

  return CUSTOM_TEMPLATE_OPTION;
}

export interface TemplatesSectionOptions {
  settings: AISummarizerPluginSettings;
  saveSettings: () => Promise<void>;
  onCreateCustomTemplateFile: () => void;
  onPickCustomTemplateFile: () => void;
  onRefresh: () => void;
}

export function renderTemplatesSection(containerEl: HTMLElement, options: TemplatesSectionOptions): void {
  containerEl.createEl("h3", { text: "筆記模板" });

  const builtinTemplates = listBuiltinTemplates();

  new Setting(containerEl)
    .setName("模板來源")
    .setDesc("選擇摘要筆記的輸出格式。可使用預設 frontmatter，或套用 vault 內的自訂模板。")
    .addDropdown((dropdown) => {
      dropdown.addOption(UNIVERSAL_FRONTMATTER_TEMPLATE_REFERENCE, "預設通用 Frontmatter");
      for (const template of builtinTemplates) {
        if (template.reference === UNIVERSAL_FRONTMATTER_TEMPLATE_REFERENCE) {
          continue;
        }
        dropdown.addOption(template.reference, template.label);
      }
      dropdown.addOption(CUSTOM_TEMPLATE_OPTION, "自訂模板");

      dropdown.setValue(getTemplateDropdownValue(options.settings.templateReference)).onChange(async (value) => {
        if (value === CUSTOM_TEMPLATE_OPTION) {
          if (
            options.settings.templateReference.trim().length === 0 ||
            isBuiltinTemplateReference(options.settings.templateReference)
          ) {
            options.settings.templateReference = createCustomTemplateReference("Templates/ai-summary-template.md");
          }
        } else {
          options.settings.templateReference = value;
        }

        await options.saveSettings();
        options.onRefresh();
      });
    });

  const templateStatusEl = containerEl.createDiv({ cls: "ai-summarizer-template-status" });
  templateStatusEl.setText(describeTemplateReference(options.settings.templateReference));

  if (getTemplateDropdownValue(options.settings.templateReference) === CUSTOM_TEMPLATE_OPTION) {
    new Setting(containerEl)
      .setName("自訂模板路徑")
      .setDesc("請填入 vault 內的相對路徑，例如 `Templates/ai-summary-template.md`。")
      .addText((text) =>
        text
          .setPlaceholder("Templates/ai-summary-template.md")
          .setValue(getCustomTemplatePath(options.settings.templateReference))
          .onChange(async (value) => {
            options.settings.templateReference = createCustomTemplateReference(value);
            await options.saveSettings();
            options.onRefresh();
          })
      )
      .addButton((button) =>
        button.setButtonText("選資料夾與模板").onClick(() => {
          options.onPickCustomTemplateFile();
        })
      )
      .addButton((button) =>
        button.setButtonText("建立範本").onClick(() => {
          options.onCreateCustomTemplateFile();
        })
      );
  }

  const templateListEl = containerEl.createEl("ul");
  for (const template of builtinTemplates) {
    templateListEl.createEl("li", {
      text: `${template.label}: ${template.description} 支援 ${template.supportedSourceTypes
        .map((sourceType) => SOURCE_TYPE_LABELS[sourceType])
        .join("、")}`
    });
  }
}
