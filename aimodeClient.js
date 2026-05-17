import { chromium } from 'playwright';
import { SELECTORS } from './selectors.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const AIMODE_URL = process.env.AIMODE_URL || 'https://www.google.com/aimode';

function nowIso() {
  return new Date().toISOString();
}

function shortText(text, maxLength = 160) {
  if (!text) return '';

  const normalized = String(text).replace(/\s+/g, ' ').trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength)}...`;
}

export class AiModeClient {
  constructor(options = {}) {
    this.context = null;
    this.chats = new Map();

    this.headless = options.headless ?? true;
    this.userDataDir = options.userDataDir ?? '/app/data/sessions/google-profile';

    this.locale = options.locale ?? 'it-IT';
    this.timezoneId = options.timezoneId ?? 'Europe/Rome';
    this.userAgent = options.userAgent;
  }

  async init() {
    try {
      await fs.mkdir(this.userDataDir, { recursive: true });

      const contextOptions = {
        headless: this.headless,
        viewport: {
          width: 1440,
          height: 1000
        },
        locale: this.locale,
        timezoneId: this.timezoneId,
        args: [
          '--disable-dev-shm-usage'
        ]
      };

      if (this.userAgent) {
        contextOptions.userAgent = this.userAgent;
      }

      this.context = await chromium.launchPersistentContext(
        this.userDataDir,
        contextOptions
      );

      this.context.setDefaultTimeout(10000);
    } catch (error) {
      console.error(`[${nowIso()}] [ERROR] [INIT] Failed to initialize browser context`);
      console.error(`[${nowIso()}] [ERROR] [INIT] ${error.stack || error.message}`);
      throw error;
    }
  }

  async close() {
    if (this.context) {
      try {
        await this.context.close();
      } catch (error) {
        console.error(`[${nowIso()}] [ERROR] [CLOSE] Failed to close context`);
        console.error(`[${nowIso()}] [ERROR] [CLOSE] ${error.stack || error.message}`);
      }
    }
  }

  async closeChat(chatId) {
    const chat = this.getChat(chatId);

    try {
      await chat.page.close();
      this.chats.delete(chatId);

      return {
        closed: true,
        chatId,
        activeChats: this.chats.size
      };
    } catch (error) {
      console.error(`[${nowIso()}] [ERROR] [CLOSE_CHAT] ${error.stack || error.message}`);
      throw error;
    }
  }

  getChat(chatId) {
    const chat = this.chats.get(chatId);

    if (!chat) {
      console.error(`[${nowIso()}] [ERROR] [GET_CHAT] Chat not found: ${chatId}`);
      console.error(`[${nowIso()}] [ERROR] [GET_CHAT] Current chat count=${this.chats.size}`);
      throw new Error(`Chat non trovata: ${chatId}`);
    }

    return chat;
  }

  async newChat() {
    let page;

    try {
      page = await this.context.newPage();

      page.on('pageerror', (error) => {
        console.error(`[${nowIso()}] [PAGE_ERROR] ${error.stack || error.message}`);
      });

      page.on('requestfailed', (request) => {
        console.error(
          `[${nowIso()}] [REQUEST_FAILED] ${request.method()} ${request.url()} :: ${request.failure()?.errorText}`
        );
      });

      await page.goto(AIMODE_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });

      await this.acceptCookiesIfPresent(page);

      const textarea = page
        .locator(SELECTORS.promptTextarea)
        .filter({ visible: true })
        .last();

      await textarea.waitFor({
        state: 'visible',
        timeout: 10000
      });

      const chatId = crypto.randomUUID();
      const createdAt = nowIso();

      this.chats.set(chatId, {
        id: chatId,
        page,
        createdAt
      });

      return {
        chatId,
        url: page.url(),
        createdAt,
        browserLocale: this.locale,
        browserTimezone: this.timezoneId
      };
    } catch (error) {
      console.error(`[${nowIso()}] [ERROR] [NEW_CHAT] Failed`);
      console.error(`[${nowIso()}] [ERROR] [NEW_CHAT] ${error.stack || error.message}`);

      throw error;
    }
  }

  async acceptCookiesIfPresent(page) {
    const button = page.locator(SELECTORS.acceptCookiesButton).first();

    try {
      await button.waitFor({
        state: 'visible',
        timeout: 5000
      });

      await button.click();
    } catch (_) {
    }
  }

  async sendMessage(chatId, message) {
    const chat = this.getChat(chatId);
    const { page } = chat;

    try {
      const textarea = page
        .locator(SELECTORS.promptTextarea)
        .filter({ visible: true })
        .last();

      await textarea.waitFor({
        state: 'visible',
        timeout: 10000
      });

      await textarea.click();

      await textarea.fill(message);

      await page.evaluate((text) => {
        const textarea = [...document.querySelectorAll('textarea.ITIRGe')]
          .find((el) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);

            return (
              rect.width > 0 &&
              rect.height > 0 &&
              style.visibility !== 'hidden' &&
              style.display !== 'none'
            );
          });

        if (!textarea) {
          throw new Error('Textarea visibile textarea.ITIRGe non trovata');
        }

        textarea.focus();

        const valueDescriptor = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        );

        const nativeSetter = valueDescriptor?.set;

        if (nativeSetter) {
          nativeSetter.call(textarea, text);
        } else {
          textarea.value = text;
        }

        textarea.dispatchEvent(new Event('input', {
          bubbles: true,
          cancelable: true
        }));

        const lastChar = text.slice(-1) || ' ';
        const keyCode = lastChar.toUpperCase().charCodeAt(0);

        textarea.dispatchEvent(new KeyboardEvent('keydown', {
          key: lastChar,
          code: `Key${lastChar.toUpperCase()}`,
          keyCode,
          which: keyCode,
          bubbles: true,
          cancelable: true
        }));

        textarea.dispatchEvent(new KeyboardEvent('keyup', {
          key: lastChar,
          bubbles: true
        }));
      }, message);

      const textareaState = await page.evaluate((selector) => {
        const textareas = [...document.querySelectorAll(selector)];

        const visibleTextarea = textareas.find((el) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);

          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none'
          );
        });

        return {
          totalCount: textareas.length,
          visibleExists: Boolean(visibleTextarea),
          valueLength: visibleTextarea?.value?.length ?? null,
          valuePreview: visibleTextarea?.value ? visibleTextarea.value.slice(0, 120) : null
        };
      }, SELECTORS.promptTextarea);

      const sendButton = page
        .locator(SELECTORS.sendButton)
        .filter({ visible: true })
        .last();

      await sendButton.waitFor({
        state: 'visible',
        timeout: 10000
      });

      const sendButtonState = await page.evaluate((selector) => {
        const buttons = [...document.querySelectorAll(selector)];

        const visibleButton = buttons.find((el) => {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);

          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== 'hidden' &&
            style.display !== 'none'
          );
        });

        return {
          totalCount: buttons.length,
          visibleExists: Boolean(visibleButton),
          disabled: visibleButton?.disabled ?? null,
          ariaDisabled: visibleButton?.getAttribute?.('aria-disabled') ?? null,
          innerText: visibleButton?.innerText ?? null,
          className: visibleButton?.className ?? null
        };
      }, SELECTORS.sendButton);

      await sendButton.click();

      const completion = await this.waitForCompletionMarker(page, message);

      const conversation = await this.readConversation(chatId);
      const lastMessage = conversation.at(-1) ?? null;

      return {
        completion,
        lastMessage
      };
    } catch (error) {
      console.error(`[${nowIso()}] [ERROR] [SEND_MESSAGE] Failed`);
      console.error(`[${nowIso()}] [ERROR] [SEND_MESSAGE] ${error.stack || error.message}`);

      throw error;
    }
  }

  async waitForCompletionMarker(page, expectedUserText, timeoutMs = 20000) {
    const start = Date.now();

    try {
      const handle = await page.waitForFunction(
        ({ selectors, expectedUserText }) => {
          const normalize = (value) =>
            String(value ?? '')
              .replace(/\s+/g, ' ')
              .trim();

          const expected = normalize(expectedUserText);

          const blocks = [
            ...document.querySelectorAll(selectors.conversationBlocks)
          ];

          if (blocks.length === 0) {
            return null;
          }

          /**
           * Cerca dal fondo il blocco che corrisponde all'ultimo messaggio utente.
           * Non usiamo marker globali, perché quelli dei messaggi precedenti restano nel DOM.
           */
          for (let i = blocks.length - 1; i >= 0; i--) {
            const block = blocks[i];

            const userNode = block.querySelector(selectors.userText);
            const userText = normalize(userNode?.innerText ?? '');

            if (userText !== expected) {
              continue;
            }

            const replyNode = block.querySelector(selectors.botReply);
            const markerNode = block.querySelector(selectors.completionMarker);

            const botText = normalize(replyNode?.innerText ?? '');

            if (!replyNode || !botText) {
              return null;
            }

            if (!markerNode) {
              return null;
            }

            return {
              complete: true,
              completionSignal: selectors.completionMarker,
              blockIndex: i,
              blockCount: blocks.length,
              matchedUserText: userText,
              botTextLength: botText.length
            };
          }

          return null;
        },
        {
          selectors: SELECTORS,
          expectedUserText
        },
        {
          timeout: timeoutMs
        }
      );

      const value = await handle.jsonValue();

      const result = {
        ...value,
        waitedMs: Date.now() - start
      };

      return result;
    } catch (error) {
      console.error(`[${nowIso()}] [ERROR] [WAIT_COMPLETION] Failed or timed out`);
      console.error(`[${nowIso()}] [ERROR] [WAIT_COMPLETION] waitedMs=${Date.now() - start}`);
      console.error(`[${nowIso()}] [ERROR] [WAIT_COMPLETION] ${error.stack || error.message}`);

      throw error;
    }
  }

  async readConversation(chatId) {

    const chat = this.getChat(chatId);
    const { page } = chat;

    try {

      const conversation = await page.evaluate((selectors) => {
        const chatBox = document.querySelector(selectors.chatBox);

        if (!chatBox) {
          return {
            foundChatBox: false,
            blocksCount: 0,
            conversation: []
          };
        }

        const blocks = [
          ...chatBox.querySelectorAll(selectors.conversationBlocks)
        ];

        const conversation = blocks.map((block, index) => {
          const userNode = block.querySelector(selectors.userText);
          const replyNode = block.querySelector(selectors.botReply);

          const userText = userNode?.innerText?.trim() ?? '';

          let botText = '';

          if (replyNode) {
            const clonedReply = replyNode.cloneNode(true);

            for (const removableSelector of selectors.removableBlocks) {
              clonedReply
                .querySelectorAll(removableSelector)
                .forEach(node => node.remove());
            }

            botText = clonedReply.innerText?.trim() ?? '';
          }

          const ignoredLinkHrefs = selectors.ignoredLinkHrefs ?? [];

          const links = replyNode
            ? [
              ...new Map(
                [...replyNode.querySelectorAll('a[href]')]
                  .map((a) => ({
                    text: a.innerText?.trim() ?? '',
                    href: a.href
                  }))
                  .filter((link) => {
                    return !ignoredLinkHrefs.some((ignoredHref) => {
                      return link.href === ignoredHref || link.href.startsWith(ignoredHref);
                    });
                  })
                  .map((link) => [link.href, link])
              ).values()
            ].sort((a, b) => {
              const hrefCompare = a.href.localeCompare(b.href);

              if (hrefCompare !== 0) {
                return hrefCompare;
              }

              return a.text.localeCompare(b.text);
            })
            : [];

          return {
            index,
            userText,
            botText,
            links
          };
        });

        return {
          foundChatBox: true,
          blocksCount: blocks.length,
          conversation
        };
      }, SELECTORS);

      return conversation.conversation;
    } catch (error) {
      console.error(`[${nowIso()}] [ERROR] [READ_CONVERSATION] Failed`);
      console.error(`[${nowIso()}] [ERROR] [READ_CONVERSATION] ${error.stack || error.message}`);

      throw error;
    }
  }

  async readLastMessage(chatId) {
    const conversation = await this.readConversation(chatId);
    return conversation.at(-1) ?? null;
  }
}
