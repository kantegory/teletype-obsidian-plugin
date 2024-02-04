import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
// @ts-ignore
import input from "input";

class TelegramPluginClient {
  constructor(apiId, apiHash, stringSession = "") {
    this.apiId = apiId
    this.apiHash = apiHash
    this.stringSession = new StringSession(stringSession)

    this.client = new TelegramClient(this.stringSession, this.apiId, this.apiHash, {
      connectionRetries: 5,
    });
  }

  getStringSession = async (prompt) => {
    try {
      await this.client.start({
        phoneNumber: async () => await prompt('phone'),
        phoneCode: async () => await prompt('code'),
        password: async () => await prompt('password'),
        onError: (err) => alert(`ERROR WHILE LOGIN: ${err}`),
      });

      alert(`client session: ${this.client.session.save()}`)

      return this.client.session.save()
    } catch (error) {
      alert(`error from get string session ${error}`)
    }
  };

  sendMessageToTeletypeBot = async (title, notice) => {
    await this.client.connect();

    await this.client.sendMessage("TeletypeAppBot", { message: "/new_post" });

    await this.client.sendMessage("TeletypeAppBot", { message: title });

    for (const chunk of notice) {
      if (chunk && typeof chunk === 'object' && chunk.type === 'media') {
        await this.client.sendMessage("TeletypeAppBot", { file: chunk.path });
      } else if (chunk && chunk.length) {
        await this.client.sendMessage("TeletypeAppBot", { message: chunk, parseMode: 'html' });
      }
    }

    await this.client.sendMessage("TeletypeAppBot", { message: "/finish_post" });
  }
};

export default TelegramPluginClient;

