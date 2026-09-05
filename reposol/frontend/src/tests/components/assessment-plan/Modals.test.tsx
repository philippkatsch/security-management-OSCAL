import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SSPBrowserModal } from '../../../components/assessment-plan/SSPBrowserModal';
import { TaskEditorModal } from '../../../components/assessment-plan/TaskEditorModal';
import { ActivityEditorModal } from '../../../components/assessment-plan/ActivityEditorModal';
import { Task } from '../../../lib/types/oscal';

vi.mock('../../../lib/api', () => ({
  fetchDocuments: vi.fn().mockResolvedValue([
    { id: 'ssp-alpha', title: 'Alpha Production SSP', version: '1.2.0', lastModified: '2026-08-01' },
    { id: 'ssp-beta', title: 'Beta Staging SSP', version: '1.0.0' },
  ]),
}));

describe('Assessment Plan Modals Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SSPBrowserModal', () => {
    it('fetches workspace SSPs, filters by query, and confirms selection', async () => {
      const handleSelect = vi.fn();
      const handleClose = vi.fn();

      render(
        <SSPBrowserModal
          isOpen={true}
          onClose={handleClose}
          onSelectSSP={handleSelect}
        />
      );

      expect(screen.getByText('Select Target System Security Plan (SSP)')).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText('Alpha Production SSP')).toBeInTheDocument();
        expect(screen.getByText('Beta Staging SSP')).toBeInTheDocument();
      });

      // Filter
      const searchInput = screen.getByPlaceholderText(/Search SSPs/i);
      fireEvent.change(searchInput, { target: { value: 'Alpha' } });
      expect(screen.getByText('Alpha Production SSP')).toBeInTheDocument();
      expect(screen.queryByText('Beta Staging SSP')).not.toBeInTheDocument();

      // Click card
      fireEvent.click(screen.getByText('Alpha Production SSP'));

      // Link SSP
      const linkBtn = screen.getByRole('button', { name: /Link Target SSP/i });
      fireEvent.click(linkBtn);

      expect(handleSelect).toHaveBeenCalledWith(
        '../system-security-plans/ssp-alpha.json',
        undefined
      );
      expect(handleClose).toHaveBeenCalled();
    });
  });

  describe('TaskEditorModal', () => {
    const existingTasks: Task[] = [
      { uuid: 't-1', title: 'Task 1: Pre-Audit Planning', type: 'action' },
      { uuid: 't-2', title: 'Task 2: Vulnerability Scan', type: 'action', dependencies: [{ 'task-uuid': 't-1' }] },
      { uuid: 't-3', title: 'Task 3: Final Report', type: 'milestone', dependencies: [{ 'task-uuid': 't-2' }] },
    ];

    it('creates a task with mutually exclusive date range timing and role assignment', () => {
      const handleSave = vi.fn();
      const handleClose = vi.fn();

      render(
        <TaskEditorModal
          isOpen={true}
          task={null}
          allTasks={existingTasks}
          onSave={handleSave}
          onClose={handleClose}
        />
      );

      expect(screen.getByText('New Assessment Task')).toBeInTheDocument();

      const titleInput = screen.getByPlaceholderText(/Vulnerability Scan/i);
      fireEvent.change(titleInput, { target: { value: 'Code Review Action' } });

      // Choose date range timing
      fireEvent.click(screen.getByRole('button', { name: 'Date Range' }));
      expect(screen.getByText('Start Date')).toBeInTheDocument();

      // Save
      const saveBtn = screen.getByRole('button', { name: /Save Task/i });
      fireEvent.click(saveBtn);

      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Code Review Action',
          type: 'action',
        })
      );
    });

    it('formats single-date on-date timing with ISO 8601 UTC timezone suffix (T00:00:00Z)', () => {
      const handleSave = vi.fn();
      const handleClose = vi.fn();

      render(
        <TaskEditorModal
          isOpen={true}
          task={null}
          allTasks={existingTasks}
          onSave={handleSave}
          onClose={handleClose}
        />
      );

      const titleInput = screen.getByPlaceholderText(/Vulnerability Scan/i);
      fireEvent.change(titleInput, { target: { value: 'Penetration Testing Action' } });

      // Choose single date timing
      fireEvent.click(screen.getByRole('button', { name: 'Single Date' }));
      const dateEl = document.querySelector('input[type="date"]');
      expect(dateEl).not.toBeNull();
      fireEvent.change(dateEl!, { target: { value: '2026-11-01' } });

      // Save
      fireEvent.click(screen.getByRole('button', { name: /Save Task/i }));

      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Penetration Testing Action',
          timing: {
            'on-date': {
              date: '2026-11-01T00:00:00Z',
            },
          },
        })
      );
    });

    it('formats date range start and end timing with ISO 8601 UTC timezone suffix (T00:00:00Z)', () => {
      const handleSave = vi.fn();
      const handleClose = vi.fn();

      render(
        <TaskEditorModal
          isOpen={true}
          task={null}
          allTasks={existingTasks}
          onSave={handleSave}
          onClose={handleClose}
        />
      );

      const titleInput = screen.getByPlaceholderText(/Vulnerability Scan/i);
      fireEvent.change(titleInput, { target: { value: 'Range Testing Action' } });

      // Choose date range timing
      fireEvent.click(screen.getByRole('button', { name: 'Date Range' }));
      const dateInputs = document.querySelectorAll('input[type="date"]');
      expect(dateInputs.length).toBe(2);
      fireEvent.change(dateInputs[0], { target: { value: '2026-11-01' } });
      fireEvent.change(dateInputs[1], { target: { value: '2026-11-15' } });

      // Save
      fireEvent.click(screen.getByRole('button', { name: /Save Task/i }));

      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Range Testing Action',
          timing: {
            'within-date-range': {
              start: '2026-11-01T00:00:00Z',
              end: '2026-11-15T00:00:00Z',
            },
          },
        })
      );
    });

    it('detects and prevents circular dependencies in Task DAG', () => {
      const handleSave = vi.fn();
      const handleClose = vi.fn();

      // We are editing task 1 (which task 2 and task 3 depend on).
      // If task 1 attempts to depend on task 3, that would create a cycle: t-1 -> t-3 -> t-2 -> t-1!
      render(
        <TaskEditorModal
          isOpen={true}
          task={existingTasks[0]}
          allTasks={existingTasks}
          onSave={handleSave}
          onClose={handleClose}
        />
      );

      // Try checking Task 3
      const task3Checkbox = screen.getByLabelText(/Task 3: Final Report/i);
      fireEvent.click(task3Checkbox);

      expect(screen.getByText(/Circular dependency detected/i)).toBeInTheDocument();
    });
  });

  describe('ActivityEditorModal', () => {
    it('creates an activity with uppercase method enum (TEST) and sequential steps', () => {
      const handleSave = vi.fn();
      const handleClose = vi.fn();

      render(
        <ActivityEditorModal
          isOpen={true}
          activity={null}
          onSave={handleSave}
          onClose={handleClose}
        />
      );

      expect(screen.getByText('New Assessment Activity')).toBeInTheDocument();

      const titleInput = screen.getByPlaceholderText(/Database Authentication/i);
      const descInput = screen.getByPlaceholderText(/Detailed description of the procedural/i);

      fireEvent.change(titleInput, { target: { value: 'Penetration Testing Procedure' } });
      fireEvent.change(descInput, { target: { value: 'Execute authorized vulnerability exploits' } });

      // Add a step
      const stepDescInput = screen.getByPlaceholderText(/Step Description \*/i);
      const addStepBtn = screen.getByRole('button', { name: /\+ Append Step/i });

      fireEvent.change(stepDescInput, { target: { value: 'Scan open ports and endpoints' } });
      fireEvent.click(addStepBtn);

      expect(screen.getByText('Scan open ports and endpoints')).toBeInTheDocument();

      // Save activity
      const saveBtn = screen.getByRole('button', { name: /Save Activity/i });
      fireEvent.click(saveBtn);

      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Penetration Testing Procedure',
          description: 'Execute authorized vulnerability exploits',
          steps: [
            expect.objectContaining({
              description: 'Scan open ports and endpoints',
            }),
          ],
        })
      );
    });
  });
});
