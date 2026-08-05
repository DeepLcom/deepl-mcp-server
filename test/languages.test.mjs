import { describe, expect, it, vi } from "vitest";
import { LanguageCache, LanguagesList } from "../src/languages.mjs";

const sourceLangs = [
  { name: "English", code: "EN" },
  { name: "German", code: "DE" },
  { name: "Portuguese", code: "PT" },
];

const targetLangs = [
  { name: "English (American)", code: "EN-US" },
  { name: "German", code: "DE" },
  { name: "Portuguese (Brazilian)", code: "PT-BR" },
  { name: "Chinese (simplified)", code: "ZH-HANS" },
];

function createClient() {
  return {
    getSourceLanguages: vi.fn(async () => sourceLangs),
    getTargetLanguages: vi.fn(async () => targetLangs),
  };
}

describe("LanguagesList.normalize for target languages", () => {
  const list = () => LanguagesList.create(createClient(), "target");

  it("returns the country default for languages that need one", async () => {
    const languages = await list();
    expect(languages.normalize("en")).toBe("en-US");
    expect(languages.normalize("pt")).toBe("pt-BR");
    expect(languages.normalize("zh")).toBe("zh-Hans");
  });

  it("accepts codes regardless of case", async () => {
    const languages = await list();
    expect(languages.normalize("DE")).toBe("de");
    expect(languages.normalize("EN-US")).toBe("en-us");
  });

  it("rejects an unknown code and lists the available ones", async () => {
    const languages = await list();
    expect(() => languages.normalize("XX")).toThrow(
      "Invalid language code: xx. Available codes: en-us, de, pt-br, zh-hans",
    );
  });
});

describe("LanguagesList.normalize for source languages", () => {
  const list = () => LanguagesList.create(createClient(), "source");

  it("strips the region from a locale", async () => {
    const languages = await list();
    expect(languages.normalize("en-US")).toBe("en");
    expect(languages.normalize("en")).toBe("en");
  });

  it("does not apply the target country defaults", async () => {
    const languages = await list();
    expect(languages.normalize("pt")).toBe("pt");
  });

  it("rejects an unknown code", async () => {
    const languages = await list();
    expect(() => languages.normalize("xx-YZ")).toThrow("Invalid language code: xx-yz");
  });
});

describe("LanguageCache", () => {
  it("fetches each direction only once", async () => {
    const client = createClient();
    const cache = new LanguageCache(client);

    const [first, second] = await Promise.all([cache.get("source"), cache.get("source")]);

    expect(first).toBe(second);
    expect(client.getSourceLanguages).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failed fetch", async () => {
    const client = createClient();
    client.getSourceLanguages
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(sourceLangs);
    const cache = new LanguageCache(client);

    await expect(cache.get("source")).rejects.toThrow("network down");
    const languages = await cache.get("source");

    expect(languages.codesList).toBe("en, de, pt");
    expect(client.getSourceLanguages).toHaveBeenCalledTimes(2);
  });
});
