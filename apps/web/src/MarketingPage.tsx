import { useEffect, type ReactNode } from "react";

const GITHUB_URL = "https://github.com/shawnbure/elm-chat";
const THREAT_MODEL_URL = `${GITHUB_URL}/blob/main/docs/threat-model.md`;

export type MarketingSlug =
  | "self-destructing-chat"
  | "send-a-password-securely"
  | "one-time-secret-chat"
  | "building-ephemeral-chat-cloudflare";

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
  },
  "one-time-secret-chat": {
    title: "One-time secret or disposable chat? Choose the right handoff",
    description:
      "Compare a one-time secret link with a disposable encrypted chat room for passwords, API keys, files, and sensitive live coordination.",
    eyebrow: "One-time secret alternative",
    intro:
      "A one-time secret link is excellent when one person needs to reveal one value once. Some handoffs become a conversation, and that changes what the tool needs to do.",
    body: (
      <>
        <section>
          <h2>Use a one-time secret for a one-way reveal</h2>
          <p>
            If the entire task is “open this value once,” a purpose-built one-time secret service
            is the simpler choice. It minimizes interaction and gives the recipient one clear
            action.
          </p>
          <p>
            Rotate the credential afterward when practical. A disappearing link cannot undo a
            screenshot, clipboard capture, compromised browser, or malicious recipient.
          </p>
        </section>

        <section>
          <h2>Use a disposable room when the handoff talks back</h2>
          <p>
            A live room fits when the recipient needs to confirm access, request a second value,
            clarify which environment to use, or exchange an encrypted file. The creator can issue
            a single-use invite and destroy the room when the exchange is finished.
          </p>
          <p>
            elm.chat encrypts message and file content in the browser and does not persist a
            server-side transcript. Its relay still observes connection metadata such as timing,
            sizes, IP addresses, and presence.
          </p>
        </section>

        <Limitations />
      </>
    )
  },
  "building-ephemeral-chat-cloudflare": {
    title: "Building ephemeral encrypted chat with Cloudflare Durable Objects",
    description:
      "A technical walkthrough of elm.chat's React, Web Crypto, Cloudflare Worker, Durable Object, WebSocket, encryption, and disposable-room architecture.",
    eyebrow: "Architecture walkthrough",
    intro:
      "elm.chat uses one Cloudflare Worker and one Durable Object per room to coordinate a live encrypted conversation without turning the server into a transcript database.",
    body: (
      <>
        <section>
          <h2>The shape of the system</h2>
          <p>
            The React client creates rooms, derives keys with Web Crypto, encrypts messages and
            files, and maintains the current transcript in memory. A single Cloudflare Worker serves
            that app and routes the room API. One Durable Object per room owns membership, presence,
            one-time invites, expiry, and a live WebSocket relay.
          </p>
          <p>
            The Durable Object persists room metadata and invite state. It relays encrypted message
            envelopes, encrypted file chunks, and peer-supplied transcript sync payloads without
            persisting those payloads as a server-side transcript.
          </p>
        </section>

        <section>
          <h2>From room creation to encrypted relay</h2>
          <ol>
            <li>The browser generates a random 256-bit room secret.</li>
            <li>The Worker creates room metadata and addresses a Durable Object by room ID.</li>
            <li>The secret stays in the URL fragment during normal navigation.</li>
            <li>The browser derives an AES-GCM-256 room key with HKDF-SHA-256.</li>
            <li>Participants join through creator-issued, single-use invite links.</li>
            <li>A single WebSocket carries encrypted chat, file, presence, and sync events.</li>
            <li>The room expires after its policy or is destroyed by the creator.</li>
          </ol>
          <p>
            Newly connected participants request transcript sync from clients that are already in
            the room. If no connected client still has an item, the server cannot reconstruct it.
            That loss is part of the disposable model rather than a durability bug.
          </p>
        </section>

        <section>
          <h2>Why an encrypted relay instead of WebRTC</h2>
          <p>
            Direct WebRTC is attractive, but ICE negotiation can reveal participant IP addresses to
            other room members, and reliable connectivity often requires a TURN relay anyway.
            elm.chat deliberately sends ciphertext through the Durable Object so participants never
            connect directly and the flow works on restrictive networks.
          </p>
          <p>
            This is a tradeoff, not magic. Cloudflare can still observe IP addresses, connection
            timing, payload sizes, and presence. The relay cannot read message or file plaintext,
            but elm.chat does not claim to hide metadata from its infrastructure.
          </p>
        </section>

        <section>
          <h2>What is encrypted—and what is not</h2>
          <ul>
            <li>Messages use AES-GCM with a fresh random nonce per message.</li>
            <li>Files are split into 64 KiB chunks and encrypted chunk by chunk.</li>
            <li>The browser holds the room key and current transcript in memory.</li>
            <li>The server stores room policy, status, creator capability, and invite state.</li>
            <li>Ephemeral identity keys exist, but message authentication is not implemented yet.</li>
          </ul>
          <p>
            The current design does not solve device compromise, screenshots, malicious recipients,
            traffic analysis, denial of service, or strong anonymous routing. It has not had an
            independent security audit.
          </p>
        </section>

        <section>
          <h2>Fork it, inspect it, or run your own</h2>
          <p>
            The complete TypeScript project is AGPL-3.0 licensed. The repository includes the
            architecture, threat model, deployment instructions, contributor guide, and a
            one-click Cloudflare deploy path.
          </p>
          <p>
            <a href={GITHUB_URL} rel="noreferrer" target="_blank">
              Read the source and deployment guide
            </a>
            .
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
        <RelatedGuides current={slug} />

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

function RelatedGuides({ current }: { current: MarketingSlug }) {
  const guides: Array<{ slug: MarketingSlug; label: string }> = [
    { slug: "self-destructing-chat", label: "What self-destructing chat should mean" },
    { slug: "send-a-password-securely", label: "How to send a password securely" },
    { slug: "one-time-secret-chat", label: "One-time secret vs disposable chat" },
    {
      slug: "building-ephemeral-chat-cloudflare",
      label: "How elm.chat works on Cloudflare"
    }
  ];

  return (
    <aside className="marketing-related" aria-label="More guides">
      <p className="eyebrow">More guides</p>
      <ul>
        {guides
          .filter((guide) => guide.slug !== current)
          .map((guide) => (
            <li key={guide.slug}>
              <a href={`/${guide.slug}`}>{guide.label}</a>
            </li>
          ))}
      </ul>
    </aside>
  );
}
