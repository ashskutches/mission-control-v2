"use client";
/**
 * WorkflowWizard — thin wrapper around StepBuilder.
 *
 * The chat-based wizard has been superseded by the visual pipeline builder.
 * This file is kept so that WorkflowsDashboard's import doesn't need to change.
 * The original chat wizard code is available in git history.
 */
import { StepBuilder } from "./StepBuilder";

export function WorkflowWizard({ isOpen, onClose, onCreated }: {
    isOpen: boolean;
    onClose: () => void;
    onCreated: () => void;
}) {
    return <StepBuilder isOpen={isOpen} onClose={onClose} onCreated={onCreated} />;
}
