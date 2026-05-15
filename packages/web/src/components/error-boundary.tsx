"use client";

import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 40,
            gap: 16,
            textAlign: "center",
          }}
        >
          <h2 style={{ margin: 0, color: "var(--color-heading)", fontSize: 22 }}>
            Something went wrong
          </h2>
          <p style={{ margin: 0, color: "var(--color-text-muted)", fontSize: 15, maxWidth: 400 }}>
            An unexpected error occurred while rendering this page. Please try again.
          </p>
          <button
            onClick={this.handleReset}
            style={{
              border: "none",
              borderRadius: 10,
              padding: "10px 20px",
              background: "linear-gradient(90deg, var(--color-accent), var(--color-accent-dark))",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
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
