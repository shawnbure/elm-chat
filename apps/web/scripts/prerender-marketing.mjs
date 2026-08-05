import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ORIGIN = process.env.SITE_ORIGIN ?? "https://elm.chat";

const pages = {
  "security-and-limitations": {
    title: "elm.chat security status and limitations",
    description:
      "The public security status of elm.chat: what is encrypted, what metadata remains visible, known protocol gaps, destruction limits, and how to review or report issues.",
    eyebrow: "Public security status",
    schemaType: "WebPage",
    datePublished: "2026-08-03",
    dateModified: "2026-08-03",
    intro:
      "elm.chat is an early-stage encrypted messenger, not an audited high-assurance security product. This page puts its current guarantees, known gaps, and review routes in one place.",
    body: `
      <section>
        <h2>Current status</h2>
        <ul>
          <li><strong>No independent security audit has been completed.</strong></li>
          <li>Message and file content is encrypted and decrypted in participant browsers.</li>
          <li>The room secret is carried in the URL fragment during normal use, so it is not sent to the server in an HTTP request.</li>
          <li>The Cloudflare relay handles ciphertext and does not persist a server-side transcript.</li>
          <li><strong>Message authentication and replay/duplicate protections are not implemented yet.</strong></li>
        </ul>
      </section>
      <section>
        <h2>What the relay and participants can still know</h2>
        <p>The hosted relay can observe ordinary network and room metadata, including IP addresses, connection timing, presence, and encrypted payload sizes. Encryption does not make the service anonymous.</p>
        <p>A participant can save, copy, screenshot, photograph, forward, or back up plaintext and files. Room destruction ends elm.chat's server-side room lifecycle; it cannot erase copies on participant devices or from other software.</p>
      </section>
      <section>
        <h2>Where it does—and does not—fit</h2>
        <p>elm.chat is being built for temporary communication between known participants who want fewer durable server-side copies. It should not currently be treated as an anonymous drop box, an audited high-risk communications system, a compliance product, or a production financial-control system.</p>
        <p>Use a purpose-built, independently reviewed system when anonymity, severe-repression resistance, regulated recordkeeping, or high-assurance identity verification is required.</p>
      </section>
      <section>
        <h2>Inspect and challenge the claims</h2>
        <ul>
          <li><a href="https://github.com/shawnbure/elm-chat/blob/main/docs/threat-model.md">Read the threat model</a></li>
          <li><a href="https://github.com/shawnbure/elm-chat/blob/main/docs/architecture.md">Inspect the architecture</a></li>
          <li><a href="https://github.com/shawnbure/elm-chat">Review the complete AGPL-3.0 source</a></li>
          <li><a href="https://github.com/shawnbure/elm-chat/issues/56">Join the public independent-review request</a> for coordination and non-sensitive design observations</li>
        </ul>
        <p>No independent reviewer is currently committed. The public request is an invitation to scrutiny, not a claim that an audit is underway.</p>
      </section>
      <section>
        <h2>Report a suspected vulnerability privately</h2>
        <p>Do not publish exploitable details in the review issue. Follow the <a href="https://github.com/shawnbure/elm-chat/blob/main/SECURITY.md">security policy</a> and use <a href="https://github.com/shawnbure/elm-chat/security/advisories/new">GitHub private vulnerability reporting</a>.</p>
      </section>`
  },
  "self-destructing-chat": {
    title: "Self-destructing chat: what disappearing should actually mean",
    description:
      "Learn how self-destructing chat differs from ordinary disappearing messages, including encryption, deletion, metadata, and device-level limits.",
    eyebrow: "Self-destructing chat",
    intro:
      "A message disappearing from the screen is not the same thing as a conversation that was never archived. The difference matters when the conversation is the liability.",
    body: `
      <section>
        <h2>Five separate questions hide behind “disappearing”</h2>
        <ul>
          <li><strong>Can the service read the content?</strong> End-to-end encryption should keep plaintext on participant devices.</li>
          <li><strong>Does the server keep a transcript?</strong> Removing a message from the app UI says nothing about server-side retention.</li>
          <li><strong>Does the room itself expire?</strong> Message timers and room destruction solve different problems.</li>
          <li><strong>Is an identity required?</strong> Accounts and phone numbers can make a temporary conversation permanently attributable.</li>
          <li><strong>What metadata remains?</strong> Encryption does not hide every connection time, message size, IP address, or presence signal from infrastructure.</li>
        </ul>
      </section>
      <section>
        <h2>Where a disposable room fits</h2>
        <p>elm.chat is for one conversation, not a permanent contact network. A creator opens a room, issues a single-use invite, exchanges encrypted messages or files, and destroys the room when the job is done.</p>
        <p>Message and file content is encrypted in the browser. A Cloudflare Durable Object relays ciphertext and coordinates the live room without persisting its transcript. The relay can still observe connection metadata such as timing, sizes, IP addresses, and presence.</p>
      </section>`
  },
  "send-a-password-securely": {
    title: "How to send a password securely without leaving it in chat history",
    description:
      "A practical guide to handing off a password or API key using a short-lived encrypted room instead of email or a permanent chat log.",
    eyebrow: "Credential handoff",
    intro:
      "Email, SMS, and workplace chat turn a ten-second credential handoff into a searchable record stored in multiple accounts and backups.",
    body: `
      <section>
        <h2>Use a short-lived channel</h2>
        <ol>
          <li>Create a room only when the recipient is ready.</li>
          <li>Share a single-use invite through a separate channel.</li>
          <li>Send the credential and confirm it works.</li>
          <li>Destroy the room, then rotate the credential when practical.</li>
        </ol>
        <p>A one-time paste works for a one-way drop. A disposable chat room is useful when the handoff needs live clarification, a second value, or an encrypted file.</p>
      </section>
      <section>
        <h2>What elm.chat changes</h2>
        <p>There is no account or contact list. The room secret stays in the URL fragment during normal use, message and file content is encrypted in the browser, and the relay does not persist a server-side transcript. Invites are single-use and revocable.</p>
        <p>This reduces durable copies; it cannot protect a credential from a compromised device, clipboard manager, screenshot, malicious recipient, or failure to rotate it afterward.</p>
      </section>`
  },
  "send-a-file-securely": {
    title: "How to send a file securely without creating another attachment archive",
    description:
      "A practical guide to transferring a file through a short-lived encrypted room, including live delivery, file-size limits, metadata, and endpoint copies.",
    eyebrow: "Temporary encrypted file transfer",
    datePublished: "2026-08-03",
    dateModified: "2026-08-03",
    keywords: [
      "send a file securely",
      "temporary encrypted file transfer",
      "secure file transfer without signup",
      "send file without email attachment",
      "live encrypted file sharing"
    ],
    intro:
      "A file needed for one live handoff does not always belong in an inbox, ticket, or shared folder that will outlive the task.",
    body: `
      <section>
        <h2>Choose the channel by what must happen afterward</h2>
        <p>Use durable cloud storage or an approved document portal when the recipient needs reliable later access, version history, an audit trail, or an organizational record. Use a purpose-built, independently reviewed system when regulation or a high-risk threat model requires it.</p>
        <p>A disposable room fits a narrower job: two known participants are online, one needs to transfer a file now, and neither wants the relay to become a permanent file archive.</p>
      </section>
      <section>
        <h2>How elm.chat transfers a file</h2>
        <ol>
          <li>Create a room and share its single-use invite with the intended recipient.</li>
          <li>Keep both browsers connected, then attach a file up to 25 MiB.</li>
          <li>The recipient explicitly requests the offered file.</li>
          <li>The sender splits it into 64 KiB chunks and encrypts each chunk in the browser before sending it through the relay.</li>
          <li>The recipient decrypts and reassembles the chunks locally, then chooses whether to save the file.</li>
          <li>Destroy the room when the handoff and any clarification are complete.</li>
        </ol>
        <p>The Cloudflare relay handles ciphertext and does not persist the file as a server-side attachment. The sender must remain connected because elm.chat is a live transfer, not an asynchronous file locker.</p>
      </section>
      <section>
        <h2>What room destruction does—and does not—remove</h2>
        <p>Destroying the room ends its server-side lifecycle and prevents elm.chat from becoming a durable transcript or file repository. It does not erase a file the recipient saved, copied, photographed, backed up, or forwarded, and it cannot clean clipboard history, browser downloads, notification previews, or a compromised endpoint.</p>
        <p>The relay can still observe ordinary metadata such as IP addresses, connection timing, presence, and encrypted payload sizes. Message authentication is not implemented yet, and elm.chat has not completed an independent security audit. Do not treat it as an anonymous drop box, a compliance product, or a high-risk document-submission system.</p>
      </section>
      <section>
        <h2>A safer one-time handoff checklist</h2>
        <ul>
          <li>Verify the recipient through a separate known channel when identity matters.</li>
          <li>Share only the minimum file needed for the task.</li>
          <li>Remove unnecessary document metadata before sending when appropriate.</li>
          <li>Keep your own required record in the system designed to hold it.</li>
          <li>Destroy the room after delivery, and assume the recipient can retain what they receive.</li>
        </ul>
      </section>`
  },
  "one-time-secret-chat": {
    title: "One-time secret or disposable chat? Choose the right handoff",
    description:
      "Compare a one-time secret link with a disposable encrypted chat room for passwords, API keys, files, and sensitive live coordination.",
    eyebrow: "One-time secret alternative",
    intro:
      "A one-time secret link is excellent when one person needs to reveal one value once. Some handoffs become a conversation, and that changes what the tool needs to do.",
    dateModified: "2026-08-03",
    body: `
      <section>
        <h2>Use a one-time secret for a one-way reveal</h2>
        <p>If the entire task is “open this value once,” a purpose-built one-time secret service is the simpler choice. It minimizes interaction and gives the recipient one clear action.</p>
        <p>Rotate the credential afterward when practical. A disappearing link cannot undo a screenshot, clipboard capture, compromised browser, or malicious recipient.</p>
      </section>
      <section>
        <h2>Use a disposable room when the handoff talks back</h2>
        <p>A live room fits when the recipient needs to confirm access, request a second value, clarify which environment to use, or exchange an encrypted file. The creator can issue a single-use invite and destroy the room when the exchange is finished.</p>
        <p>elm.chat encrypts message and file content in the browser and does not persist a server-side transcript. Its relay still observes connection metadata such as timing, sizes, IP addresses, and presence.</p>
      </section>
      <section>
        <h2>One-time secret vs. disposable chat</h2>
        <div class="marketing-table-wrap">
          <table>
            <thead><tr><th scope="col">What the handoff needs</th><th scope="col">Usually the better fit</th></tr></thead>
            <tbody>
              <tr><td>Reveal one value once, without a reply</td><td>A purpose-built one-time secret</td></tr>
              <tr><td>Confirm access or answer a follow-up question</td><td>A disposable chat room</td></tr>
              <tr><td>Exchange several values or an encrypted file</td><td>A disposable chat room</td></tr>
              <tr><td>Leave something for a recipient who is not online</td><td>A one-time secret with a suitable expiry policy</td></tr>
              <tr><td>Keep talking over days or weeks</td><td>A mature encrypted messenger</td></tr>
            </tbody>
          </table>
        </div>
        <p>This is a workflow choice, not a universal security ranking. Check how any service handles encryption keys, ciphertext retention, expiry, logs, metadata, and independent review before trusting it with sensitive material.</p>
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
        <p>Destroying the room prevents the relay from becoming a durable transcript. It cannot erase a participant's screenshot, clipboard, download, photograph, browser memory, or another copy outside elm.chat.</p>
      </section>`
  },
  "temporary-private-chat": {
    title: "Temporary private chat room without signup",
    description:
      "Create a short-lived private chat room in your browser, share a single-use invite, and end the conversation without an account or server-side transcript.",
    eyebrow: "Temporary private chat",
    intro:
      "Sometimes you already know who you need to talk to—you just do not want to create an account, install an app, or leave the conversation in permanent history.",
    body: `
      <section>
        <h2>A private link, not a room full of strangers</h2>
        <p>Temporary chat can mean two very different things. Random chat services match you with unknown people. A private temporary room is created for people who already intend to talk and is reached through an invite you share directly.</p>
        <p>elm.chat uses creator-issued, single-use invites. There is no public room directory, contact discovery, phone number, email address, or account profile.</p>
      </section>
      <section>
        <h2>What happens to the conversation</h2>
        <ul>
          <li>Message and file content is encrypted in each participant's browser.</li>
          <li>The relay coordinates the live room without persisting a server-side transcript.</li>
          <li>The creator can set expiry rules, revoke unused invites, or destroy the room.</li>
          <li>Participants can still copy, photograph, or otherwise retain what they receive.</li>
        </ul>
        <p>The relay can observe connection metadata such as IP addresses, timing, sizes, and presence. Temporary does not mean anonymous, and encryption does not protect a compromised device.</p>
      </section>
      <section>
        <h2>When a temporary room is the right tool</h2>
        <p>Use one for a one-off credential handoff, short client coordination, an event or marketplace meetup, or another conversation that needs live back-and-forth but not a permanent group.</p>
        <p>For an ongoing relationship, a mature encrypted messenger is usually the better fit. For a single one-way value, a purpose-built one-time secret can be simpler.</p>
      </section>`
  },
  "journalist-source-communication": {
    title: "How journalists and sources should choose a private communication channel",
    description:
      "A threat-model guide to first contact, encrypted messaging, anonymous document submission, metadata, devices, and short-lived conversations.",
    eyebrow: "Journalist and source safety",
    byline: "By Shawn Bure — founder of Workrr AI and Workrr One",
    authorName: "Shawn Bure",
    authorUrl: "https://shawnbure.com/",
    datePublished: "2026-08-03",
    dateModified: "2026-08-03",
    keywords: [
      "journalist source communication",
      "protect journalist sources",
      "secure newsroom tip channel",
      "SecureDrop Signal comparison",
      "source protection threat model"
    ],
    intro:
      "There is no single safest channel for every source. The right choice depends on whether the real risk is identity exposure, message content, document metadata, device compromise, or unnecessary retention.",
    body: `
      <section>
        <h2>Begin with consequences, not an app list</h2>
        <p>Before contact, ask what could happen if the source's identity, the message content, or even the fact of communication became known. The Committee to Protect Journalists recommends completing a digital risk assessment rather than assuming one tool solves every threat. Its current guidance also separates content encryption from metadata and device security.</p>
        <p>Use CPJ's <a href="https://cpj.org/2023/06/digital-security-risk-assessment-template/">risk-assessment template</a> and <a href="https://cpj.org/2019/07/digital-safety-kit-journalists/">Digital Safety Kit</a> as starting points. A reporter handling a routine confidential clarification and a whistleblower facing state surveillance do not have the same threat model.</p>
      </section>
      <section>
        <h2>Three jobs are often confused</h2>
        <ul>
          <li><strong>First contact:</strong> letting a source discover and safely choose an appropriate route before they reveal something sensitive.</li>
          <li><strong>Ongoing conversation:</strong> exchanging messages, calls, or files after both sides understand the risk and have verified whom they are speaking with.</li>
          <li><strong>Anonymous document submission:</strong> protecting a source's identity while receiving material that may itself contain identifying metadata or malware.</li>
        </ul>
        <p>Freedom of the Press Foundation calls out the “first contact problem” because a source can compromise confidentiality before a reporter has a chance to move the conversation. Its <a href="https://freedom.press/digisec/guides/source-protection/">source-protection collection</a> recommends advertising channels and explaining their different properties in advance.</p>
      </section>
      <section>
        <h2>Match the channel to the job</h2>
        <div class="marketing-table-wrap">
          <table>
            <thead><tr><th scope="col">Situation</th><th scope="col">Usually the better starting point</th></tr></thead>
            <tbody>
              <tr><td>Routine, non-sensitive outreach</td><td>A normal published newsroom contact method</td></tr>
              <tr><td>Ongoing encrypted conversation where the parties can verify each other</td><td>An established end-to-end encrypted messenger supported by the newsroom, such as Signal</td></tr>
              <tr><td>High-risk anonymous documents or whistleblower material</td><td>A newsroom's SecureDrop installation and its published source instructions</td></tr>
              <tr><td>Low-risk, already-known participants who mainly want to avoid another permanent thread</td><td>A short-lived channel, after checking its audit status, metadata, authentication, and deletion scope</td></tr>
            </tbody>
          </table>
        </div>
        <p>This is workflow guidance, not a universal security ranking. Freedom of the Press Foundation's guide to <a href="https://freedom.press/digisec/blog/security-confidential-tip-pages/">confidential tip pages</a> explains why newsrooms should present multiple channels honestly. SecureDrop's <a href="https://docs.securedrop.org/en/stable/">official documentation</a> describes a system built specifically for anonymous source submissions through Tor and hardened newsroom workflows.</p>
      </section>
      <section>
        <h2>Encryption does not erase metadata</h2>
        <p>End-to-end encryption can protect message content from the service carrying it. It does not automatically hide who connected, when they connected, IP addresses, phone numbers, account identifiers, message sizes, or other surrounding data. CPJ warns that metadata can reveal a communication pattern even when content is encrypted.</p>
        <p>Anonymity requires a separate design. SecureDrop uses Tor because hiding content alone is not enough for a source whose identity must remain unknown. A normal web chat, including elm.chat, should not be treated as a substitute for that anonymity model.</p>
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
        <p>Do not improvise document sanitization in a high-risk situation. Follow the newsroom's established process or seek help from a qualified digital-security professional.</p>
      </section>
      <section>
        <h2>Where a disposable room fits—and where it does not</h2>
        <p>A disposable room can reduce retention for a low-risk conversation between people who already know whom they intend to reach: scheduling, a non-critical clarification, or a temporary exchange whose main concern is avoiding another permanent inbox thread.</p>
        <p>elm.chat is an experiment in that narrow category. It requires no account, encrypts message and file content in the browser, relays ciphertext without persisting a server-side transcript, uses single-use invites, and lets the creator destroy the room.</p>
        <p>It is not appropriate for anonymous or high-risk sourcing. It has not had an independent security audit, message authentication is not implemented yet, and Cloudflare can observe ordinary relay metadata including IP addresses, timing, sizes, and presence. A participant or compromised device can retain everything received.</p>
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
        <p>The most responsible tool choice may be the one that tells a source not to use it. A clear boundary is more useful than a broad “secure” label.</p>
      </section>`
  },
  "temporary-financial-handoff": {
    title: "Stop putting one-time financial handoffs in permanent inboxes",
    description:
      "A practical framework for separating accountable financial records from temporary credential, document, and exception-handling conversations.",
    eyebrow: "Financial data minimization",
    byline: "By Shawn Bure — founder of Workrr AI and Workrr One",
    authorName: "Shawn Bure",
    authorUrl: "https://shawnbure.com/",
    datePublished: "2026-08-03",
    dateModified: "2026-08-03",
    socialImage: "elm-chat-finance-social.png",
    socialImageAlt:
      "elm.chat — Keep the record. Minimize the handoff. A governed ledger remains while temporary messages disappear.",
    keywords: [
      "financial data minimization",
      "temporary financial handoff",
      "banking customer experience",
      "sensitive document exchange",
      "disposable chat"
    ],
    intro:
      "A financial transaction may need a durable record. The temporary conversation used to resolve an exception, exchange a credential, or collect one missing document often does not need to become another permanent archive.",
    body: `
      <section>
        <h2>The record and the conversation are different systems</h2>
        <p>Banks, fintechs, accountants, and operations teams need evidence. A payment authorization, customer consent, approval, account change, or case outcome may belong in a governed system of record with a defined retention policy. That does not mean every password, recovery code, screenshot, draft document, and troubleshooting exchange should live forever beside it.</p>
        <p>In practice, one-time handoffs are often pushed into email, SMS, workplace chat, support tickets, or shared drives because those tools are already open. A short operational moment becomes searchable in several accounts, forwarded into another system, included in backups, and accessible to people who were never part of the original exchange.</p>
      </section>
      <section>
        <h2>Start with four retention questions</h2>
        <ol>
          <li><strong>What fact must remain?</strong> Record the decision, authorization, receipt, or case outcome in the proper system.</li>
          <li><strong>What material is merely in transit?</strong> Treat a temporary credential, draft, or clarification as a handoff rather than a new record category.</li>
          <li><strong>Who can end the exchange?</strong> Define expiry, revocation, and destruction authority before the conversation begins.</li>
          <li><strong>What cannot be erased?</strong> State the metadata, participant copies, screenshots, device artifacts, and regulatory records that remain outside the channel's control.</li>
        </ol>
        <p>This separation is not a way to evade legal retention, supervision, discovery, fraud controls, or audit obligations. It is a way to stop creating extra copies that serve no continuing operational purpose.</p>
      </section>
      <section>
        <h2>Use the narrowest tool that completes the handoff</h2>
        <div class="marketing-table-wrap">
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
        <p>The goal is not to make every financial conversation disappear. It is to match each exchange to the smallest defensible retention footprint.</p>
      </section>
      <section>
        <h2>A disposable room is an experiment, not a compliance shortcut</h2>
        <p>I built elm.chat to explore this boundary. It creates a no-account room, encrypts message and file content in participants' browsers, uses a single-use invite, and relays ciphertext without persisting a server-side transcript. The creator can destroy the room when the handoff is complete.</p>
        <p>That architecture reduces one category of durable copy. It does not decide what a financial institution is legally required to retain, integrate with supervision systems, prevent a recipient from saving content, hide ordinary relay metadata, or protect a compromised endpoint.</p>
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
        <p>elm.chat is early-stage, has not had an independent security audit, and does not yet implement message authentication. It should not be presented as production-ready financial infrastructure or used for high-risk financial information on the strength of this article.</p>
      </section>
      <section>
        <h2>The useful design question is smaller</h2>
        <p>When a financial workflow creates a new piece of data, ask whether the institution needs the fact, the entire conversation, or neither after the task is done. Keep the accountable record. Minimize the temporary material around it. Make expiry and destruction visible. Then test the technical system against the promise the interface makes.</p>
        <p>That is a more honest goal than calling every channel secure. It gives product, operations, security, legal, and compliance teams a concrete boundary they can inspect together.</p>
      </section>`
  },
  press: {
    schemaType: "WebPage",
    title: "elm.chat press and media kit",
    description:
      "Verified product facts, founder background, story angles, source material, and downloadable visuals for journalists covering elm.chat.",
    eyebrow: "Press and media",
    datePublished: "2026-08-03",
    dateModified: "2026-08-03",
    intro:
      "Everything an editor or reporter needs to describe elm.chat accurately—including the limits that should remain in any story.",
    body: `
      <section>
        <h2>One-sentence description</h2>
        <p>elm.chat is an open-source, account-free messenger for short-lived encrypted rooms with single-use invites and no persisted server-side transcript.</p>
      </section>
      <section>
        <h2>The idea behind the project</h2>
        <p>Most software is designed to remember everything. elm.chat explores the opposite boundary: some accountable records should remain, while a temporary credential, clarification, or private conversation should be able to accomplish its purpose and end without automatically becoming another permanent archive.</p>
        <p>The goal is not anonymity, compliance avoidance, or erasing participant copies. It is to make retention an explicit product decision and give ordinary people a smaller footprint for one-off conversations.</p>
      </section>
      <section>
        <h2>Verified product facts</h2>
        <ul>
          <li>No account, phone number, email address, contact list, or public room directory.</li>
          <li>Message and file content is encrypted in participants' browsers.</li>
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
        <p>Shawn Bure is an AI and operations technology professional with decades of experience across financial operations, payments, telephony, CRM, integrations, cloud systems, automation, and production AI. He leads Workrr AI and Workrr One and built elm.chat as an open experiment in data minimization and accountable software design.</p>
      </section>
      <section>
        <h2>Primary sources</h2>
        <ul>
          <li><a href="https://github.com/shawnbure/elm-chat">Source repository</a></li>
          <li><a href="https://github.com/shawnbure/elm-chat/blob/main/docs/threat-model.md">Threat model and current limitations</a></li>
          <li><a href="/why-i-built-elm-chat">Founder's story</a></li>
          <li><a href="/the-internet-needs-places-that-forget">Public-interest essay on technology that forgets</a></li>
          <li><a href="/building-ephemeral-chat-cloudflare">Architecture walkthrough</a></li>
          <li><a href="/journalist-source-communication">Journalist and source channel guide</a></li>
          <li><a href="/temporary-financial-handoff">Financial data-minimization essay</a></li>
          <li><a href="/feed.xml">RSS feed for articles and technical notes</a></li>
          <li><a href="https://github.com/shawnbure/elm-chat/releases/tag/v0.1.0">Current public release</a></li>
        </ul>
      </section>
      <section>
        <h2>Downloadable visuals</h2>
        <ul>
          <li><a download href="/elm-chat-social.png">General elm.chat social card (1200×630 PNG)</a></li>
          <li><a download href="/elm-chat-architecture-social.png">Architecture social card (1200×630 PNG)</a></li>
          <li><a download href="/elm-chat-finance-social.png">Financial handoff social card (1200×630 PNG)</a></li>
        </ul>
        <p>These images may be used in editorial coverage of elm.chat with attribution. Product claims should be checked against the source and threat model above.</p>
      </section>
      <section>
        <h2>Media inquiries</h2>
        <p>Reach Shawn through his <a href="https://github.com/shawnbure">GitHub profile</a> or start a public question in <a href="https://github.com/shawnbure/elm-chat/discussions">elm.chat Discussions</a>.</p>
      </section>`
  },
  "the-internet-needs-places-that-forget": {
    title: "The internet needs places that are allowed to forget",
    description:
      "Shawn Bure makes the public-interest case for deliberate digital forgetting: preserve accountable records while minimizing temporary human conversations.",
    eyebrow: "Technology and society",
    byline: "By Shawn Bure — founder of Workrr AI and Workrr One",
    authorName: "Shawn Bure",
    authorUrl: "https://shawnbure.com/",
    datePublished: "2026-08-03",
    dateModified: "2026-08-03",
    keywords: [
      "digital forgetting",
      "data minimization",
      "technology and society",
      "ephemeral communication",
      "responsible data retention"
    ],
    intro:
      "The internet learned to remember almost everything. A healthier digital world would also know when a conversation has completed its purpose and should be allowed to end.",
    body: `
      <section>
        <h2>Permanent memory is not a neutral default</h2>
        <p>Digital systems preserve information because storage is inexpensive and history is useful. Records can make decisions reviewable, protect customers, expose wrongdoing, and help organizations learn. But a useful capability became a nearly universal default: every message, draft, clarification, attachment, and moment of uncertainty is invited to become permanent.</p>
        <p>That changes the way people speak. A passing question becomes searchable evidence. A private family moment becomes platform inventory. A ten-second credential handoff is copied into inboxes, tickets, backups, and devices. The cost is not only a future breach. It is the quiet pressure people feel when every imperfect thought may outlive its purpose.</p>
      </section>
      <section>
        <h2>Accountability and minimization belong together</h2>
        <p>The answer is not to erase every record. Financial transactions, public decisions, safety reports, consent, and other accountable acts may need durable evidence. The better question is narrower: which fact must remain, and which temporary conversation merely helped people reach it?</p>
        <p>A bank may need to preserve an authorization without keeping every password or draft exchanged around it. A company may need the final decision without retaining years of exploratory chat. A person may want an enduring photograph without a permanent archive of the private coordination that produced it. Responsible retention preserves what has continuing value and stops collecting the rest by reflex.</p>
      </section>
      <section>
        <h2>Forgetting must be designed, not promised</h2>
        <p>A disappearing animation is not deletion. Honest ephemeral software has to define the whole lifecycle: whether an identity is required, where encryption keys live, whether the service stores a transcript, how invitations expire, who can destroy the room, what metadata remains, and which copies exist beyond the service's control.</p>
        <p>Those limits matter. A recipient can take a screenshot or photograph. A compromised device can expose plaintext. Infrastructure can observe connection metadata even when it cannot read encrypted content. Backups and logs may outlive the interface. Technology cannot make another person forget; it can only decline to create an unnecessary archive of its own.</p>
      </section>
      <section>
        <h2>Why I built elm.chat in public</h2>
        <p>I am an AI professional and technologist with decades of operating and software experience across payments, recovery operations, telephony, CRM, integrations, cloud systems, and production AI. I lead Workrr AI and Workrr One. Much of that work depends on good records and accountable automation. elm.chat explores the complementary idea: sometimes responsible software should create less evidence in the first place.</p>
        <p>elm.chat creates an account-free room, encrypts messages and files in participants' browsers, relays ciphertext without persisting a server-side transcript, uses single-use invitations, and lets the creator destroy the room. The project is AGPL-3.0 so people can inspect, challenge, fork, and run it themselves.</p>
        <p>It is also early. It has not completed an independent security audit. Message authentication is unfinished. Cloudflare can observe ordinary connection metadata such as IP addresses, timing, sizes, and presence. Participant devices can retain everything they receive. elm.chat is not an anonymity network or a high-risk source-protection tool. Publishing those boundaries is part of the experiment, not an apology hidden after the slogan.</p>
      </section>
      <section>
        <h2>A healthier internet would offer more than one kind of memory</h2>
        <p>We need durable systems that preserve public accountability. We need mature encrypted messengers for relationships that continue. We need anonymous submission systems built for high-risk sources. We also need small, understandable places for ordinary people who already know one another and simply do not need another permanent thread.</p>
        <p>The larger goal is choice. People should be able to select a channel whose memory matches the purpose of the interaction. Designers should justify retention with the same care they apply to collection. Product teams should treat destruction as a real state, not a cosmetic button. And builders should publish what their systems cannot forget.</p>
        <p>Software has become extraordinarily good at recording human life. Helping the world now means learning when restraint is the more responsible feature.</p>
      </section>`
  },
  "why-i-built-elm-chat": {
    title: "Why I built a messenger designed to disappear",
    description:
      "Workrr founder Shawn Bure explains why he built elm.chat: an open-source disposable room for conversations that should not become permanent records.",
    eyebrow: "Founder's note",
    byline: "By Shawn Bure — founder of Workrr AI and Workrr One",
    authorName: "Shawn Bure",
    authorUrl: "https://shawnbure.com/",
    datePublished: "2026-08-03",
    dateModified: "2026-08-03",
    intro:
      "After decades of building operational, financial, communications, and AI systems, I wanted to build one system whose most important feature was knowing when not to remember.",
    body: `
      <section>
        <h2>Most software is rewarded for remembering everything</h2>
        <p>I have spent much of my career turning difficult, fragmented work into systems people can actually operate. I built and scaled a national recovery operation, founded and sold the collections platform OpenCollect, and shipped software across payments, telephony, CRM, integrations, and cloud infrastructure. Today I lead Workrr AI and Workrr One, where the work is making production AI useful, governed, and accountable.</p>
        <p>In all of those systems, memory has value. Records make work measurable. Evidence makes decisions reviewable. History helps a process improve. But the same instinct applied to every human interaction creates a different problem: a ten-second exchange becomes a permanent artifact scattered across inboxes, chat histories, backups, and devices.</p>
      </section>
      <section>
        <h2>Some conversations deserve a smaller footprint</h2>
        <p>Sometimes two people need to exchange a credential, resolve a sensitive operational question, or coordinate something private without adopting another social network. They already know whom they need to reach. What they need is a link for one conversation, not another identity, contact list, notification stream, or archive.</p>
        <p>That is the idea behind elm.chat. A person creates a room without an account, sends a single-use invite, talks live, and destroys the room when the job is done. The goal is not to replace a mature messenger. It is to make a narrow, disposable channel easy enough to reach for at the moment it is useful.</p>
      </section>
      <section>
        <h2>Privacy should be an architecture, not an adjective</h2>
        <p>elm.chat encrypts messages and files in participants' browsers. The room secret stays in the URL fragment during normal use, and the Cloudflare relay coordinates the live room without persisting a server-side transcript. Room policy and invite state exist; the conversation itself is held by connected clients and is intentionally disposable.</p>
        <p>The project is AGPL-3.0, so anyone can inspect it, challenge its choices, or run a copy. I published the architecture and threat model because trust should come from evidence and scrutiny—not from a lock icon or a founder saying “secure.”</p>
      </section>
      <section>
        <h2>Honesty matters more than a perfect privacy story</h2>
        <p>elm.chat has not had an independent security audit. Message authentication is not yet complete. Cloudflare can observe ordinary relay metadata such as IP addresses, timing, sizes, and presence. A compromised device, screenshot, clipboard manager, photograph, or malicious recipient can preserve what the room was designed to forget.</p>
        <p>Those are not footnotes to hide after adoption. They define where the tool fits. I do not want people in high-risk situations to confuse an experimental open-source product with an audited anonymity system. I want engineers and privacy practitioners to inspect it, improve it, and help make its claims narrower and stronger.</p>
      </section>
      <section>
        <h2>The larger idea I want to put into the world</h2>
        <p>Workrr One asks how AI systems can remain accountable: explicit permissions, human approval, bounded retention, reproducible releases, and evidence of what happened. elm.chat asks the complementary question: when does responsible software mean creating less evidence in the first place?</p>
        <p>I want technology to give ordinary people more control over that boundary. Some work must be recorded. Some decisions must be auditable. Some conversations should simply accomplish their purpose and end. Software should be capable of telling the difference.</p>
        <p>If that idea resonates, try elm.chat with non-critical information, read the source and threat model, open an issue, or deploy your own copy. The most useful contribution is not praise. It is evidence that helps make the boundary more honest.</p>
      </section>`
  },
  "deletion-distributed-systems-contract": {
    title: "Deletion is a distributed-systems contract, not a UI animation",
    description:
      "A provider-neutral engineering guide to deletion semantics: state inventories, control and data planes, expiry authority, failure modes, verification, and honest user promises.",
    eyebrow: "Distributed systems and data deletion",
    byline: "By Shawn Bure — creator of elm.chat",
    authorName: "Shawn Bure",
    authorUrl: "https://shawnbure.com/",
    datePublished: "2026-08-04",
    dateModified: "2026-08-04",
    schemaType: "TechArticle",
    keywords: [
      "distributed systems",
      "data deletion",
      "data retention",
      "ephemeral systems",
      "privacy engineering",
      "tombstones",
      "backup recovery"
    ],
    developerAudience: true,
    intro:
      "A disappearing row proves only that one interface stopped rendering it. Engineers who promise deletion have to define what happens across clients, relays, databases, caches, logs, queues, replicas, backups, and recovery paths.",
    body: `
      <section>
        <h2>Deletion is an end-to-end property</h2>
        <p>In a distributed system, data rarely has one address. A user action can produce an application record, search index entry, cache value, analytics event, retry payload, queue message, log line, database replica, backup block, notification preview, and one or more client-side copies. Hiding the application record does not resolve the rest.</p>
        <p>A credible deletion promise therefore needs a scope, an authority, a deadline, and a failure model. Scope identifies the copies the service controls. Authority identifies who may trigger destruction. The deadline says when controlled copies become inaccessible and when they are physically reclaimed. The failure model explains what happens when a component is offline, a retry arrives late, or recovery restores older state.</p>
      </section>
      <section>
        <h2>Start with a state inventory, not a delete endpoint</h2>
        <p>Before designing an API, list every place the data can exist and why it exists there. Classify each location as authoritative storage, derived storage, transit, operational telemetry, backup, or participant-controlled state. Give every class an owner and a retention rule. If a team cannot enumerate a copy, it cannot make a defensible claim about deleting that copy.</p>
        <div class="marketing-table-wrap">
          <table>
            <thead><tr><th>State class</th><th>Typical examples</th><th>Deletion question</th></tr></thead>
            <tbody>
              <tr><td>Authoritative</td><td>Primary database, object storage</td><td>What event makes the record unreachable?</td></tr>
              <tr><td>Derived</td><td>Indexes, caches, thumbnails</td><td>How are stale derivatives invalidated?</td></tr>
              <tr><td>Transit</td><td>Queues, retries, relay buffers</td><td>Can an old payload recreate deleted state?</td></tr>
              <tr><td>Operational</td><td>Logs, traces, analytics</td><td>Was sensitive content excluded before collection?</td></tr>
              <tr><td>Recovery</td><td>Replicas, snapshots, backups</td><td>How is destruction preserved after restore?</td></tr>
              <tr><td>Participant</td><td>Downloads, screenshots, exports</td><td>Which copies are outside service control?</td></tr>
            </tbody>
          </table>
        </div>
        <figure>
          <img src="/deletion-state-inventory.svg" alt="Six distributed data state classes: authoritative, derived, transit, operational, recovery, and participant-controlled copies" width="1200" height="675" loading="lazy">
          <figcaption>Inventory every controlled copy before defining a deletion promise.</figcaption>
        </figure>
      </section>
      <section>
        <h2>Model destruction as an irreversible state transition</h2>
        <p>A boolean such as <code>deleted=true</code> is usually too weak. Systems often need a lifecycle that distinguishes an active object from one that is closed to new writes, destroyed for normal access, and eventually reclaimed from recovery media. The transition into the destroyed state should be monotonic: delayed requests, retries, and replayed events must not reopen it.</p>
        <pre><code>ACTIVE -&gt; SEALED -&gt; DESTROYED -&gt; RECLAIMED
          |          |
          +--expire--+

Invariant: no transition leaves DESTROYED or RECLAIMED.</code></pre>
        <p>Store the destruction marker wherever the system stores the object's identity, and make every write path check it. If a backup restore can resurrect an older active record, the recovery procedure must replay later destruction markers before the object becomes reachable.</p>
        <figure>
          <img src="/deletion-state-lifecycle.svg" alt="Irreversible lifecycle from Active to Sealed, Destroyed, and Reclaimed, with expiry leading to destruction" width="1200" height="675" loading="lazy">
          <figcaption>Retries and restores may move forward, never out of destruction.</figcaption>
        </figure>
      </section>
      <section>
        <h2>Separate the control plane from the data plane</h2>
        <p>The control plane answers whether an object exists, who may use it, when it expires, and whether destruction has occurred. The data plane carries the content. Keeping these responsibilities separate makes it possible to retain the minimum state needed to enforce an irreversible tombstone without retaining the content that the tombstone is meant to retire.</p>
        <p>This separation also sharpens review. A reviewer can ask whether the control plane authorizes destruction correctly, whether the data plane writes content anywhere durable, and whether either plane leaks content into logs or metrics. Encryption helps with content confidentiality, but it does not answer lifecycle, metadata, or endpoint questions by itself.</p>
      </section>
      <section>
        <h2>Design for the failures that make data return</h2>
        <p>Most deletion bugs are resurrection bugs. A mobile client reconnects with an old offline mutation. A queue retries a create event after a tombstone. A cache repopulates from a lagging replica. A restore process brings back a record but not the later delete. A search index remains queryable after the primary row is gone. These are ordinary distributed-systems behaviors, so deletion tests must exercise them deliberately.</p>
        <ul>
          <li>Make write operations conditional on the current lifecycle state.</li>
          <li>Give destructive transitions stable, idempotent identifiers.</li>
          <li>Expire queued and offline mutations before they can outlive their purpose.</li>
          <li>Propagate invalidation to indexes and caches through observable workflows.</li>
          <li>Keep content out of logs, traces, error reports, and analytics by construction.</li>
          <li>Document backup retention separately from interactive deletion latency.</li>
        </ul>
      </section>
      <section>
        <h2>Verification needs negative evidence</h2>
        <p>A successful API response proves that one component accepted a request. It does not prove that the system can no longer serve, search, replay, restore, or infer the data. Verification should test absence across every controlled state class and should repeat those checks after component restarts, delayed delivery, cache refresh, replica catchup, and recovery exercises.</p>
        <ol>
          <li>Create uniquely identifiable test content without using real sensitive data.</li>
          <li>Confirm each intended state class receives—or deliberately never receives—it.</li>
          <li>Trigger expiry and explicit destruction through every authorized path.</li>
          <li>Attempt reads, writes, searches, reconnects, retries, exports, and sync operations.</li>
          <li>Restart components and replay delayed messages that predate destruction.</li>
          <li>Restore a pre-destruction snapshot, then apply the documented recovery procedure.</li>
          <li>Check logs, traces, metrics, crash reports, indexes, and caches for the marker.</li>
          <li>Record which participant-controlled copies remain outside the service boundary.</li>
        </ol>
        <figure>
          <img src="/deletion-verification-loop.svg" alt="Deletion verification loop: create a harmless marker, destroy it, attack recovery paths, search controlled state, and record the remaining boundary" width="1200" height="675" loading="lazy">
          <figcaption>Verification seeks negative evidence across restart and recovery paths.</figcaption>
        </figure>
      </section>
      <section>
        <h2>User language should match the system boundary</h2>
        <p>“Gone forever” is almost never an engineering statement. A service can promise that it no longer serves content, that controlled content stores were purged, or that backups age out within a documented window. It cannot promise that a recipient forgot, that a screenshot vanished, that a compromised endpoint was cleaned, or that network metadata was never observed unless the architecture actually provides those properties.</p>
        <p>Product copy should name the actor and the scope: “the relay no longer retains the room” is testable; “this conversation leaves no trace” is not. Honest language is not a conversion penalty. It is part of the interface contract, especially when users are choosing a tool because they want less durable data.</p>
      </section>
      <section>
        <h2>elm.chat as an inspectable, imperfect case study</h2>
        <p>elm.chat applies a narrow version of this model. A Durable Object stores room policy, status, creator capability, and invite state. Connected browsers hold the current conversation history. The relay forwards encrypted messages and file chunks without persisting a server-side transcript. Destroying the room changes its control-plane state so later joins and writes are rejected.</p>
        <p>The tradeoffs are explicit. Cloudflare can observe IP addresses, connection timing, sizes, and presence. Participants can retain plaintext. Peer-supplied history is not a trustworthy archive, and message authentication plus replay and duplicate protection remain unfinished. The project has not had an independent security audit and is not an anonymity, compliance, whistleblowing, or high-risk communications system.</p>
      </section>
      <section>
        <h2>The design review question</h2>
        <p>Do not ask only, “Where is the delete button?” Ask, “Which controlled copies can still influence behavior after destruction, and what evidence proves they cannot bring the object back?” That question turns deletion from a user-interface gesture into a system property engineers can model, test, monitor, and explain.</p>
        <p>The complete elm.chat source, architecture, threat model, and deployment path are public under AGPL-3.0 for anyone who wants to challenge the example or adapt the design to a different infrastructure.</p>
      </section>`
  },
  "building-ephemeral-chat-cloudflare": {
    title: "Building ephemeral encrypted chat with Cloudflare Durable Objects",
    description:
      "A technical walkthrough of elm.chat's React, Web Crypto, Cloudflare Worker, Durable Object, WebSocket, encryption, disposable-room, and one-click deployment architecture.",
    eyebrow: "Architecture walkthrough",
    byline: "By Shawn Bure — creator of elm.chat",
    authorName: "Shawn Bure",
    authorUrl: "https://shawnbure.com/",
    datePublished: "2026-07-28",
    dateModified: "2026-08-05",
    schemaType: "TechArticle",
    socialImage: "elm-chat-architecture-social.png",
    socialImageAlt:
      "elm.chat architecture walkthrough — WebSockets, Durable Objects, and browser encryption",
    keywords: [
      "Cloudflare Workers",
      "Cloudflare Durable Objects",
      "Deploy to Cloudflare",
      "Wrangler monorepo",
      "Web Crypto",
      "WebSockets",
      "end-to-end encryption",
      "ephemeral messaging"
    ],
    developerAudience: true,
    intro:
      "elm.chat uses one Cloudflare Worker and one Durable Object per room to coordinate a live encrypted conversation without turning the server into a transcript database.",
    body: `
      <section>
        <h2>The shape of the system</h2>
        <p>The React client creates rooms, derives keys with Web Crypto, encrypts messages and files, and maintains the current transcript in memory. A single Cloudflare Worker serves that app and routes the room API. One Durable Object per room owns membership, presence, one-time invites, expiry, and a live WebSocket relay.</p>
        <p>The Durable Object persists room metadata and invite state. It relays encrypted message envelopes, encrypted file chunks, and peer-supplied transcript sync payloads without persisting those payloads as a server-side transcript.</p>
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
        <p>Newly connected participants request transcript sync from clients that are already in the room. If no connected client still has an item, the server cannot reconstruct it. That loss is part of the disposable model rather than a durability bug.</p>
      </section>
      <section>
        <h2>Why an encrypted relay instead of WebRTC</h2>
        <p>Direct WebRTC is attractive, but ICE negotiation can reveal participant IP addresses to other room members, and reliable connectivity often requires a TURN relay anyway. elm.chat deliberately sends ciphertext through the Durable Object so participants never connect directly and the flow works on restrictive networks.</p>
        <p>This is a tradeoff, not magic. Cloudflare can still observe IP addresses, connection timing, payload sizes, and presence. The relay cannot read message or file plaintext, but elm.chat does not claim to hide metadata from its infrastructure.</p>
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
        <p>The current design does not solve device compromise, screenshots, malicious recipients, traffic analysis, denial of service, or strong anonymous routing. It has not had an independent security audit.</p>
      </section>
      <section>
        <h2>A deploy button needs a root contract</h2>
        <p>elm.chat is an npm-workspaces repository. Its original Wrangler configuration lived under <code>workers/api</code>, which worked for local and production commands but was invisible to the Deploy to Cloudflare setup flow. The button existed, yet a fresh visitor reached <strong>No Wrangler configuration detected</strong> and Cloudflare fell back to automatic project configuration.</p>
        <p>The repository now has a root <code>wrangler.jsonc</code>, root build and deploy scripts, and a check that fails when the root and workspace runtime resources drift. The public template deliberately omits elm.chat's optional Analytics Engine dataset because Cloudflare does not list Analytics Engine among the resources its deploy button automatically provisions. Independent instances work without that measurement binding.</p>
        <p>The useful test is the public journey, not the presence of a badge: open the repository as a visitor, follow the button, select an account, and confirm that Cloudflare detects <code>npm run build</code>, <code>npm run deploy</code>, and the repository root. Stop if the fallback warning appears. Cloudflare's current resource rules are documented in its <a href="https://developers.cloudflare.com/workers/platform/deploy-buttons/">Deploy to Cloudflare guide</a>, and the elm.chat fix is public in <a href="https://github.com/shawnbure/elm-chat/pull/89">pull request 89</a>.</p>
      </section>
      <section>
        <h2>Fork it, inspect it, or run your own</h2>
        <p>The complete TypeScript project is AGPL-3.0 licensed. The repository includes the architecture, threat model, deployment instructions, contributor guide, and a one-click Cloudflare deploy path.</p>
        <p><a href="https://github.com/shawnbure/elm-chat">Read the source and deployment guide</a>.</p>
      </section>`
  },
  "durable-objects-websocket-hibernation": {
    title: "Durable Objects WebSocket hibernation without a chat database",
    description:
      "How elm.chat uses Cloudflare Durable Objects WebSocket hibernation, serialized socket attachments, client-held encrypted history, and peer sync without storing a server transcript.",
    eyebrow: "Durable Objects deep dive",
    byline: "By Shawn Bure — creator of elm.chat",
    authorName: "Shawn Bure",
    authorUrl: "https://shawnbure.com/",
    datePublished: "2026-07-28",
    dateModified: "2026-08-03",
    schemaType: "TechArticle",
    socialImage: "elm-chat-architecture-social.png",
    socialImageAlt:
      "elm.chat architecture walkthrough — WebSockets, Durable Objects, and browser encryption",
    keywords: [
      "Cloudflare Durable Objects",
      "WebSocket hibernation",
      "TypeScript",
      "ephemeral messaging",
      "client-held history"
    ],
    developerAudience: true,
    intro:
      "WebSocket hibernation can keep a room reachable while its Durable Object sleeps. It does not preserve ordinary JavaScript memory, so elm.chat separates durable room state, live connection identity, and disposable message history.",
    body: `
      <section>
        <h2>Three kinds of state, three different homes</h2>
        <ul>
          <li><strong>Durable room state:</strong> expiry policy, creator capability, room status, and one-time invite records live in Durable Object storage.</li>
          <li><strong>Live connection state:</strong> session ID, creator role, identity key, and connection time live in each WebSocket's serialized attachment.</li>
          <li><strong>Conversation history:</strong> encrypted message envelopes remain in connected browsers and are not written to Durable Object storage.</li>
        </ul>
        <p>This split is the core design choice. Hibernation can discard the object's process-local memory, but the object can reload durable metadata and enumerate accepted sockets when it wakes.</p>
      </section>
      <section>
        <h2>Make socket attachments the membership source of truth</h2>
        <p>The room accepts a socket with <code>acceptWebSocket</code>, then writes a small attachment with <code>serializeAttachment</code>. After a wake-up, routing code calls <code>getWebSockets</code> and <code>deserializeAttachment</code> instead of trusting an in-memory participant map.</p>
        <pre><code>this.ctx.acceptWebSocket(server);
server.serializeAttachment({
  sessionId: "",
  creator: false,
  identityKey: "",
  connectedAt: 0
});</code></pre>
        <p>The empty session ID marks an accepted socket that has not completed its authenticated join. Once the creator capability or one-time invite is validated, the attachment is replaced with the joined session record.</p>
      </section>
      <section>
        <h2>Rebuild presence by enumerating live sockets</h2>
        <p>Presence, targeted relay, participant removal, and room capacity all derive from the current socket set. Duplicate session IDs are collapsed before the room announces its membership count.</p>
        <p>Durable storage still records public room metadata, but it is not treated as the authority for who is connected at this instant. That avoids restoring a stale participant map after hibernation.</p>
      </section>
      <section>
        <h2>Let clients supply encrypted history</h2>
        <p>A joining browser sends a <code>sync_request</code> through the relay. Connected peers answer with at most the latest 200 encrypted message envelopes. The Durable Object routes that payload but never commits it to storage.</p>
        <p>This deliberately gives up server-backed recovery. If every browser that held an item disconnects, a later participant cannot retrieve it. A malicious peer can also omit or reorder sync data, and message authentication is not implemented yet.</p>
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
        <p>This is not a general recipe for durable chat. It is a tradeoff for a room where losing history is preferable to turning the relay into an archive.</p>
      </section>
      <section>
        <h2>Inspect the implementation</h2>
        <p>The complete TypeScript implementation, room protocol, tests, threat model, and Cloudflare deployment path are available under AGPL-3.0.</p>
        <p><a href="https://github.com/shawnbure/elm-chat/blob/main/durable-objects/room/src/room.ts">Read the Durable Object source</a>.</p>
      </section>`
  }
};

const shell = readFileSync("dist/index.html", "utf8");
const guideLabels = {
  "self-destructing-chat": "What self-destructing chat should mean",
  "send-a-password-securely": "How to send a password securely",
  "send-a-file-securely": "How to send a file securely",
  "one-time-secret-chat": "One-time secret vs disposable chat",
  "temporary-private-chat": "Temporary private chat without signup",
  "journalist-source-communication": "Choosing a channel for journalists and sources",
  "temporary-financial-handoff": "Temporary financial handoffs",
  "security-and-limitations": "Security status and limitations",
  "the-internet-needs-places-that-forget": "Why the internet needs places that forget",
  "why-i-built-elm-chat": "Why I built elm.chat",
  "deletion-distributed-systems-contract": "Deletion as a distributed-systems contract",
  "building-ephemeral-chat-cloudflare": "How elm.chat works on Cloudflare",
  "durable-objects-websocket-hibernation": "WebSocket hibernation without a chat database"
};

for (const [slug, page] of Object.entries(pages)) {
  const canonical = `${ORIGIN}/${slug}`;
  const isArticle = (page.schemaType ?? "Article") !== "WebPage";
  const socialImage = page.socialImage ?? "elm-chat-social.png";
  const socialImageAlt =
    page.socialImageAlt ?? "elm.chat — One conversation. Then gone.";
  const structuredData = {
    "@context": "https://schema.org",
    "@type": page.schemaType ?? "Article",
    ...(isArticle ? { headline: page.title } : { name: page.title }),
    description: page.description,
    image: [`${ORIGIN}/${socialImage}`],
    datePublished: page.datePublished ?? "2026-07-28",
    dateModified: page.dateModified ?? "2026-07-28",
    ...(page.keywords ? { keywords: page.keywords } : {}),
    author: page.authorName
      ? {
          "@type": "Person",
          name: page.authorName,
          url: page.authorUrl
        }
      : {
          "@type": "Organization",
          name: "elm.chat",
          url: `${ORIGIN}/`
        },
    publisher: {
      "@type": "Organization",
      name: "elm.chat",
      url: `${ORIGIN}/`
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonical
    },
    isPartOf: {
      "@type": "WebSite",
      "@id": `${ORIGIN}/#website`,
      name: "elm.chat",
      url: `${ORIGIN}/`
    }
  };
  const structuredDataScript = `<script id="structured-data" type="application/ld+json">${JSON.stringify(structuredData).replace(/</g, "\\u003c")}</script>`;
  const content = `
    <main class="marketing-shell">
      <nav class="marketing-nav" aria-label="elm.chat">
        <a class="marketing-brand" href="/">elm.chat</a>
        <div>
          <a href="/press">Press kit</a>
          <a href="/feed.xml">RSS</a>
          <a href="/security-and-limitations">Security</a>
          <a href="https://github.com/shawnbure/elm-chat">Source</a>
          <a href="https://github.com/shawnbure/elm-chat/blob/main/docs/threat-model.md">Threat model</a>
        </div>
      </nav>
      <article class="marketing-article">
        <header>
          <p class="eyebrow">${page.eyebrow}</p>
          <h1>${page.title}</h1>
          ${page.byline ? `<p class="marketing-byline">${page.byline}</p>` : ""}
          <p class="marketing-intro">${page.intro}</p>
          <div class="marketing-header-actions">
            <a class="primary-button marketing-primary-cta" href="/?source=${slug}">${page.developerAudience ? "Try the live architecture" : "Create a disposable room"}</a>
            <a class="secondary-button marketing-source-cta" href="https://github.com/shawnbure/elm-chat">Inspect the source</a>
            ${page.developerAudience ? '<a class="secondary-button marketing-deploy-cta" href="https://deploy.workers.cloudflare.com/?url=https://github.com/shawnbure/elm-chat">Deploy your own</a>' : ""}
          </div>
        </header>
        <div class="marketing-body">
          ${page.body}
          <aside class="marketing-caveat">
            <strong>Security status</strong>
            <p>elm.chat has not had an independent security audit. Review the <a href="/security-and-limitations">public security status</a> before using it for a sensitive situation.</p>
          </aside>
        </div>
        <aside class="marketing-related" aria-label="More guides">
          <p class="eyebrow">More guides</p>
          <ul>
            ${Object.entries(guideLabels)
              .filter(([guideSlug]) => guideSlug !== slug)
              .map(([guideSlug, label]) => `<li><a href="/${guideSlug}">${label}</a></li>`)
              .join("")}
          </ul>
        </aside>
        <footer class="marketing-footer-cta">
          ${
            page.developerAudience
              ? `<p class="eyebrow">Fork it. Deploy it. Inspect every claim.</p>
          <h2>Run elm.chat on your own Cloudflare account</h2>
          <p>Deploy the complete AGPL-3.0 app as one Worker with a room-scoped Durable Object, then inspect or change the implementation yourself.</p>
          <div class="marketing-footer-actions">
            <a class="primary-button marketing-primary-cta" href="https://deploy.workers.cloudflare.com/?url=https://github.com/shawnbure/elm-chat">Deploy to Cloudflare</a>
            <a class="secondary-button marketing-live-cta" href="/?source=${slug}">Open the live app</a>
          </div>`
              : `<p class="eyebrow">One conversation. Then gone.</p>
          <h2>Create a room without an account</h2>
          <p>Set the message and room lifetime, issue a single-use invite, and destroy the room when you are finished.</p>
          <a class="primary-button marketing-primary-cta" href="/?source=${slug}">Open elm.chat</a>`
          }
        </footer>
      </article>
    </main>`;

  const html = shell
    .replace(/<title>.*?<\/title>/, `<title>${page.title} | elm.chat</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/>/,
      `<meta name="description" content="${page.description}" />`
    )
    .replace(
      /<link rel="canonical" href="[^"]*" \/>/,
      `<link rel="canonical" href="${canonical}" />`
    )
    .replace(
      '<meta property="og:type" content="website" />',
      isArticle
        ? `<meta property="og:type" content="article" />
    <meta property="article:published_time" content="${page.datePublished ?? "2026-07-28"}" />
    <meta property="article:modified_time" content="${page.dateModified ?? "2026-07-28"}" />`
        : '<meta property="og:type" content="website" />'
    )
    .replace(
      /<meta property="og:title" content="[^"]*" \/>/,
      `<meta property="og:title" content="${page.title}" />`
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/,
      `<meta property="og:description" content="${page.description}" />`
    )
    .replace(
      /<meta property="og:url" content="[^"]*" \/>/,
      `<meta property="og:url" content="${canonical}" />`
    )
    .replace(
      /<meta property="og:image" content="[^"]*" \/>/,
      `<meta property="og:image" content="${ORIGIN}/${socialImage}" />`
    )
    .replace(
      /<meta property="og:image:alt" content="[^"]*" \/>/,
      `<meta property="og:image:alt" content="${socialImageAlt}" />`
    )
    .replace(
      /<script id="structured-data" type="application\/ld\+json">[\s\S]*?<\/script>/,
      structuredDataScript
    )
    .replace('<div id="root"></div>', `<div id="root">${content}</div>`);

  const outputDir = join("dist", slug);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, "index.html"), html);
}

console.log(`prerendered ${Object.keys(pages).length} marketing pages`);
