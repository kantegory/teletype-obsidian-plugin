import {
	App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting,
	MarkdownRenderer
} from 'obsidian';
import TelegramPluginClient from 'src/telegram/client.mjs';
import * as path from 'path';

interface TeletypeObsidianPluginSettings {
	telegramApiId: string;
	telegramApiHash: string;
	telegramStringSession: string;
}

const DEFAULT_SETTINGS: TeletypeObsidianPluginSettings = {
	telegramApiId: '',
	telegramApiHash: '',
	telegramStringSession: ''
}

const prepareHtml = (root: HTMLElement) => {
	const REMOVEABLE_ELEMENTS = ["BUTTON"];
	
	for (const removeableElement of REMOVEABLE_ELEMENTS) {
		Array.from(root.querySelectorAll(removeableElement)).forEach((element) => element.remove())
	};

	const children = Array.from(root.children);

	const ALLOWED_ELEMENTS = [
		"P",
		"PRE",
		"STRONG",
		"EM",
		"DEL",
		"H1",
		"H2",
		"H3",
		"H4",
		"H5",
		"H6",
		"A",
		"IMG",
		"CODE"
	];

	const preparedHtml = [];

	for (const child of children) {
		if (!ALLOWED_ELEMENTS.includes(child.tagName)) {
			continue
		};

		let preparedChild = child.innerHTML;

		if (child.tagName === 'PRE') {
			const codeBlock = child.querySelector('code');

			if (codeBlock) {
				codeBlock.classList.remove('is-loaded');
				preparedChild = `<pre>${codeBlock.outerHTML}</pre>`;
			}
			
		}

		preparedHtml.push(preparedChild);
	}

	return preparedHtml;
}

export default class TeletypeObsidianPlugin extends Plugin {
	settings: TeletypeObsidianPluginSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'teletype-obsidian-publish-command',
			name: 'Publish note into teletype',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				try {
					const tgClient = new TelegramPluginClient(
						this.settings.telegramApiId,
						this.settings.telegramApiHash,
						this.settings.telegramStringSession
					)

					const wrapper = document.createElement('div');
					wrapper.style.display = 'hidden';
					document.body.appendChild(wrapper);

					await MarkdownRenderer.renderMarkdown(view.data, wrapper, path.dirname(`${view.file?.basename}.${view.file?.extension}`), view)

					tgClient.sendMessageToTeletypeBot(
						view.file?.basename,
						// parseData(wrapper.children)
						prepareHtml(wrapper)
					)

					document.body.removeChild(wrapper);
				} catch (error) {
					alert(error)
				}
			}
		});

		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;

		contentEl.innerHTML = `
			<form>
				<label>
					<p>Input your phone number:</p>

					<input type="text" />
				</label>
			</form>
		`
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: TeletypeObsidianPlugin;

	constructor(app: App, plugin: TeletypeObsidianPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Telegram API ID')
			.setDesc('Paste your telegram API ID')
			.addText(text => text
				.setPlaceholder('Telegram API ID')
				.setValue(this.plugin.settings.telegramApiId)
				.onChange(async (value) => {
					this.plugin.settings.telegramApiId = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Telegram API Hash')
			.setDesc('Paste your telegram API Hash')
			.addText(text => text
				.setPlaceholder('Telegram API Hash')
				.setValue(this.plugin.settings.telegramApiHash)
				.onChange(async (value) => {
					this.plugin.settings.telegramApiHash = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Telegram string session')
			.setDesc('Paste your telegram string session')
			.addText(text => text
				.setPlaceholder('Telegram string session')
				.setValue(this.plugin.settings.telegramStringSession)
				.onChange(async (value) => {
					this.plugin.settings.telegramStringSession = value;
					await this.plugin.saveSettings();
				}));
	}
}
