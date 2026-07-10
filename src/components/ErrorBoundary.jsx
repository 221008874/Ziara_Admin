import { Component } from "react";
import { Alert, Box, Button, Typography } from "@mui/material";
import { normalizeError } from "../lib/errorHandler";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error("[ErrorBoundary]", error, info);
  }

  handleReset = () => {
    this.setState({ error: null, info: null });
  };

  render() {
    if (this.state.error) {
      const normalized = normalizeError(this.state.error);
      return (
        <Box
          sx={{
            minHeight: "100vh",
            bgcolor: "#04091a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 4,
          }}
        >
          <Box sx={{ maxWidth: 480, width: "100%" }}>
            <Typography variant="h5" sx={{ color: "#f87171", mb: 2, fontWeight: 700 }}>
              Something went wrong
            </Typography>
            <Alert severity="error" sx={{ mb: 3 }}>
              {normalized.message}
            </Alert>
            <Box sx={{ display: "flex", gap: 2 }}>
              <Button variant="outlined" onClick={this.handleReset} sx={{ color: "#0fb8a6", borderColor: "#0fb8a6" }}>
                Try Again
              </Button>
              <Button
                variant="outlined"
                onClick={() => window.location.replace("/")}
                sx={{ color: "#eaf2ff", borderColor: "#6a8aaa" }}
              >
                Go Home
              </Button>
            </Box>
            {this.props.showDetails && normalized.details && (
              <Box
                component="pre"
                sx={{
                  mt: 3,
                  p: 2,
                  bgcolor: "#0b1628",
                  borderRadius: 1,
                  color: "#6a8aaa",
                  fontSize: 12,
                  overflow: "auto",
                  maxHeight: 200,
                }}
              >
                {normalized.details instanceof Error
                  ? normalized.details.stack
                  : JSON.stringify(normalized.details, null, 2)}
              </Box>
            )}
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}
