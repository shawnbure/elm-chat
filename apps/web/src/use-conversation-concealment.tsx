import { useLayoutEffect, useRef, useState } from "react";
import { t } from "./localization";

/** A local display choice, not authentication or a change to room retention. */
export function useConversationConcealment(onHide: () => void) {
  const [hidden, setHidden] = useState(false);
  const hideButton = useRef<HTMLButtonElement>(null);
  const showButton = useRef<HTMLButtonElement>(null);
  const focusOwner = useRef<Element | null>(null);
  const handoffPending = useRef(false);

  function changeVisibility(next: boolean) {
    focusOwner.current = document.activeElement;
    handoffPending.current = true;
    if (next) onHide();
    setHidden(next);
  }

  useLayoutEffect(() => {
    if (!handoffPending.current) return;
    handoffPending.current = false;
    // Handoff belongs only to this action, never a later arrival or reconnect.
    if (document.activeElement === focusOwner.current || document.activeElement === document.body) {
      (hidden ? showButton : hideButton).current?.focus({ preventScroll: true });
    }
    focusOwner.current = null;
  }, [hidden]);

  function reset() {
    handoffPending.current = false;
    focusOwner.current = null;
    setHidden(false);
  }

  const control = <button className="secondary-button" ref={hideButton} type="button"
    onClick={() => changeVisibility(true)}>{t("hideConversation")}</button>;

  const screen = hidden ? <main className="room-shell room-shell-centered concealed-conversation">
    <section className="access-screen" aria-labelledby="concealed-title">
      <p className="eyebrow">elm chat</p>
      <h1 id="concealed-title" className="access-title">{t("conversationHidden")}</h1>
      <p className="access-copy">{t("concealmentHint")}</p>
      <button className="primary-button" ref={showButton} type="button"
        onClick={() => changeVisibility(false)}>{t("showConversation")}</button>
    </section>
  </main> : null;

  return { hidden, control, screen, reset };
}
