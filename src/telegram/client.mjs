import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
// @ts-ignore
import input from "input";

class TelegramPluginClient {
  constructor(apiId, apiHash, stringSession = "") {
    this.apiId = apiId
    this.apiHash = apiHash
    this.stringSession = new StringSession(stringSession)
  }

  getStringSession = async () => {
    const client = new TelegramClient(this.stringSession, this.apiId, this.apiHash, {
      connectionRetries: 5,
    });

    await client.start({
      phoneNumber: async () => await input.text("Please enter your number: "),
      password: async () => await input.text("Please enter your password: "),
      phoneCode: async () =>
        await input.text("Please enter the code you received: "),
      onError: (err) => console.log(err),
    });

    console.log('client.session', client.session.save())

    return client.session.save()
  };

  sendMessageToTeletypeBot = async (title, notice) => {
    const client = new TelegramClient(this.stringSession, this.apiId, this.apiHash, {
      connectionRetries: 5,
    });

    try {
      await client.connect();

      await client.sendMessage("TeletypeAppBot", { message: "/new_post" });

      await client.sendMessage("TeletypeAppBot", { message: title });

      for (const chunk of notice) {
        if (chunk && typeof chunk === 'object' && chunk.type === 'media') {
          await client.sendMessage("TeletypeAppBot", { file: chunk.path });
        } else if (chunk && chunk.length) {
          await client.sendMessage("TeletypeAppBot", { message: chunk, parseMode: 'html' });
        }
      }

      await client.sendMessage("TeletypeAppBot", { message: "/finish_post" });
    } catch (exception) {
      alert(exception)
    }
  }
};

export default TelegramPluginClient;
