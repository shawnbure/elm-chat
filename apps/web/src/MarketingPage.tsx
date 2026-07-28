import { useEffect, type ReactNode } from "react";

const GITHUB_URL = "https://github.com/shawnbure/elm-chat";
const THREAT_MODEL_URL = `${GITHUB_URL}/blob/main/docs/threat-model.md`;

export type MarketingSlug = "self-destructing-chat" | "send-a-password-securely";

type MarketingPageContent = {
  description: string;
  eyebrow: string;
  title: string;
  intro: string;
  body: ReactNode;
};

const pages: Record<MarketingSlug, MarketingPageContent> = {
  "self-destructing-chat": {
    title: "Self-destructing chat: what disappearing should actually mean",
    description:
      "Learn how self-destructing chat differs from ordinary disappearing messages, including encryption, deletion, metadata, and device-level limits.",
    eyebrow: "Self-destructing chat",
    intro:
      "A message disappearing from the screen is not the same thing as a conversation that was never archived. The difference matters when the conversation is the liability.",
    body: (
      <>
        <section>
          <h2>Five separate questions hide behind “disappearing”</h2>
          <ul>
            <li>
              <strong>Can the service read the content?</strong> End-to-end encryption should keep
              plaintext on participant devices.
            </li>
            <li>
              <strong>Does the server keep a transcript?</strong> Removing a message from the app UI
              says nothing about server-side retention.
            </li>
            <li>
              <strong>Does the room itself expire?</strong> Message timers and room destruction solve
              different problems.
            </li>
            <li>
              <strong>Is an identity required?</strong> Accounts and phone numbers can make a
              temporary conversation permanently attributable.
            </li>
            <li>
              <strong>What metadata remains?</strong> Encryption does not hide every connection time,
              message size, IP address, or presence signal from infrastructure.
            </li>
          </ul>
        </section>

        <section>
          <h2>Where a disposable room fits</h2>
          <p>
            elm.chat is for one conversation, not a permanent contact network. A creator opens a
            room, issues a single-use invite, exchanges encrypted messages or files, and destroys
            the room when the job is done.
          </p>
          <p>
            Message and file content is encrypted in the browser. A Cloudflare Durable Object relays
            ciphertext and coordinates the live room without persisting its transcript. The relay
            can still observe connection metadata such as timing, sizes, IP addresses, and presence.
          </p>
        </section>

        <Limitations />
      </>
    )
  },
  "send-a-password-securely": {
    title: "How to send a password securely without leaving it in chat history",
    description:
      "A practical guide to handing off a password or API key using a short-lived encrypted room instead of email or a permanent chat log.",
    eyebrow: "Credential handoff",
    intro:
      "Email, SMS, and workplace chat turn a ten-second credential handoff into a searchable record stored in multiple accounts and backups.",
    body: (
      <>
        <section>
          <h2>Use a short-lived channel</h2>
          <ol>
            <li>Create a room only when the recipient is ready.</li>
            <li>Share a single-use invite through a separate channel.</li>
            <li>Send the credential and confirm it works.</li>
            <li>Destroy the room, then rotate the credential when practical.</li>
          </ol>
          <p>
            A one-time paste works for a one-way drop. A disposable chat room is useful when the
            handoff needs live clarification, a second value, or an encrypted file.
          </p>
        </section>

        <section>
          <h2>What elm.chat changes</h2>
          <p>
            There is no account or contact list. The room secret stays in the URL fragment during
            normal use, message and file content is encrypted in the browser, and the relay does not
            persist a server-side transcript. Invites are single-use and revocable.
          </p>
          <p>
            This reduces durable copies; it cannot protect a credential from a compromised device,
            clipboard manager, screenshot, malicious recipient, or failure to rotate it afterward.
          </p>
        </section>

        <Limitations />
      </>
    )
  }
};

function Limitations() {
  return (
    <aside className="marketing-caveat">
      <strong>Security status</strong>
      <p>
        elm.chat has not had an independent security audit. Review the{" "}
        <a href={THREAT_MODEL_URL} rel="noreferrer" target="_blank">
          public threat model
        </a>{" "}
        before using it for a sensitive situation.
      </p>
    </aside>
  );
}

export function MarketingPage({ slug }: { slug: MarketingSlug }) {
  const page = pages[slug];

  useEffect(() => {
    const previousTitle = document.title;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = description?.content ?? "";

    document.title = `${page.title} | elm.chat`;
    if (description) {
      description.content = page.description;
    }

    return () => {
      document.title = previousTitle;
      if (description) {
        description.content = previousDescription;
      }
    };
  }, [page]);

  return (
    <main className="marketing-shell">
      <nav className="marketing-nav" aria-label="elm.chat">
        <a className="marketing-brand" href="/">
          elm.chat
        </a>
        <div>
          <a href={GITHUB_URL} rel="noreferrer" target="_blank">
            Source
          </a>
          <a href={THREAT_MODEL_URL} rel="noreferrer" target="_blank">
            Threat model
          </a>
        </div>
      </nav>

      <article className="marketing-article">
        <header>
          <p className="eyebrow">{page.eyebrow}</p>
          <h1>{page.title}</h1>
          <p className="marketing-intro">{page.intro}</p>
          <a className="primary-button marketing-primary-cta" href="/">
            Create a disposable room
          </a>
        </header>

        <div className="marketing-body">{page.body}</div>

        <footer className="marketing-footer-cta">
          <p className="eyebrow">One conversation. Then gone.</p>
          <h2>Create a room without an account</h2>
          <p>
            Set the message and room lifetime, issue a single-use invite, and destroy the room when
            you are finished.
          </p>
          <a className="primary-button marketing-primary-cta" href="/">
            Open elm.chat
          </a>
        </footer>
      </article>
    </main>
  );
}
