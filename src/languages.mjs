/**
 * Class to handle a list of languages and associated ISO-639 codes.
 * We normalize all language codes to lowercase
 * so that lowercase/uppercase differences don't inspire mistakes.
 *
 * @property {Array<{name: string, code: string}>} list
 * @property {string} codesList - Comma-separated list of all language codes
 */

export class LanguagesList {
  static countryDefaults = {
    en: "en-US",
    pt: "pt-BR",
    zh: "zh-Hans",
  };

  constructor(list, direction = null) {
    this.list = list;
    this.codesList = list.map((lang) => lang.code).join(", ");
    this.direction = direction;
  }

  static async create(deeplClient, direction) {
    if (direction != "source" && direction !== "target") {
      throw new Error('LanguagesList needs to be called with "target" or "source"');
    }

    const method = direction === "source" ? "getSourceLanguages" : "getTargetLanguages";
    const langs = await deeplClient[method]();
    const lowerCaseLangs = langs.map(({ name, code }) => ({ name, code: code.toLowerCase() }));
    const instance = new LanguagesList(lowerCaseLangs, direction);
    return instance;
  }

  /**
   * Given an ISO-639 language code, throw an error if it's not in our codes list
   * @param {string} code
   *
   * At present, our client libraries don't accept two-letter language codes for target_lang
   * for cases where we support _locales_ - a language code plus country code, like "en-US".
   * For example, if you specify `target_lang="en"`, you'll get an error. We want "en-US" or "en-UK".
   * But in this server we don't want to reject such `target_lang`'s, because AI clients
   * often want to send them.
   *
   * So we're changing the `validate()` method to `normalize()`. We will still throw an error if
   * we're passed an invalid code. But if we're passed a code that requires a country code as well,
   * like "pt", we'll return the default, like "pt-BR".
   */
  normalize(code) {
    const lowerCode = code.toLowerCase();
    let countryDefault;

    // For target languages, if a language requires a country code (like pt-BR), return that
    if (
      this.direction === "target" &&
      (countryDefault = LanguagesList.countryDefaults[lowerCode])
    ) {
      return countryDefault;
    }

    if (this.list.some((lang) => lang.code === lowerCode)) {
      return lowerCode;
    }

    const baseCode = lowerCode.split("-")[0];
    if (this.direction === "source" && this.list.some((lang) => lang.code === baseCode)) {
      return baseCode;
    }

    throw new Error(`Invalid language code: ${lowerCode}. Available codes: ${this.codesList}`);
  }
}

export class LanguageCache {
  #deeplClient;
  #pending = new Map();

  constructor(deeplClient) {
    this.#deeplClient = deeplClient;
  }

  async get(direction) {
    let pending = this.#pending.get(direction);

    if (!pending) {
      pending = LanguagesList.create(this.#deeplClient, direction).catch((error) => {
        this.#pending.delete(direction);
        throw error;
      });
      this.#pending.set(direction, pending);
    }

    return pending;
  }
}
