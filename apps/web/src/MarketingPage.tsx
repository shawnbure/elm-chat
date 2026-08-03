import type { MarketingAcquisitionSource } from "@elm-chat/shared";
import { useEffect, type ReactNode } from "react";
import { recordGrowthEvent } from "./growth";

const GITHUB_URL = "https://github.com/shawnbure/elm-chat";
const THREAT_MODEL_URL = `${GITHUB_URL}/blob/main/docs/threat-model.md`;
const DEPLOY_URL = `https://deploy.workers.cloudflare.com/?url=${GITHUB_URL}`;

export type MarketingSlug = MarketingAcquisitionSource;

type MarketingPageContent = {
  byline?: string;
  developerAudience?: boolean;
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

        <section>
          <h2>One-time secret vs. disposable chat</h2>
          <div className="marketing-table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">What the handoff needs</th>
                  <th scope="col">Usually the better fit</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Reveal one value once, without a reply</td>
                  <td>A purpose-built one-time secret</td>
                </tr>
                <tr>
                  <td>Confirm access or answer a follow-up question</td>
                  <td>A disposable chat room</td>
                </tr>
                <tr>
                  <td>Exchange several values or an encrypted file</td>
                  <td>A disposable chat room</td>
                </tr>
                <tr>
                  <td>Leave something for a recipient who is not online</td>
                  <td>A one-time secret with a suitable expiry policy</td>
                </tr>
                <tr>
                  <td>Keep talking over days or weeks</td>
                  <td>A mature encrypted messenger</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            This is a workflow choice, not a universal security ranking. Check how any service
            handles encryption keys, ciphertext retention, expiry, logs, metadata, and independent
            review before trusting it with sensitive material.
          </p>
        </section>

        <section>
          <h2>A practical live handoff</h2>
          <ol>
            <li>Ask the recipient to be ready before creating the room.</li>
            <li>Create a short-lived room and send its single-use invite separately.</li>
            <li>Exchange only the values needed for this task.</li>
            <li>Confirm the recipient can use them, then destroy the room.</li>
            <li>Rotate credentials afterward when the system supports it.</li>
          </ol>
          <p>
            Destroying the room prevents the relay from becoming a durable transcript. It cannot
            erase a participant&apos;s screenshot, clipboard, download, photograph, browser memory,
            or another copy outside elm.chat.
          </p>
        </section>

        <Limitations />
      </>
    )
  },
  "temporary-private-chat": {
    title: "Temporary private chat room without signup",
    description:
      "Create a short-lived private chat room in your browser, share a single-use invite, and end the conversation without an account or server-side transcript.",
    eyebrow: "Temporary private chat",
    intro:
      "Sometimes you already know who you need to talk to—you just do not want to create an account, install an app, or leave the conversation in permanent history.",
    body: (
      <>
        <section>
          <h2>A private link, not a room full of strangers</h2>
          <p>
            Temporary chat can mean two very different things. Random chat services match you with
            unknown people. A private temporary room is created for people who already intend to
            talk and is reached through an invite you share directly.
          </p>
          <p>
            elm.chat uses creator-issued, single-use invites. There is no public room directory,
            contact discovery, phone number, email address, or account profile.
          </p>
        </section>

        <section>
          <h2>What happens to the conversation</h2>
          <ul>
            <li>Message and file content is encrypted in each participant&apos;s browser.</li>
            <li>The relay coordinates the live room without persisting a server-side transcript.</li>
            <li>The creator can set expiry rules, revoke unused invites, or destroy the room.</li>
            <li>Participants can still copy, photograph, or otherwise retain what they receive.</li>
          </ul>
          <p>
            The relay can observe connection metadata such as IP addresses, timing, sizes, and
            presence. Temporary does not mean anonymous, and encryption does not protect a
            compromised device.
          </p>
        </section>

        <section>
          <h2>When a temporary room is the right tool</h2>
          <p>
            Use one for a one-off credential handoff, short client coordination, an event or
            marketplace meetup, or another conversation that needs live back-and-forth but not a
            permanent group.
          </p>
          <p>
            For an ongoing relationship, a mature encrypted messenger is usually the better fit.
            For a single one-way value, a purpose-built one-time secret can be simpler.
          </p>
        </section>

        <Limitations />
      </>
    )
  },
  "journalist-source-communication": {
    title: "How journalists and sources should choose a private communication channel",
    description:
      "A threat-model guide to first contact, encrypted messaging, anonymous document submission, metadata, devices, and short-lived conversations.",
    eyebrow: "Journalist and source safety",
    byline: "By Shawn Bure — founder of Workrr AI and Workrr One",
    intro:
      "There is no single safest channel for every source. The right choice depends on whether the real risk is identity exposure, message content, document metadata, device compromise, or unnecessary retention.",
    body: (
      <>
        <section>
          <h2>Begin with consequences, not an app list</h2>
          <p>
            Before contact, ask what could happen if the source&apos;s identity, the message content,
            or even the fact of communication became known. The Committee to Protect Journalists
            recommends completing a digital risk assessment rather than assuming one tool solves
            every threat. Its current guidance also separates content encryption from metadata and
            device security.
          </p>
          <p>
            Use CPJ&apos;s <a href="https://cpj.org/2023/06/digital-security-risk-assessment-template/" rel="noreferrer" target="_blank">risk-assessment template</a> and <a href="https://cpj.org/2019/07/digital-safety-kit-journalists/" rel="noreferrer" target="_blank">Digital Safety Kit</a> as starting points. A reporter handling a routine confidential clarification and a whistleblower facing state surveillance do not have the same threat model.
          </p>
        </section>

        <section>
          <h2>Three jobs are often confused</h2>
          <ul>
            <li><strong>First contact:</strong> letting a source discover and safely choose an appropriate route before they reveal something sensitive.</li>
            <li><strong>Ongoing conversation:</strong> exchanging messages, calls, or files after both sides understand the risk and have verified whom they are speaking with.</li>
            <li><strong>Anonymous document submission:</strong> protecting a source&apos;s identity while receiving material that may itself contain identifying metadata or malware.</li>
          </ul>
          <p>
            Freedom of the Press Foundation calls out the “first contact problem” because a source
            can compromise confidentiality before a reporter has a chance to move the conversation.
            Its <a href="https://freedom.press/digisec/guides/source-protection/" rel="noreferrer" target="_blank">source-protection collection</a> recommends advertising channels and explaining their different properties in advance.
          </p>
        </section>

        <section>
          <h2>Match the channel to the job</h2>
          <div className="marketing-table-wrap">
            <table>
              <thead><tr><th scope="col">Situation</th><th scope="col">Usually the better starting point</th></tr></thead>
              <tbody>
                <tr><td>Routine, non-sensitive outreach</td><td>A normal published newsroom contact method</td></tr>
                <tr><td>Ongoing encrypted conversation where the parties can verify each other</td><td>An established end-to-end encrypted messenger supported by the newsroom, such as Signal</td></tr>
                <tr><td>High-risk anonymous documents or whistleblower material</td><td>A newsroom&apos;s SecureDrop installation and its published source instructions</td></tr>
                <tr><td>Low-risk, already-known participants who mainly want to avoid another permanent thread</td><td>A short-lived channel, after checking its audit status, metadata, authentication, and deletion scope</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            This is workflow guidance, not a universal security ranking. Freedom of the Press
            Foundation&apos;s guide to <a href="https://freedom.press/digisec/blog/security-confidential-tip-pages/" rel="noreferrer" target="_blank">confidential tip pages</a> explains why newsrooms should present multiple channels honestly. SecureDrop&apos;s <a href="https://docs.securedrop.org/en/stable/" rel="noreferrer" target="_blank">official documentation</a> describes a system built specifically for anonymous source submissions through Tor and hardened newsroom workflows.
          </p>
        </section>

        <section>
          <h2>Encryption does not erase metadata</h2>
          <p>
            End-to-end encryption can protect message content from the service carrying it. It does
            not automatically hide who connected, when they connected, IP addresses, phone numbers,
            account identifiers, message sizes, or other surrounding data. CPJ warns that metadata
            can reveal a communication pattern even when content is encrypted.
          </p>
          <p>
            Anonymity requires a separate design. SecureDrop uses Tor because hiding content alone
            is not enough for a source whose identity must remain unknown. A normal web chat,
            including elm.chat, should not be treated as a substitute for that anonymity model.
          </p>
        </section>

        <section>
          <h2>Documents and devices can reveal more than the conversation</h2>
          <ul>
            <li>Office documents may contain author names, revision history, internal paths, or organizational identifiers.</li>
            <li>Photos can contain location, device, timestamp, or editing metadata.</li>
            <li>Opening an untrusted file can expose a newsroom device to malware.</li>
            <li>Downloads, screenshots, clipboard history, cloud backups, and notification previews can create new copies.</li>
            <li>A seized, unlocked, or compromised endpoint can reveal plaintext regardless of the transport.</li>
          </ul>
          <p>
            Do not improvise document sanitization in a high-risk situation. Follow the newsroom&apos;s
            established process or seek help from a qualified digital-security professional.
          </p>
        </section>

        <section>
          <h2>Where a disposable room fits—and where it does not</h2>
          <p>
            A disposable room can reduce retention for a low-risk conversation between people who
            already know whom they intend to reach: scheduling, a non-critical clarification, or a
            temporary exchange whose main concern is avoiding another permanent inbox thread.
          </p>
          <p>
            elm.chat is an experiment in that narrow category. It requires no account, encrypts
            message and file content in the browser, relays ciphertext without persisting a
            server-side transcript, uses single-use invites, and lets the creator destroy the room.
          </p>
          <p>
            It is not appropriate for anonymous or high-risk sourcing. It has not had an independent
            security audit, message authentication is not implemented yet, and Cloudflare can
            observe ordinary relay metadata including IP addresses, timing, sizes, and presence.
            A participant or compromised device can retain everything received.
          </p>
        </section>

        <section>
          <h2>A safer newsroom sequence</h2>
          <ol>
            <li>Publish several contact options before a source needs them.</li>
            <li>Explain which option provides encryption, anonymity, or only convenience.</li>
            <li>Complete a risk assessment before moving sensitive material.</li>
            <li>Verify identities through a separate known channel when the workflow requires it.</li>
            <li>Minimize identifying details and retain only what reporting, safety, and legal duties require.</li>
            <li>Reassess the channel when a routine conversation becomes sensitive.</li>
          </ol>
          <p>
            The most responsible tool choice may be the one that tells a source not to use it. A
            clear boundary is more useful than a broad “secure” label.
          </p>
        </section>

        <Limitations />
      </>
    )
  },
  "temporary-financial-handoff": {
    title: "Stop putting one-time financial handoffs in permanent inboxes",
    description:
      "A practical framework for separating accountable financial records from temporary credential, document, and exception-handling conversations.",
    eyebrow: "Financial data minimization",
    byline: "By Shawn Bure — founder of Workrr AI and Workrr One",
    intro:
      "A financial transaction may need a durable record. The temporary conversation used to resolve an exception, exchange a credential, or collect one missing document often does not need to become another permanent archive.",
    body: (
      <>
        <section>
          <h2>The record and the conversation are different systems</h2>
          <p>
            Banks, fintechs, accountants, and operations teams need evidence. A payment
            authorization, customer consent, approval, account change, or case outcome may belong
            in a governed system of record with a defined retention policy. That does not mean
            every password, recovery code, screenshot, draft document, and troubleshooting exchange
            should live forever beside it.
          </p>
          <p>
            In practice, one-time handoffs are often pushed into email, SMS, workplace chat,
            support tickets, or shared drives because those tools are already open. A short
            operational moment becomes searchable in several accounts, forwarded into another
            system, included in backups, and accessible to people who were never part of the
            original exchange.
          </p>
        </section>

        <section>
          <h2>Start with four retention questions</h2>
          <ol>
            <li><strong>What fact must remain?</strong> Record the decision, authorization, receipt, or case outcome in the proper system.</li>
            <li><strong>What material is merely in transit?</strong> Treat a temporary credential, draft, or clarification as a handoff rather than a new record category.</li>
            <li><strong>Who can end the exchange?</strong> Define expiry, revocation, and destruction authority before the conversation begins.</li>
            <li><strong>What cannot be erased?</strong> State the metadata, participant copies, screenshots, device artifacts, and regulatory records outside the channel&apos;s control.</li>
          </ol>
          <p>
            This separation is not a way to evade legal retention, supervision, discovery, fraud
            controls, or audit obligations. It is a way to stop creating extra copies that serve no
            continuing operational purpose.
          </p>
        </section>

        <section>
          <h2>Use the narrowest tool that completes the handoff</h2>
          <div className="marketing-table-wrap">
            <table>
              <thead><tr><th scope="col">Need</th><th scope="col">Usually the better fit</th></tr></thead>
              <tbody>
                <tr><td>Preserve an authorization, transaction, or final decision</td><td>The governed financial system of record</td></tr>
                <tr><td>Reveal one value once with no discussion</td><td>A purpose-built one-time secret service</td></tr>
                <tr><td>Clarify, confirm, or exchange several temporary items live</td><td>A short-lived room with an explicit end</td></tr>
                <tr><td>Collaborate over days or maintain a client relationship</td><td>An approved mature messaging or case-management platform</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            The goal is not to make every financial conversation disappear. It is to match each
            exchange to the smallest defensible retention footprint.
          </p>
        </section>

        <section>
          <h2>A disposable room is an experiment, not a compliance shortcut</h2>
          <p>
            I built elm.chat to explore this boundary. It creates a no-account room, encrypts
            message and file content in participants&apos; browsers, uses a single-use invite, and
            relays ciphertext without persisting a server-side transcript. The creator can destroy
            the room when the handoff is complete.
          </p>
          <p>
            That architecture reduces one category of durable copy. It does not decide what a
            financial institution is legally required to retain, integrate with supervision
            systems, prevent a recipient from saving content, hide ordinary relay metadata, or
            protect a compromised endpoint.
          </p>
        </section>

        <section>
          <h2>What a production financial workflow would still need</h2>
          <ul>
            <li>A documented record-classification and retention decision.</li>
            <li>Approved identity, authorization, access, and endpoint controls.</li>
            <li>A clear way to preserve the required outcome without preserving every transient input.</li>
            <li>Independent security review, abuse testing, incident response, and vendor-risk evaluation.</li>
            <li>Plain-language disclosure of deletion scope, metadata, participant copies, and failure states.</li>
          </ul>
          <p>
            elm.chat is early-stage, has not had an independent security audit, and does not yet
            implement message authentication. It should not be presented as production-ready
            financial infrastructure or used for high-risk financial information on the strength
            of this article.
          </p>
        </section>

        <section>
          <h2>The useful design question is smaller</h2>
          <p>
            When a financial workflow creates a new piece of data, ask whether the institution
            needs the fact, the entire conversation, or neither after the task is done. Keep the
            accountable record. Minimize the temporary material around it. Make expiry and
            destruction visible. Then test the technical system against the promise the interface
            makes.
          </p>
          <p>
            That is a more honest goal than calling every channel secure. It gives product,
            operations, security, legal, and compliance teams a concrete boundary they can inspect
            together.
          </p>
        </section>

        <Limitations />
      </>
    )
  },
  press: {
    title: "elm.chat press and media kit",
    description:
      "Verified product facts, founder background, story angles, source material, and downloadable visuals for journalists covering elm.chat.",
    eyebrow: "Press and media",
    intro:
      "Everything an editor or reporter needs to describe elm.chat accurately—including the limits that should remain in any story.",
    body: (
      <>
        <section>
          <h2>One-sentence description</h2>
          <p>
            elm.chat is an open-source, account-free messenger for short-lived encrypted rooms with
            single-use invites and no persisted server-side transcript.
          </p>
        </section>

        <section>
          <h2>The idea behind the project</h2>
          <p>
            Most software is designed to remember everything. elm.chat explores the opposite
            boundary: some accountable records should remain, while a temporary credential,
            clarification, or private conversation should be able to accomplish its purpose and
            end without automatically becoming another permanent archive.
          </p>
          <p>
            The goal is not anonymity, compliance avoidance, or erasing participant copies. It is
            to make retention an explicit product decision and give ordinary people a smaller
            footprint for one-off conversations.
          </p>
        </section>

        <section>
          <h2>Verified product facts</h2>
          <ul>
            <li>No account, phone number, email address, contact list, or public room directory.</li>
            <li>Message and file content is encrypted in participants&apos; browsers.</li>
            <li>A Cloudflare Durable Object relays ciphertext and coordinates one live room.</li>
            <li>The relay does not persist message or file content as a server-side transcript.</li>
            <li>Creators issue single-use invites and can destroy the room.</li>
            <li>The complete project is available under AGPL-3.0 and can be self-hosted.</li>
          </ul>
        </section>

        <section>
          <h2>Limits every story should preserve</h2>
          <ul>
            <li>elm.chat has not had an independent security audit.</li>
            <li>Message authentication is not implemented yet.</li>
            <li>Cloudflare can observe ordinary relay metadata such as IP addresses, timing, sizes, and presence.</li>
            <li>A participant, screenshot, clipboard, download, photograph, or compromised device can retain content.</li>
            <li>The project is not an anonymity network, a compliance product, or production-ready financial infrastructure.</li>
          </ul>
        </section>

        <section>
          <h2>Current story angles</h2>
          <ul>
            <li><strong>Technology that knows when to forget:</strong> retention as a deliberate product boundary.</li>
            <li><strong>A chat server without a transcript database:</strong> browser encryption, WebSockets, and Durable Objects.</li>
            <li><strong>Keep the record, minimize the handoff:</strong> separating governed financial outcomes from temporary operational material.</li>
            <li><strong>Trust through inspectable limits:</strong> publishing the threat model and unfinished work instead of hiding it behind a security slogan.</li>
          </ul>
        </section>

        <section>
          <h2>About the founder</h2>
          <p>
            Shawn Bure is an AI and operations technology professional with decades of experience
            across financial operations, payments, telephony, CRM, integrations, cloud systems,
            automation, and production AI. He leads Workrr AI and Workrr One and built elm.chat as
            an open experiment in data minimization and accountable software design.
          </p>
        </section>

        <section>
          <h2>Primary sources</h2>
          <ul>
            <li><a href="https://github.com/shawnbure/elm-chat" rel="noreferrer" target="_blank">Source repository</a></li>
            <li><a href={THREAT_MODEL_URL} rel="noreferrer" target="_blank">Threat model and current limitations</a></li>
            <li><a href="/why-i-built-elm-chat">Founder&apos;s story</a></li>
            <li><a href="/building-ephemeral-chat-cloudflare">Architecture walkthrough</a></li>
            <li><a href="/journalist-source-communication">Journalist and source channel guide</a></li>
            <li><a href="/temporary-financial-handoff">Financial data-minimization essay</a></li>
            <li><a href="/the-internet-needs-places-that-forget">Public-interest essay on technology that forgets</a></li>
            <li><a href="https://github.com/shawnbure/elm-chat/releases/tag/v0.1.0" rel="noreferrer" target="_blank">Current public release</a></li>
          </ul>
        </section>

        <section>
          <h2>Downloadable visuals</h2>
          <ul>
            <li><a download href="/elm-chat-social.png">General elm.chat social card (1200×630 PNG)</a></li>
            <li><a download href="/elm-chat-architecture-social.png">Architecture social card (1200×630 PNG)</a></li>
            <li><a download href="/elm-chat-finance-social.png">Financial handoff social card (1200×630 PNG)</a></li>
          </ul>
          <p>
            These images may be used in editorial coverage of elm.chat with attribution. Product
            claims should be checked against the source and threat model above.
          </p>
        </section>

        <section>
          <h2>Media inquiries</h2>
          <p>
            Reach Shawn through his <a href="https://github.com/shawnbure" rel="noreferrer" target="_blank">GitHub profile</a> or start a public question in <a href="https://github.com/shawnbure/elm-chat/discussions" rel="noreferrer" target="_blank">elm.chat Discussions</a>.
          </p>
        </section>

        <Limitations />
      </>
    )
  },
  "the-internet-needs-places-that-forget": {
    title: "The internet needs places that are allowed to forget",
    description:
      "Shawn Bure makes the public-interest case for deliberate digital forgetting: preserve accountable records while minimizing temporary human conversations.",
    eyebrow: "Technology and society",
    byline: "By Shawn Bure — founder of Workrr AI and Workrr One",
    intro:
      "The internet learned to remember almost everything. A healthier digital world would also know when a conversation has completed its purpose and should be allowed to end.",
    body: (
      <>
        <section>
          <h2>Permanent memory is not a neutral default</h2>
          <p>
            Digital systems preserve information because storage is inexpensive and history is
            useful. Records can make decisions reviewable, protect customers, expose wrongdoing,
            and help organizations learn. But a useful capability became a nearly universal default:
            every message, draft, clarification, attachment, and moment of uncertainty is invited
            to become permanent.
          </p>
          <p>
            That changes the way people speak. A passing question becomes searchable evidence. A
            private family moment becomes platform inventory. A ten-second credential handoff is
            copied into inboxes, tickets, backups, and devices. The cost is not only a future breach.
            It is the quiet pressure people feel when every imperfect thought may outlive its purpose.
          </p>
        </section>

        <section>
          <h2>Accountability and minimization belong together</h2>
          <p>
            The answer is not to erase every record. Financial transactions, public decisions,
            safety reports, consent, and other accountable acts may need durable evidence. The
            better question is narrower: which fact must remain, and which temporary conversation
            merely helped people reach it?
          </p>
          <p>
            A bank may need to preserve an authorization without keeping every password or draft
            exchanged around it. A company may need the final decision without retaining years of
            exploratory chat. A person may want an enduring photograph without a permanent archive
            of the private coordination that produced it. Responsible retention preserves what has
            continuing value and stops collecting the rest by reflex.
          </p>
        </section>

        <section>
          <h2>Forgetting must be designed, not promised</h2>
          <p>
            A disappearing animation is not deletion. Honest ephemeral software has to define the
            whole lifecycle: whether an identity is required, where encryption keys live, whether
            the service stores a transcript, how invitations expire, who can destroy the room, what
            metadata remains, and which copies exist beyond the service&apos;s control.
          </p>
          <p>
            Those limits matter. A recipient can take a screenshot or photograph. A compromised
            device can expose plaintext. Infrastructure can observe connection metadata even when
            it cannot read encrypted content. Backups and logs may outlive the interface. Technology
            cannot make another person forget; it can only decline to create an unnecessary archive
            of its own.
          </p>
        </section>

        <section>
          <h2>Why I built elm.chat in public</h2>
          <p>
            I am an AI professional and technologist with decades of operating and software
            experience across payments, recovery operations, telephony, CRM, integrations, cloud
            systems, and production AI. I lead Workrr AI and Workrr One. Much of that work depends
            on good records and accountable automation. elm.chat explores the complementary idea:
            sometimes responsible software should create less evidence in the first place.
          </p>
          <p>
            elm.chat creates an account-free room, encrypts messages and files in participants&apos;
            browsers, relays ciphertext without persisting a server-side transcript, uses single-use
            invitations, and lets the creator destroy the room. The project is AGPL-3.0 so people can
            inspect, challenge, fork, and run it themselves.
          </p>
          <p>
            It is also early. It has not completed an independent security audit. Message
            authentication is unfinished. Cloudflare can observe ordinary connection metadata such
            as IP addresses, timing, sizes, and presence. Participant devices can retain everything
            they receive. elm.chat is not an anonymity network or a high-risk source-protection tool.
            Publishing those boundaries is part of the experiment, not an apology hidden after the
            slogan.
          </p>
        </section>

        <section>
          <h2>A healthier internet would offer more than one kind of memory</h2>
          <p>
            We need durable systems that preserve public accountability. We need mature encrypted
            messengers for relationships that continue. We need anonymous submission systems built
            for high-risk sources. We also need small, understandable places for ordinary people who
            already know one another and simply do not need another permanent thread.
          </p>
          <p>
            The larger goal is choice. People should be able to select a channel whose memory matches
            the purpose of the interaction. Designers should justify retention with the same care
            they apply to collection. Product teams should treat destruction as a real state, not a
            cosmetic button. And builders should publish what their systems cannot forget.
          </p>
          <p>
            Software has become extraordinarily good at recording human life. Helping the world now
            means learning when restraint is the more responsible feature.
          </p>
        </section>

        <Limitations />
      </>
    )
  },
  "why-i-built-elm-chat": {
    title: "Why I built a messenger designed to disappear",
    description:
      "Workrr founder Shawn Bure explains why he built elm.chat: an open-source disposable room for conversations that should not become permanent records.",
    eyebrow: "Founder's note",
    byline: "By Shawn Bure — founder of Workrr AI and Workrr One",
    intro:
      "After decades of building operational, financial, communications, and AI systems, I wanted to build one system whose most important feature was knowing when not to remember.",
    body: (
      <>
        <section>
          <h2>Most software is rewarded for remembering everything</h2>
          <p>
            I have spent much of my career turning difficult, fragmented work into systems people
            can actually operate. I built and scaled a national recovery operation, founded and sold
            the collections platform OpenCollect, and shipped software across payments, telephony,
            CRM, integrations, and cloud infrastructure. Today I lead Workrr AI and Workrr One,
            where the work is making production AI useful, governed, and accountable.
          </p>
          <p>
            In all of those systems, memory has value. Records make work measurable. Evidence makes
            decisions reviewable. History helps a process improve. But the same instinct applied to
            every human interaction creates a different problem: a ten-second exchange becomes a
            permanent artifact scattered across inboxes, chat histories, backups, and devices.
          </p>
        </section>

        <section>
          <h2>Some conversations deserve a smaller footprint</h2>
          <p>
            Sometimes two people need to exchange a credential, resolve a sensitive operational
            question, or coordinate something private without adopting another social network.
            They already know whom they need to reach. What they need is a link for one conversation,
            not another identity, contact list, notification stream, or archive.
          </p>
          <p>
            That is the idea behind elm.chat. A person creates a room without an account, sends a
            single-use invite, talks live, and destroys the room when the job is done. The goal is
            not to replace a mature messenger. It is to make a narrow, disposable channel easy
            enough to reach for at the moment it is useful.
          </p>
        </section>

        <section>
          <h2>Privacy should be an architecture, not an adjective</h2>
          <p>
            elm.chat encrypts messages and files in participants&apos; browsers. The room secret stays
            in the URL fragment during normal use, and the Cloudflare relay coordinates the live
            room without persisting a server-side transcript. Room policy and invite state exist;
            the conversation itself is held by connected clients and is intentionally disposable.
          </p>
          <p>
            The project is AGPL-3.0, so anyone can inspect it, challenge its choices, or run a copy.
            I published the architecture and threat model because trust should come from evidence
            and scrutiny—not from a lock icon or a founder saying “secure.”
          </p>
        </section>

        <section>
          <h2>Honesty matters more than a perfect privacy story</h2>
          <p>
            elm.chat has not had an independent security audit. Message authentication is not yet
            complete. Cloudflare can observe ordinary relay metadata such as IP addresses, timing,
            sizes, and presence. A compromised device, screenshot, clipboard manager, photograph,
            or malicious recipient can preserve what the room was designed to forget.
          </p>
          <p>
            Those are not footnotes to hide after adoption. They define where the tool fits. I do
            not want people in high-risk situations to confuse an experimental open-source product
            with an audited anonymity system. I want engineers and privacy practitioners to inspect
            it, improve it, and help make its claims narrower and stronger.
          </p>
        </section>

        <section>
          <h2>The larger idea I want to put into the world</h2>
          <p>
            Workrr One asks how AI systems can remain accountable: explicit permissions, human
            approval, bounded retention, reproducible releases, and evidence of what happened.
            elm.chat asks the complementary question: when does responsible software mean creating
            less evidence in the first place?
          </p>
          <p>
            I want technology to give ordinary people more control over that boundary. Some work
            must be recorded. Some decisions must be auditable. Some conversations should simply
            accomplish their purpose and end. Software should be capable of telling the difference.
          </p>
          <p>
            If that idea resonates, try elm.chat with non-critical information, read the source and
            threat model, open an issue, or deploy your own copy. The most useful contribution is not
            praise. It is evidence that helps make the boundary more honest.
          </p>
        </section>

        <Limitations />
      </>
    )
  },
  "building-ephemeral-chat-cloudflare": {
    developerAudience: true,
    byline: "By Shawn Bure — creator of elm.chat",
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
  },
  "durable-objects-websocket-hibernation": {
    developerAudience: true,
    byline: "By Shawn Bure — creator of elm.chat",
    title: "Durable Objects WebSocket hibernation without a chat database",
    description:
      "How elm.chat uses Cloudflare Durable Objects WebSocket hibernation, serialized socket attachments, client-held encrypted history, and peer sync without storing a server transcript.",
    eyebrow: "Durable Objects deep dive",
    intro:
      "WebSocket hibernation can keep a room reachable while its Durable Object sleeps. It does not preserve ordinary JavaScript memory, so elm.chat separates durable room state, live connection identity, and disposable message history.",
    body: (
      <>
        <section>
          <h2>Three kinds of state, three different homes</h2>
          <ul>
            <li>
              <strong>Durable room state:</strong> expiry policy, creator capability, room status,
              and one-time invite records live in Durable Object storage.
            </li>
            <li>
              <strong>Live connection state:</strong> session ID, creator role, identity key, and
              connection time live in each WebSocket&apos;s serialized attachment.
            </li>
            <li>
              <strong>Conversation history:</strong> encrypted message envelopes remain in connected
              browsers and are not written to Durable Object storage.
            </li>
          </ul>
          <p>
            This split is the core design choice. Hibernation can discard the object&apos;s
            process-local memory, but the object can reload durable metadata and enumerate accepted
            sockets when it wakes.
          </p>
        </section>

        <section>
          <h2>Make socket attachments the membership source of truth</h2>
          <p>
            The room accepts a socket with <code>acceptWebSocket</code>, then writes a small
            attachment with <code>serializeAttachment</code>. After a wake-up, routing code calls{" "}
            <code>getWebSockets</code> and <code>deserializeAttachment</code> instead of trusting an
            in-memory participant map.
          </p>
          <pre>
            <code>{`this.ctx.acceptWebSocket(server);
server.serializeAttachment({
  sessionId: "",
  creator: false,
  identityKey: "",
  connectedAt: 0
});`}</code>
          </pre>
          <p>
            The empty session ID marks an accepted socket that has not completed its authenticated
            join. Once the creator capability or one-time invite is validated, the attachment is
            replaced with the joined session record.
          </p>
        </section>

        <section>
          <h2>Rebuild presence by enumerating live sockets</h2>
          <p>
            Presence, targeted relay, participant removal, and room capacity all derive from the
            current socket set. Duplicate session IDs are collapsed before the room announces its
            membership count.
          </p>
          <p>
            Durable storage still records public room metadata, but it is not treated as the
            authority for who is connected at this instant. That avoids restoring a stale
            participant map after hibernation.
          </p>
        </section>

        <section>
          <h2>Let clients supply encrypted history</h2>
          <p>
            A joining browser sends a <code>sync_request</code> through the relay. Connected peers
            answer with at most the latest 200 encrypted message envelopes. The Durable Object
            routes that payload but never commits it to storage.
          </p>
          <p>
            This deliberately gives up server-backed recovery. If every browser that held an item
            disconnects, a later participant cannot retrieve it. A malicious peer can also omit or
            reorder sync data, and message authentication is not implemented yet.
          </p>
        </section>

        <section>
          <h2>What hibernation does—and does not—buy</h2>
          <ul>
            <li>The object can sleep while accepted WebSockets remain attached to the room.</li>
            <li>Connection identity survives through serialized attachments, not class fields.</li>
            <li>Room policy survives because it is stored and reloaded during initialization.</li>
            <li>Message history stays disposable because connected clients, not storage, hold it.</li>
            <li>Cloudflare still observes normal connection metadata and relayed payload sizes.</li>
          </ul>
          <p>
            This is not a general recipe for durable chat. It is a tradeoff for a room where losing
            history is preferable to turning the relay into an archive.
          </p>
        </section>

        <section>
          <h2>Inspect the implementation</h2>
          <p>
            The complete TypeScript implementation, room protocol, tests, threat model, and
            Cloudflare deployment path are available under AGPL-3.0.
          </p>
          <p>
            <a
              href={`${GITHUB_URL}/blob/main/durable-objects/room/src/room.ts`}
              rel="noreferrer"
              target="_blank"
            >
              Read the Durable Object source
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
  const roomHref = `/?source=${slug}`;

  useEffect(() => {
    const previousTitle = document.title;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = description?.content ?? "";

    recordGrowthEvent("marketing_page_viewed", slug);
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
  }, [page, slug]);

  return (
    <main className="marketing-shell">
      <nav className="marketing-nav" aria-label="elm.chat">
        <a className="marketing-brand" href="/">
          elm.chat
        </a>
        <div>
          <a href="/press">Press kit</a>
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
          {page.byline ? <p className="marketing-byline">{page.byline}</p> : null}
          <p className="marketing-intro">{page.intro}</p>
          <div className="marketing-header-actions">
            <a
              className="primary-button marketing-primary-cta"
              href={roomHref}
              onClick={() => recordGrowthEvent("marketing_cta_clicked", slug)}
            >
              {page.developerAudience ? "Try the live architecture" : "Create a disposable room"}
            </a>
            <a
              className="secondary-button marketing-source-cta"
              href={GITHUB_URL}
              rel="noreferrer"
              target="_blank"
              onClick={() => recordGrowthEvent("marketing_source_clicked", slug)}
            >
              Inspect the source
            </a>
            {page.developerAudience ? (
              <a
                className="secondary-button marketing-deploy-cta"
                href={DEPLOY_URL}
                rel="noreferrer"
                target="_blank"
                onClick={() => recordGrowthEvent("marketing_deploy_clicked", slug)}
              >
                Deploy your own
              </a>
            ) : null}
          </div>
        </header>

        <div className="marketing-body">{page.body}</div>
        <RelatedGuides current={slug} />

        <footer className="marketing-footer-cta">
          {page.developerAudience ? (
            <>
              <p className="eyebrow">Fork it. Deploy it. Inspect every claim.</p>
              <h2>Run elm.chat on your own Cloudflare account</h2>
              <p>
                Deploy the complete AGPL-3.0 app as one Worker with a room-scoped Durable Object,
                then inspect or change the implementation yourself.
              </p>
              <div className="marketing-footer-actions">
                <a
                  className="primary-button marketing-primary-cta"
                  href={DEPLOY_URL}
                  rel="noreferrer"
                  target="_blank"
                  onClick={() => recordGrowthEvent("marketing_deploy_clicked", slug)}
                >
                  Deploy to Cloudflare
                </a>
                <a
                  className="secondary-button marketing-live-cta"
                  href={roomHref}
                  onClick={() => recordGrowthEvent("marketing_cta_clicked", slug)}
                >
                  Open the live app
                </a>
              </div>
            </>
          ) : (
            <>
              <p className="eyebrow">One conversation. Then gone.</p>
              <h2>Create a room without an account</h2>
              <p>
                Set the message and room lifetime, issue a single-use invite, and destroy the room
                when you are finished.
              </p>
              <a
                className="primary-button marketing-primary-cta"
                href={roomHref}
                onClick={() => recordGrowthEvent("marketing_cta_clicked", slug)}
              >
                Open elm.chat
              </a>
            </>
          )}
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
    { slug: "temporary-private-chat", label: "Temporary private chat without signup" },
    { slug: "journalist-source-communication", label: "Choosing a channel for journalists and sources" },
    { slug: "temporary-financial-handoff", label: "Temporary financial handoffs" },
    { slug: "the-internet-needs-places-that-forget", label: "Why the internet needs places that forget" },
    { slug: "why-i-built-elm-chat", label: "Why I built elm.chat" },
    {
      slug: "building-ephemeral-chat-cloudflare",
      label: "How elm.chat works on Cloudflare"
    },
    {
      slug: "durable-objects-websocket-hibernation",
      label: "WebSocket hibernation without a chat database"
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
