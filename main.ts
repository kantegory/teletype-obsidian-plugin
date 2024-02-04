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
	vaultPath: string;
}

const DEFAULT_SETTINGS: TeletypeObsidianPluginSettings = {
	telegramApiId: '',
	telegramApiHash: '',
	telegramStringSession: '',
	vaultPath: ''
}

const prepareHtml = (root: HTMLElement, mediaRoot: string) => {
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

		const img = child.querySelector('[src]');

		if (img) {
			preparedHtml.push({ type: 'media', path: `${mediaRoot}/${img.textContent}` })

			continue;
		}

		preparedHtml.push(preparedChild);
	}

	return preparedHtml;
}

export default class TeletypeObsidianPlugin extends Plugin {
	settings: TeletypeObsidianPluginSettings;

	async onload() {
		await this.loadSettings();

		// команда для генерации и сохранения пользовательской сессии
		this.addCommand({
			id: 'teletype-obsidian-generate-session',
			name: 'Generate telegram string session',

			callback: async () => {
				try {
					if (this.settings.telegramStringSession) {
						alert('Session is already setted, remove it and repeat command')
					}

					const tgClient = new TelegramPluginClient(
						Number(this.settings.telegramApiId),
						this.settings.telegramApiHash,
						this.settings.telegramStringSession
					);

					const prompt = (type: 'phone' | 'code' | 'password') => {
						const modal = new TelegramAuthModal(this.app, type);

						modal.open();

						return new Promise(
							(resolve, reject) => {
								try {
									let value = '';

									// @ts-ignore
									modal.containerEl.querySelector('form').addEventListener('submit', (event) => {
										event.preventDefault();
										// @ts-ignore
										value = event.target.querySelector('input').value;

										modal.close();

										resolve(value);
									});
								} catch (error) {
									reject(error)
								}
							}
						);
					}

					// @ts-ignore
					const stringSession: string = await tgClient.getStringSession(prompt);

					// обновим настройки
					this.settings.telegramStringSession = stringSession;
					this.saveSettings();
				} catch (error) {
					alert(`error while try to generate session: ${error}`)
				}
			}
		});

		// команда для публикации текущей заметки
		this.addCommand({
			id: 'teletype-obsidian-publish-command',
			name: 'Publish note into teletype',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				try {
					if (!this.settings.telegramStringSession) {
						alert("Can't publish anything without session param")
					}

					const tgClient = new TelegramPluginClient(
						Number(this.settings.telegramApiId),
						this.settings.telegramApiHash,
						this.settings.telegramStringSession
					)

					const wrapper = document.createElement('div');
					wrapper.style.display = 'hidden';
					document.body.appendChild(wrapper);

					await MarkdownRenderer.renderMarkdown(view.data, wrapper, path.dirname(`${view.file?.basename}.${view.file?.extension}`), view)

					// @ts-ignore
					const attachmentFolderPath = `${this.settings.vaultPath}/${view.app.vault.getConfig("attachmentFolderPath") || ''}`;

					tgClient.sendMessageToTeletypeBot(
						view.file?.basename,
						prepareHtml(wrapper, attachmentFolderPath)
					)

					document.body.removeChild(wrapper);
				} catch (error) {
					alert(error)
				}
			}
		});

		// добавим раздел с настройками
		this.addSettingTab(new TeletypeObsidianPluginSettingsTab(this.app, this));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class TelegramAuthModal extends Modal {
	type: 'phone' | 'code' | 'password';

	constructor(app: App, type: 'phone' | 'code' | 'password') {
		super(app);

		this.type = type
	}

	onOpen() {
		const {contentEl} = this;

		const LABELS_MATCHING = {
			'phone': 'Input your phone number:',
			'code': 'Input your Telegram verification code:',
			'password': 'Input your password:',
		}

		contentEl.innerHTML = `
			<form data-id="telegram-session-form">
				<label>
					<p>${LABELS_MATCHING[this.type]}</p>

					<input name="${this.type}" type="${this.type === 'password' ? 'password' : 'text'}" />
				</label>

				<br>
				<br>

				<div>
					<button type="submit">${this.type === 'password' ? 'Save session params' : 'Next'}</button>
				</div>
			</form>
		`
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class TeletypeObsidianPluginSettingsTab extends PluginSettingTab {
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
		
		new Setting(containerEl)
			.setName('Absolute path to your vault')
			.setDesc('This setting necessary just for media files extraction from your note')
			.addText(text => text
				.setPlaceholder('Absolute path to your vault')
				.setValue(this.plugin.settings.vaultPath)
				.onChange(async (value) => {
					this.plugin.settings.vaultPath = value;
					await this.plugin.saveSettings();
				}));
	}
}
