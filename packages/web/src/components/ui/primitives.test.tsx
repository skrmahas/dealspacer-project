import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Button } from "./button";
import { Badge } from "./badge";

describe("shadcn primitives", () => {
  it("renders Card, Button, and Badge primitives", () => {
    render(
      <div>
        <Card>
          <CardHeader>
            <CardTitle>Design System</CardTitle>
          </CardHeader>
          <CardContent>Content</CardContent>
        </Card>
        <Button>Upload</Button>
        <Badge>New</Badge>
      </div>,
    );

    expect(screen.getByText("Design System")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("supports dark mode utility classes without crashing", () => {
    render(
      <div className="dark">
        <Card className="dark:border-white/10">
          <CardContent>Dark card</CardContent>
        </Card>
      </div>,
    );

    expect(screen.getByText("Dark card")).toBeInTheDocument();
  });
});
