import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WizardShell, WizardStepConfig } from "../WizardShell";

const mockSteps: WizardStepConfig[] = [
  {
    step: "intro",
    title: "Introduction",
    description: "Welcome to the wizard",
    content: <div>Intro content</div>,
  },
  {
    step: "credentials",
    title: "Enter Credentials",
    description: "Provide your credentials",
    content: <div>Credential form</div>,
    onValidate: vi.fn(async () => true),
  },
  {
    step: "validation",
    title: "Validating",
    description: "Testing connection",
    content: <div>Validation spinner</div>,
    hideNext: true,
  },
  {
    step: "confirmation",
    title: "Success!",
    description: "All set",
    content: <div>Success message</div>,
    nextLabel: "Finish",
  },
];

describe("WizardShell", () => {
  const mockOnBack = vi.fn();
  const mockOnNext = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders wizard with title and icon", () => {
    render(
      <WizardShell
        title="Test Wizard"
        icon={<span data-testid="wizard-icon">🧙</span>}
        steps={mockSteps}
        currentStepIndex={0}
        onBack={mockOnBack}
        onNext={mockOnNext}
        onCancel={mockOnCancel}
      />,
    );

    expect(screen.getByText("Test Wizard")).toBeInTheDocument();
    expect(screen.getByTestId("wizard-icon")).toBeInTheDocument();
  });

  it("displays current step title and description", () => {
    render(
      <WizardShell
        title="Test Wizard"
        icon={<span>🧙</span>}
        steps={mockSteps}
        currentStepIndex={0}
        onBack={mockOnBack}
        onNext={mockOnNext}
        onCancel={mockOnCancel}
      />,
    );

    expect(screen.getByText("Introduction")).toBeInTheDocument();
    expect(screen.getByText("Welcome to the wizard")).toBeInTheDocument();
    expect(screen.getByText("Intro content")).toBeInTheDocument();
  });

  it("displays progress bar", () => {
    const { container } = render(
      <WizardShell
        title="Test Wizard"
        icon={<span>🧙</span>}
        steps={mockSteps}
        currentStepIndex={1}
        onBack={mockOnBack}
        onNext={mockOnNext}
        onCancel={mockOnCancel}
      />,
    );

    // Progress should be 50% (step 2 of 4)
    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toBeInTheDocument();
  });

  it("hides Back button on first step", () => {
    render(
      <WizardShell
        title="Test Wizard"
        icon={<span>🧙</span>}
        steps={mockSteps}
        currentStepIndex={0}
        onBack={mockOnBack}
        onNext={mockOnNext}
        onCancel={mockOnCancel}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /back/i }),
    ).not.toBeInTheDocument();
  });

  it("shows Back button on subsequent steps", () => {
    render(
      <WizardShell
        title="Test Wizard"
        icon={<span>🧙</span>}
        steps={mockSteps}
        currentStepIndex={1}
        onBack={mockOnBack}
        onNext={mockOnNext}
        onCancel={mockOnCancel}
      />,
    );

    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });

  it("calls onBack when Back button clicked", () => {
    render(
      <WizardShell
        title="Test Wizard"
        icon={<span>🧙</span>}
        steps={mockSteps}
        currentStepIndex={1}
        onBack={mockOnBack}
        onNext={mockOnNext}
        onCancel={mockOnCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it("calls onNext when Next button clicked", () => {
    render(
      <WizardShell
        title="Test Wizard"
        icon={<span>🧙</span>}
        steps={mockSteps}
        currentStepIndex={0}
        onBack={mockOnBack}
        onNext={mockOnNext}
        onCancel={mockOnCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(mockOnNext).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when Cancel button clicked", () => {
    render(
      <WizardShell
        title="Test Wizard"
        icon={<span>🧙</span>}
        steps={mockSteps}
        currentStepIndex={0}
        onBack={mockOnBack}
        onNext={mockOnNext}
        onCancel={mockOnCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it("runs validation before calling onNext", async () => {
    const mockValidate = vi.fn(async () => true);
    const stepsWithValidation: WizardStepConfig[] = [
      {
        step: "intro",
        title: "Introduction",
        description: "Welcome",
        content: <div>Intro</div>,
      },
      {
        step: "credentials",
        title: "Credentials",
        description: "Enter credentials",
        content: <div>Form</div>,
        onValidate: mockValidate as () => Promise<boolean>,
      },
    ];

    render(
      <WizardShell
        title="Test Wizard"
        icon={<span>🧙</span>}
        steps={stepsWithValidation}
        currentStepIndex={1}
        onBack={mockOnBack}
        onNext={mockOnNext}
        onCancel={mockOnCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /finish/i }));

    await waitFor(() => {
      expect(mockValidate).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockOnNext).toHaveBeenCalledTimes(1);
    });
  });

  it("does not call onNext if validation fails", async () => {
    const mockValidate = vi.fn(async () => false);
    const stepsWithValidation: WizardStepConfig[] = [
      {
        step: "intro",
        title: "Introduction",
        description: "Welcome",
        content: <div>Intro</div>,
      },
      {
        step: "credentials",
        title: "Credentials",
        description: "Enter credentials",
        content: <div>Form</div>,
        onValidate: mockValidate as () => Promise<boolean>,
      },
    ];

    render(
      <WizardShell
        title="Test Wizard"
        icon={<span>🧙</span>}
        steps={stepsWithValidation}
        currentStepIndex={1}
        onBack={mockOnBack}
        onNext={mockOnNext}
        onCancel={mockOnCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /finish/i }));

    await waitFor(() => {
      expect(mockValidate).toHaveBeenCalledTimes(1);
    });

    // onNext should NOT be called
    expect(mockOnNext).not.toHaveBeenCalled();
  });

  it("displays error message when provided", () => {
    render(
      <WizardShell
        title="Test Wizard"
        icon={<span>🧙</span>}
        steps={mockSteps}
        currentStepIndex={0}
        onBack={mockOnBack}
        onNext={mockOnNext}
        onCancel={mockOnCancel}
        error="Something went wrong"
      />,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("disables buttons when loading", () => {
    render(
      <WizardShell
        title="Test Wizard"
        icon={<span>🧙</span>}
        steps={mockSteps}
        currentStepIndex={1}
        onBack={mockOnBack}
        onNext={mockOnNext}
        onCancel={mockOnCancel}
        loading={true}
      />,
    );

    expect(screen.getByRole("button", { name: /back/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
  });

  it("shows custom next button label", () => {
    const customSteps: WizardStepConfig[] = [
      {
        step: "intro",
        title: "Intro",
        description: "Description",
        content: <div>Content</div>,
        nextLabel: "Continue",
      },
    ];

    render(
      <WizardShell
        title="Test Wizard"
        icon={<span>🧙</span>}
        steps={customSteps}
        currentStepIndex={0}
        onBack={mockOnBack}
        onNext={mockOnNext}
        onCancel={mockOnCancel}
      />,
    );

    expect(
      screen.getByRole("button", { name: /continue/i }),
    ).toBeInTheDocument();
  });

  it("shows Finish label on last step", () => {
    render(
      <WizardShell
        title="Test Wizard"
        icon={<span>🧙</span>}
        steps={mockSteps}
        currentStepIndex={3}
        onBack={mockOnBack}
        onNext={mockOnNext}
        onCancel={mockOnCancel}
      />,
    );

    expect(screen.getByRole("button", { name: /finish/i })).toBeInTheDocument();
  });

  it("hides Next button when hideNext is true", () => {
    render(
      <WizardShell
        title="Test Wizard"
        icon={<span>🧙</span>}
        steps={mockSteps}
        currentStepIndex={2} // validation step with hideNext: true
        onBack={mockOnBack}
        onNext={mockOnNext}
        onCancel={mockOnCancel}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /next/i }),
    ).not.toBeInTheDocument();
  });

  it("hides Back button when hideBack is true", () => {
    const stepsWithHideBack: WizardStepConfig[] = [
      {
        step: "intro",
        title: "Intro",
        description: "Desc",
        content: <div>Content</div>,
      },
      {
        step: "credentials",
        title: "Creds",
        description: "Desc",
        content: <div>Form</div>,
        hideBack: true,
      },
    ];

    render(
      <WizardShell
        title="Test Wizard"
        icon={<span>🧙</span>}
        steps={stepsWithHideBack}
        currentStepIndex={1}
        onBack={mockOnBack}
        onNext={mockOnNext}
        onCancel={mockOnCancel}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /back/i }),
    ).not.toBeInTheDocument();
  });

  it("shows validation loading state during validation", async () => {
    const mockValidate = vi.fn(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(true), 100);
        }),
    );

    const stepsWithValidation: WizardStepConfig[] = [
      {
        step: "intro",
        title: "Introduction",
        description: "Welcome",
        content: <div>Intro</div>,
      },
      {
        step: "credentials",
        title: "Credentials",
        description: "Enter credentials",
        content: <div>Form</div>,
        onValidate: mockValidate as () => Promise<boolean>,
      },
    ];

    render(
      <WizardShell
        title="Test Wizard"
        icon={<span>🧙</span>}
        steps={stepsWithValidation}
        currentStepIndex={1}
        onBack={mockOnBack}
        onNext={mockOnNext}
        onCancel={mockOnCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /finish/i }));

    // Should show validating state
    await waitFor(() => {
      expect(screen.getByText(/validating/i)).toBeInTheDocument();
    });

    // Wait for validation to complete
    await waitFor(() => {
      expect(mockOnNext).toHaveBeenCalled();
    });
  });
});
