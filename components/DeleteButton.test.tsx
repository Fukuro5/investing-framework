import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeleteButton, type DeleteActionState } from "./DeleteButton";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DeleteButton", () => {
  it("does not call the action when the confirm dialog is cancelled", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const action = vi.fn(async (): Promise<DeleteActionState> => ({ status: "idle" }));

    render(
      <DeleteButton action={action} confirmMessage="Are you sure?" label="Delete" hiddenFields={{ id: "1" }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(window.confirm).toHaveBeenCalledWith("Are you sure?");
    expect(action).not.toHaveBeenCalled();
  });

  it("shows the returned error message when the action fails", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const action = vi.fn(async (): Promise<DeleteActionState> => ({ status: "error", errorMessage: "Can't delete this" }));

    render(
      <DeleteButton action={action} confirmMessage="Are you sure?" label="Delete" hiddenFields={{ id: "1" }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Can't delete this")).toBeInTheDocument();
  });
});
