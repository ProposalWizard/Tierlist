"use client";

import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export default class ClientErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 40,
            color: "white",
            background: "#111",
            minHeight: "100vh",
            fontFamily: "monospace",
          }}
        >
          <h1 style={{ color: "#f87171", marginBottom: 16, fontWeight: 700 }}>
            Error caught
          </h1>
          <pre
            style={{
              color: "#fbbf24",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: 14,
              marginBottom: 16,
            }}
          >
            {this.state.error.message}
          </pre>
          <pre
            style={{
              color: "#6b7280",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: 11,
              maxHeight: 400,
              overflow: "auto",
            }}
          >
            {this.state.error.stack}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              marginTop: 20,
              padding: "10px 20px",
              background: "#374151",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
