import { describe, it, expect } from "vitest";
import { escapeHtml, safeUrl, renderTemplate, htmlToText } from "./render";
import { EMAIL_TEMPLATES, EMAIL_TEMPLATE_KEYS } from "./templates";

describe("escapeHtml", () => {
  it("escapes the characters that can break out of markup", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
    );
    expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
    expect(escapeHtml("it's")).toBe("it&#39;s");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeHtml("Acme Traders Pvt Ltd")).toBe("Acme Traders Pvt Ltd");
  });
});

describe("safeUrl", () => {
  it("passes http and https through", () => {
    expect(safeUrl("https://example.com/invite/abc")).toBe("https://example.com/invite/abc");
    expect(safeUrl("http://localhost:3000/verify")).toBe("http://localhost:3000/verify");
  });

  it("refuses script-bearing schemes", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("#");
    expect(safeUrl("data:text/html,<script>alert(1)</script>")).toBe("#");
    expect(safeUrl("not a url at all")).toBe("#");
  });

  it("escapes a quote that would otherwise close the href attribute", () => {
    expect(safeUrl('https://example.com/?a="onload="alert(1)')).not.toContain('"');
  });
});

describe("renderTemplate", () => {
  it("substitutes placeholders", () => {
    expect(renderTemplate("Hi {{NAME}}", { NAME: "Rauhan" })).toBe("Hi Rauhan");
  });

  it("tolerates whitespace inside the braces", () => {
    expect(renderTemplate("Hi {{ NAME }}", { NAME: "Rauhan" })).toBe("Hi Rauhan");
  });

  it("renders an unknown placeholder as empty rather than showing the raw token", () => {
    expect(renderTemplate("Hi {{MISSING}}!", {})).toBe("Hi !");
  });

  it("escapes interpolated values", () => {
    // The injection the previous raw-HTML invitation mail allowed: a crafted
    // workspace name became markup inside a genuine BusinessOS email.
    const html = renderTemplate("<p>{{BUSINESS_NAME}}</p>", {
      BUSINESS_NAME: '<img src=x onerror="alert(1)">',
    });

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("cannot be used to break out of an href", () => {
    const html = renderTemplate('<a href="{{INVITE_URL}}">go</a>', {
      INVITE_URL: 'javascript:alert(1)',
    });
    expect(html).toBe('<a href="#">go</a>');
  });

  it("leaves values unescaped only when explicitly asked, for plain-text subjects", () => {
    expect(
      renderTemplate("Join {{BUSINESS_NAME}}", { BUSINESS_NAME: "Tom & Jerry" }, { escape: false })
    ).toBe("Join Tom & Jerry");
  });
});

describe("htmlToText", () => {
  it("produces a readable plain-text part", () => {
    const text = htmlToText("<h1>Hello</h1><p>Line one<br>Line two</p>");
    expect(text).toContain("Hello");
    expect(text).toContain("Line one");
    expect(text).toContain("Line two");
    expect(text).not.toContain("<");
  });

  it("decodes the entities escaping introduced", () => {
    expect(htmlToText("<p>Tom &amp; Jerry</p>")).toBe("Tom & Jerry");
  });
});

describe("the template catalogue", () => {
  it.each(EMAIL_TEMPLATE_KEYS)("%s renders with no placeholders left behind", (key) => {
    const definition = EMAIL_TEMPLATES[key];

    const subject = renderTemplate(definition.subject, definition.sample, { escape: false });
    const html = renderTemplate(definition.html, definition.sample);

    expect(subject).not.toMatch(/\{\{/);
    expect(html).not.toMatch(/\{\{/);
    expect(html).toContain("<!doctype html>");
  });

  it.each(EMAIL_TEMPLATE_KEYS)("%s declares every variable it uses", (key) => {
    const definition = EMAIL_TEMPLATES[key];
    const declared = new Set(definition.variables.map((v) => v.name));

    const used = new Set(
      [...definition.html.matchAll(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g)].map((m) => m[1])
    );
    for (const name of [...definition.subject.matchAll(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g)]) {
      used.add(name[1]);
    }

    for (const name of used) {
      expect(declared, `${key} uses {{${name}}} but does not declare it`).toContain(name);
    }
  });

  it.each(EMAIL_TEMPLATE_KEYS)("%s provides a sample for every declared variable", (key) => {
    const definition = EMAIL_TEMPLATES[key];
    for (const variable of definition.variables) {
      expect(definition.sample[variable.name], `${key} has no sample for ${variable.name}`).toBeTruthy();
    }
  });

  it("keeps platform mail out of tenant-editable scope", () => {
    expect(EMAIL_TEMPLATES.EMAIL_VERIFICATION.scope).toBe("PLATFORM");
    expect(EMAIL_TEMPLATES.PASSWORD_RESET.scope).toBe("PLATFORM");
    expect(EMAIL_TEMPLATES.TEAM_INVITATION.scope).toBe("BUSINESS");
  });
});
