import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

type RootBoundaryState = {
  error: Error | null;
};

class RootBoundary extends React.Component<React.PropsWithChildren, RootBoundaryState> {
  state: RootBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): RootBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error("elm.chat render crash", error);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="room-shell room-shell-centered">
          <section className="access-screen" aria-live="polite">
            <p className="eyebrow">elm chat</p>
            <h1 className="access-title">Could not open this session</h1>
            <p className="access-copy">
              The app hit a browser error while opening this room. Reload once. If it still fails,
              go back home and create a fresh invite.
            </p>
            <p className="error-text access-copy">{this.state.error.message}</p>
            <a className="secondary-button access-home-link" href="/">
              Back to home
            </a>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RootBoundary>
      <App />
    </RootBoundary>
  </React.StrictMode>
);
